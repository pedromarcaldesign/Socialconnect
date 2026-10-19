import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { MediaAsset, RenditionPreset } from "@/lib/db/schema";

export const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Tamanhos finais em JPEG. As proporções respeitam os limites do Instagram (4:5 a 1.91:1). */
export const PRESETS: Record<Exclude<RenditionPreset, "original">, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1080, height: 566 },
  story: { width: 1080, height: 1920 },
};

export function newAssetKey(brandId: string, ext: string): string {
  return `brands/${brandId}/${randomUUID()}.${ext}`;
}

const thumbKeyFor = (key: string) => key.replace(/\.[a-z0-9]+$/i, "") + ".thumb.webp";
const renditionKeyFor = (key: string, preset: RenditionPreset) => key.replace(/\.[a-z0-9]+$/i, "") + `.${preset}.jpg`;

/** Lê dimensões (já com a rotação EXIF aplicada), gera a miniatura e marca o asset como pronto. */
export async function processAsset(assetId: string): Promise<MediaAsset> {
  const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId));
  if (!asset) throw new Error("asset não encontrado");
  try {
    const original = await storage().get(asset.storageKey);
    const rotated = sharp(original, { failOn: "error" }).rotate();
    const meta = await rotated.metadata();
    const { width, height } = meta.autoOrient ?? meta;
    const thumb = await sharp(original).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const thumbKey = thumbKeyFor(asset.storageKey);
    await storage().put(thumbKey, thumb, "image/webp");
    const [updated] = await db.update(schema.mediaAssets)
      .set({ width: width ?? null, height: height ?? null, thumbKey, status: "ready", error: null, sizeBytes: original.length })
      .where(eq(schema.mediaAssets.id, assetId)).returning();
    return updated;
  } catch (e) {
    const [updated] = await db.update(schema.mediaAssets)
      .set({ status: "failed", error: "Não foi possível ler esta imagem. Tenta exportá-la como JPEG." })
      .where(eq(schema.mediaAssets.id, assetId)).returning();
    console.error("processAsset", assetId, e);
    return updated;
  }
}

/** Versão JPEG do asset no formato pedido (criada uma vez e reaproveitada). */
export async function ensureRendition(asset: MediaAsset, preset: RenditionPreset): Promise<string> {
  const [existing] = await db.select().from(schema.mediaRenditions)
    .where(and(eq(schema.mediaRenditions.mediaAssetId, asset.id), eq(schema.mediaRenditions.preset, preset))).limit(1);
  if (existing) return existing.storageKey;

  const original = await storage().get(asset.storageKey);
  let pipeline = sharp(original).rotate().flatten({ background: "#ffffff" });
  if (preset === "original") {
    pipeline = pipeline.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });
  } else {
    const { width, height } = PRESETS[preset];
    pipeline = pipeline.resize({ width, height, fit: "cover", position: sharp.strategy.attention });
  }
  const { data, info } = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const key = renditionKeyFor(asset.storageKey, preset);
  await storage().put(key, data, "image/jpeg");
  await db.insert(schema.mediaRenditions)
    .values({ mediaAssetId: asset.id, preset, storageKey: key, width: info.width, height: info.height })
    .onConflictDoNothing();
  return key;
}

export async function thumbUrl(asset: Pick<MediaAsset, "thumbKey" | "storageKey">): Promise<string> {
  return storage().signedUrl(asset.thumbKey ?? asset.storageKey, 60 * 60);
}
