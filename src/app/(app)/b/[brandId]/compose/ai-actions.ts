"use server";

import { z } from "zod";
import { requireBrand } from "@/lib/auth";
import { AIError, generateCaptions, rewriteText, suggestAssetForIdea, type CaptionOptions } from "@/lib/ai/service";
import { REWRITE_ACTIONS, type RewriteAction } from "@/lib/ai/prompts";
import type { ActionResult } from "@/lib/validation";

const captionInput = z.object({
  idea: z.string().max(1000).optional(),
  assetIds: z.array(z.string().uuid()).max(10),
  networks: z.array(z.enum(["instagram", "facebook"])).max(2),
  language: z.enum(["pt-PT", "en-GB", "es-ES", "fr-FR"]).optional(),
  count: z.number().int().min(1).max(5).optional(),
});

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof AIError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "A IA não respondeu. Tenta outra vez." };
}

export async function aiCaptions(brandId: string, raw: z.input<typeof captionInput>): Promise<ActionResult<CaptionOptions>> {
  const { user } = await requireBrand(brandId);
  const input = captionInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "Pedido inválido." };
  try {
    return { ok: true, data: await generateCaptions({ workspaceId: user.workspaceId, brandId, userId: user.id, ...input.data }) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiRewrite(brandId: string, text: string, action: RewriteAction): Promise<ActionResult<string>> {
  const { user } = await requireBrand(brandId);
  if (!(action in REWRITE_ACTIONS) || text.length > 10000) return { ok: false, error: "Pedido inválido." };
  try {
    return { ok: true, data: await rewriteText({ workspaceId: user.workspaceId, brandId, userId: user.id, text, action }) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiPickPhoto(brandId: string, idea: string): Promise<ActionResult<string | null>> {
  const { user } = await requireBrand(brandId);
  if (!idea.trim() || idea.length > 1000) return { ok: false, error: "Escreve primeiro a ideia." };
  try {
    return { ok: true, data: await suggestAssetForIdea({ workspaceId: user.workspaceId, brandId, userId: user.id, idea }) };
  } catch (e) {
    return fail(e);
  }
}
