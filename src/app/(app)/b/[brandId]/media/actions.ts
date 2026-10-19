"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireBrand } from "@/lib/auth";
import { storage, type UploadTarget } from "@/lib/storage";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, newAssetKey, processAsset } from "@/lib/media";
import { toViews, type MediaView } from "@/lib/media-view";
import { dispatchAnalyzeAsset } from "@/lib/jobs/dispatch";
import { analyzeAsset, AIError } from "@/lib/ai/service";
import type { ActionResult } from "@/lib/validation";

const fileInput = z.array(z.object({ name: z.string().max(255), type: z.string(), size: z.number().int().positive() })).min(1).max(30);

export type PreparedUpload = { name: string; assetId?: string; target?: UploadTarget; error?: string };

export async function prepareUploads(brandId: string, files: { name: string; type: string; size: number }[]): Promise<ActionResult<PreparedUpload[]>> {
  const { user } = await requireBrand(brandId);
  const parsed = fileInput.safeParse(files);
  if (!parsed.success) return { ok: false, error: "Escolhe entre 1 e 30 ficheiros." };
  const out: PreparedUpload[] = [];
  for (const f of parsed.data) {
    const ext = ACCEPTED_IMAGE_TYPES[f.type];
    if (!ext) { out.push({ name: f.name, error: "Formato não suportado. Usa JPEG, PNG ou WebP." }); continue; }
    if (f.size > MAX_UPLOAD_BYTES) { out.push({ name: f.name, error: "Ficheiro acima de 25 MB." }); continue; }
    const key = newAssetKey(brandId, ext);
    const [asset] = await db.insert(schema.mediaAssets).values({
      brandId, kind: "image", storageKey: key, mime: f.type, sizeBytes: f.size, originalFilename: f.name, uploadedBy: user.id,
    }).returning({ id: schema.mediaAssets.id });
    out.push({ name: f.name, assetId: asset.id, target: await storage().uploadTarget(key, f.type) });
  }
  return { ok: true, data: out };
}

export async function completeUpload(brandId: string, assetId: string): Promise<ActionResult<MediaView>> {
  await requireBrand(brandId);
  const [asset] = await db.select().from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.brandId, brandId)));
  if (!asset) return { ok: false, error: "Ficheiro não encontrado." };
  const processed = await processAsset(asset.id);
  if (processed.status === "ready") await dispatchAnalyzeAsset(asset.id);
  revalidatePath(`/b/${brandId}/media`);
  const [view] = await toViews([processed]);
  return processed.status === "ready" ? { ok: true, data: view } : { ok: false, error: processed.error ?? "Falhou o processamento." };
}

/** Upload falhou no browser: apaga o registo pendente. */
export async function abortUpload(brandId: string, assetId: string): Promise<void> {
  await requireBrand(brandId);
  await db.delete(schema.mediaAssets).where(and(
    eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.brandId, brandId), eq(schema.mediaAssets.status, "processing")));
}

const updateInput = z.object({
  description: z.string().trim().max(1000).nullable(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(20),
});

export async function updateAsset(brandId: string, assetId: string, data: { description: string | null; tags: string[] }): Promise<ActionResult> {
  await requireBrand(brandId);
  const parsed = updateInput.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  await db.update(schema.mediaAssets)
    .set({ description: parsed.data.description || null, tags: Array.from(new Set(parsed.data.tags.map((t) => t.replace(/^#/, "")).filter(Boolean))) })
    .where(and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.brandId, brandId)));
  revalidatePath(`/b/${brandId}/media`);
  return { ok: true, message: "Guardado." };
}

export async function deleteAssets(brandId: string, assetIds: string[]): Promise<ActionResult> {
  await requireBrand(brandId);
  if (!assetIds.length) return { ok: true };
  // Fotos em posts agendados ou a publicar não podem sair da biblioteca.
  const busy = await db.select({ id: schema.postMedia.mediaAssetId }).from(schema.postMedia)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postMedia.postId))
    .where(and(inArray(schema.postMedia.mediaAssetId, assetIds), inArray(schema.posts.status, ["scheduled", "publishing"])));
  if (busy.length) return { ok: false, error: "Algumas fotos estão em publicações agendadas. Tira-as dessas publicações primeiro." };
  await db.update(schema.mediaAssets).set({ deletedAt: new Date() })
    .where(and(inArray(schema.mediaAssets.id, assetIds), eq(schema.mediaAssets.brandId, brandId), isNull(schema.mediaAssets.deletedAt)));
  revalidatePath(`/b/${brandId}/media`);
  return { ok: true, message: assetIds.length === 1 ? "Foto apagada." : `${assetIds.length} fotos apagadas.` };
}

export async function analyzeNow(brandId: string, assetId: string): Promise<ActionResult<MediaView>> {
  await requireBrand(brandId);
  try {
    await analyzeAsset(assetId);
  } catch (e) {
    return { ok: false, error: e instanceof AIError ? e.message : "Não foi possível analisar a foto." };
  }
  const [asset] = await db.select().from(schema.mediaAssets).where(and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.brandId, brandId)));
  revalidatePath(`/b/${brandId}/media`);
  return { ok: true, data: (await toViews([asset]))[0] };
}
