import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { MediaAsset, MediaStatus } from "@/lib/db/schema";

export type MediaView = {
  id: string;
  url: string | null;
  status: MediaStatus;
  error: string | null;
  filename: string | null;
  description: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  source: "upload" | "ai";
  usedIn: number;
  createdAt: string;
};

export async function toViews(assets: (MediaAsset & { usedIn?: number })[]): Promise<MediaView[]> {
  const keys = assets.map((a) => a.thumbKey ?? (a.status === "ready" ? a.storageKey : null));
  const present = keys.filter((k): k is string => Boolean(k));
  const urls = await storage().signedUrls(present, 60 * 60);
  const byKey = new Map(present.map((k, i) => [k, urls[i]]));
  return assets.map((a, i) => ({
    id: a.id,
    url: keys[i] ? byKey.get(keys[i]!) ?? null : null,
    status: a.status,
    error: a.error,
    filename: a.originalFilename,
    description: a.description,
    tags: a.tags,
    width: a.width,
    height: a.height,
    source: a.source,
    usedIn: a.usedIn ?? 0,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function listMedia(brandId: string): Promise<MediaView[]> {
  const rows = await db.select({
    asset: schema.mediaAssets,
    usedIn: sql<number>`(select count(*) from post_media pm where pm.media_asset_id = ${schema.mediaAssets.id})`.mapWith(Number),
  }).from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.brandId, brandId), isNull(schema.mediaAssets.deletedAt)))
    .orderBy(desc(schema.mediaAssets.createdAt))
    .limit(500);
  return toViews(rows.map((r) => ({ ...r.asset, usedIn: r.usedIn })));
}
