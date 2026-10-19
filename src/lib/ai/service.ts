import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import type { Network } from "@/lib/db/schema";
import {
  ANALYSIS_PROMPT, BRAND_PROFILE_PROMPT, CAPTION_SYSTEM, REWRITE_ACTIONS, brandContext, captionPrompt, pickAngles,
  type RewriteAction,
} from "@/lib/ai/prompts";

export class AIError extends Error {}

let client: Anthropic | undefined;
function anthropic(): Anthropic | null {
  if (!env.anthropicApiKey()) return null;
  client ??= new Anthropic({ apiKey: env.anthropicApiKey() });
  return client;
}

type Usage = { workspaceId: string; brandId?: string | null; userId?: string | null; kind: "caption" | "analysis" | "translation" | "brand_profile" | "rewrite" };

async function logUsage(u: Usage, model: string, usage: { input_tokens: number; output_tokens: number } | null, ok: boolean) {
  await db.insert(schema.aiGenerations).values({
    workspaceId: u.workspaceId, brandId: u.brandId ?? null, userId: u.userId ?? null, kind: u.kind, model,
    inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0, ok,
  }).catch(() => {});
}

/**
 * Pedido estruturado ao Claude. Usa o fallback do servidor (refusals) e devolve o objeto validado.
 */
async function structured<T extends z.ZodType>(
  u: Usage,
  schemaOut: T,
  content: Anthropic.Beta.BetaContentBlockParam[] | string,
  opts: { system?: string; effort?: "low" | "medium" | "high"; maxTokens?: number } = {},
): Promise<z.infer<T>> {
  const c = anthropic();
  if (!c) throw new AIError("A IA não está configurada (falta ANTHROPIC_API_KEY).");
  const model = env.aiModel();
  try {
    const res = await c.beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(schemaOut) },
      messages: [{ role: "user", content }],
    });
    await logUsage(u, res.model, res.usage, res.stop_reason !== "refusal");
    if (res.stop_reason === "refusal") throw new AIError("A IA recusou este pedido. Reformula o tema e tenta outra vez.");
    if (res.stop_reason === "max_tokens" || !res.parsed_output) throw new AIError("A resposta da IA veio incompleta. Tenta outra vez.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    await logUsage(u, model, null, false);
    if (e instanceof Anthropic.RateLimitError) throw new AIError("A IA está ocupada. Tenta daqui a um minuto.");
    if (e instanceof Anthropic.AuthenticationError) throw new AIError("A chave da IA é inválida.");
    if (e instanceof Anthropic.APIError) throw new AIError(`Erro da IA (${e.status}). Tenta outra vez.`);
    throw e;
  }
}

async function imageBlock(storageKey: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const buf = await sharp(await storage().get(storageKey)).rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } };
}

// ---------------------------------------------------------------------------

const Analysis = z.object({
  description: z.string(),
  tags: z.array(z.string()),
  mood: z.string(),
  setting: z.string(),
  subjects: z.array(z.string()),
  suggestions: z.array(z.string()),
});

/** Descreve e etiqueta uma foto da biblioteca. Sem IA configurada, não faz nada. */
export async function analyzeAsset(assetId: string): Promise<void> {
  if (!anthropic()) return;
  const [row] = await db.select({ asset: schema.mediaAssets, brand: schema.brands })
    .from(schema.mediaAssets).innerJoin(schema.brands, eq(schema.brands.id, schema.mediaAssets.brandId))
    .where(eq(schema.mediaAssets.id, assetId));
  if (!row || row.asset.status !== "ready" || row.asset.kind !== "image") return;
  const out = await structured({ workspaceId: row.brand.workspaceId, brandId: row.brand.id, kind: "analysis" }, Analysis,
    [await imageBlock(row.asset.storageKey), { type: "text", text: `${ANALYSIS_PROMPT}\n\nMarca: ${row.brand.name}` }],
    { effort: "low", maxTokens: 4000 });
  await db.update(schema.mediaAssets).set({
    description: row.asset.description ?? out.description,
    tags: Array.from(new Set([...row.asset.tags, ...out.tags.map((t) => t.toLowerCase().replace(/^#/, ""))])).slice(0, 12),
    analysis: { mood: out.mood, setting: out.setting, subjects: out.subjects, suggestions: out.suggestions },
  }).where(eq(schema.mediaAssets.id, assetId));
}

// ---------------------------------------------------------------------------

const Captions = z.object({
  options: z.array(z.object({ text: z.string(), hashtags: z.array(z.string()) })),
  tip: z.string(),
});
export type CaptionOptions = z.infer<typeof Captions>;

export async function generateCaptions(input: {
  workspaceId: string; brandId: string; userId: string;
  networks: Network[]; idea?: string; assetIds: string[]; language?: string; count?: number;
}): Promise<CaptionOptions> {
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, input.brandId));
  if (!brand) throw new AIError("Marca não encontrada.");
  const [voice] = await db.select().from(schema.brandVoices).where(eq(schema.brandVoices.brandId, input.brandId));
  const assets = input.assetIds.length
    ? await db.select().from(schema.mediaAssets).where(and(
      inArray(schema.mediaAssets.id, input.assetIds), eq(schema.mediaAssets.brandId, input.brandId), isNull(schema.mediaAssets.deletedAt)))
    : [];

  const angles = pickAngles(Math.min(Math.max(input.count ?? 3, 1), 5));
  const prompt = captionPrompt({
    context: brandContext(brand, voice ?? null),
    networks: input.networks.length ? input.networks : ["instagram", "facebook"],
    idea: input.idea?.trim() || undefined,
    photos: assets.map((a) => ({ description: a.description, tags: a.tags, mood: a.analysis?.mood, setting: a.analysis?.setting })),
    angles,
    language: input.language ?? voice?.languages[0] ?? "pt-PT",
  });
  // A primeira foto vai também como imagem, para a legenda falar do que se vê.
  const first = assets.find((a) => a.kind === "image" && a.status === "ready");
  const content: Anthropic.Beta.BetaContentBlockParam[] = first
    ? [await imageBlock(first.storageKey), { type: "text", text: prompt }]
    : [{ type: "text", text: prompt }];
  const out = await structured({ workspaceId: input.workspaceId, brandId: input.brandId, userId: input.userId, kind: "caption" },
    Captions, content, { system: CAPTION_SYSTEM, effort: "medium" });
  return {
    tip: out.tip,
    options: out.options.map((o) => ({
      text: o.text.trim(),
      hashtags: o.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")).filter((h) => h.length > 1),
    })),
  };
}

const Rewritten = z.object({ text: z.string() });

export async function rewriteText(input: { workspaceId: string; brandId: string; userId: string; text: string; action: RewriteAction }): Promise<string> {
  if (!input.text.trim()) throw new AIError("Escreve primeiro algum texto.");
  const kind = input.action === "translate_en" || input.action === "bilingual" ? "translation" : "rewrite";
  const out = await structured({ workspaceId: input.workspaceId, brandId: input.brandId, userId: input.userId, kind }, Rewritten,
    `${REWRITE_ACTIONS[input.action]}\nDevolve só o texto final no campo "text".\n\n<texto>\n${input.text}\n</texto>`,
    { system: CAPTION_SYSTEM, effort: "low", maxTokens: 8000 });
  return out.text.trim();
}

// ---------------------------------------------------------------------------

const Suggestion = z.object({ assetId: z.string().nullable() });

/** Escolhe da biblioteca a foto que melhor serve uma ideia (modo "Por ideia"). */
export async function suggestAssetForIdea(input: { workspaceId: string; brandId: string; userId: string; idea: string }): Promise<string | null> {
  const assets = await db.select().from(schema.mediaAssets).where(and(
    eq(schema.mediaAssets.brandId, input.brandId), eq(schema.mediaAssets.status, "ready"), isNull(schema.mediaAssets.deletedAt)));
  const described = assets.filter((a) => a.description || a.tags.length);
  if (described.length === 0) return assets[0]?.id ?? null;
  const list = described.slice(0, 150).map((a) => `${a.id} | ${a.analysis?.setting ?? ""} | ${a.tags.join(", ")} | ${a.description ?? ""}`).join("\n");
  const out = await structured({ ...input, kind: "caption" }, Suggestion,
    `Ideia para um post: "${input.idea}"\n\nEscolhe a foto mais adequada desta lista (id | local | tags | descrição). Devolve o id exatamente como aparece, ou null se nenhuma servir.\n\n${list}`,
    { effort: "low", maxTokens: 2000 });
  return described.find((a) => a.id === out.assetId)?.id ?? null;
}

// ---------------------------------------------------------------------------

const BrandProfile = z.object({
  description: z.string(),
  location: z.string(),
  amenities: z.array(z.string()),
  tone: z.string(),
  audience: z.string(),
  keywords: z.array(z.string()),
});
export type BrandProfileOut = z.infer<typeof BrandProfile>;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip.startsWith("::ffff:127.");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Lê o site da própria marca (URL dado pelo utilizador) e propõe descrição, tom e palavras-chave. */
export async function profileFromWebsite(input: { workspaceId: string; brandId: string; userId: string; website: string }): Promise<BrandProfileOut> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`);
  } catch {
    throw new AIError("O endereço do site não é válido.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new AIError("O site tem de começar por http:// ou https://.");
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new AIError("Não foi possível abrir esse site.");

  const res = await fetch(url, {
    headers: { "user-agent": "SocialPurepixel/1.0 (+brand profile)", accept: "text/html" },
    redirect: "follow", signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) throw new AIError("Não foi possível abrir esse site.");
  const html = (await res.text()).slice(0, 600_000);
  const meta = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title)["'][^>]*content=["']([^"']+)["']/gi)].map((m) => m[1]);
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ").trim();
  const source = [...meta, text].join("\n").slice(0, 40_000);
  if (source.length < 80) throw new AIError("O site tem muito pouco texto para analisar.");

  return structured({ ...input, kind: "brand_profile" }, BrandProfile,
    `${BRAND_PROFILE_PROMPT}\n\n<site url="${url.href}">\n${source}\n</site>`, { effort: "low", maxTokens: 8000 });
}

export function aiConfigured(): boolean {
  return Boolean(env.anthropicApiKey());
}
