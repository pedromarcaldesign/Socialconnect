import Link from "next/link";
import { and, asc, desc, eq, inArray, or, sql, isNull } from "drizzle-orm";
import { Plus } from "lucide-react";
import { requireBrand } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { partsInZone, zonedToUtc } from "@/lib/time";
import { PageHeader, buttonClass } from "@/components/ui";
import { Planner, type PlannerPost } from "@/components/planner";
import type { Network } from "@/lib/db/schema";

export const metadata = { title: "Planner" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function PlannerPage({ params, searchParams }: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ mes?: string; vista?: string }>;
}) {
  const { brandId } = await params;
  const sp = await searchParams;
  const { brand } = await requireBrand(brandId);
  const today = partsInZone(new Date(), brand.timezone).date;
  const view = sp.vista === "lista" || sp.vista === "rascunhos" ? sp.vista : "mes";

  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const monthStart = zonedToUtc({ date: `${y}-${pad(m)}-01`, time: "00:00" }, brand.timezone) ?? new Date(Date.UTC(y, m - 1, 1));
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const monthEnd = zonedToUtc({ date: `${nextMonth}-01`, time: "00:00" }, brand.timezone) ?? new Date(Date.UTC(y, m, 1));
  // margem de uma semana para os dias de outros meses visíveis na grelha
  const from = new Date(monthStart.getTime() - 7 * 86400_000);
  const to = new Date(monthEnd.getTime() + 7 * 86400_000);

  const when = sql<Date>`coalesce(${schema.posts.scheduledAt}, ${schema.posts.publishedAt})`;
  const where = view === "rascunhos"
    ? and(eq(schema.posts.brandId, brand.id), or(eq(schema.posts.status, "draft"), eq(schema.posts.status, "cancelled")))
    : view === "lista"
      ? and(eq(schema.posts.brandId, brand.id), inArray(schema.posts.status, ["scheduled", "publishing", "published", "partial", "failed"]), sql`${when} >= ${new Date(Date.now() - 30 * 86400_000).toISOString()}::timestamptz`)
      : and(eq(schema.posts.brandId, brand.id), sql`${when} >= ${from.toISOString()}::timestamptz`, sql`${when} < ${to.toISOString()}::timestamptz`);

  const rows = await db.select().from(schema.posts).where(where)
    .orderBy(view === "rascunhos" ? desc(schema.posts.updatedAt) : asc(when)).limit(400);

  const ids = rows.map((r) => r.id);
  const targets = ids.length ? await db.select({ postId: schema.postTargets.postId, network: schema.socialAccounts.network })
    .from(schema.postTargets).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.postTargets.socialAccountId))
    .where(inArray(schema.postTargets.postId, ids)) : [];
  const firstMedia = ids.length ? await db.select({ postId: schema.postMedia.postId, thumb: schema.mediaAssets.thumbKey, key: schema.mediaAssets.storageKey })
    .from(schema.postMedia).innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.postMedia.mediaAssetId))
    .where(and(inArray(schema.postMedia.postId, ids), eq(schema.postMedia.position, 0), isNull(schema.mediaAssets.deletedAt))) : [];
  const thumbKeys = firstMedia.map((f) => f.thumb ?? f.key);
  const thumbUrls = await storage().signedUrls(thumbKeys, 3600);

  const posts: PlannerPost[] = rows.map((p) => {
    const at = p.scheduledAt ?? p.publishedAt;
    const local = at ? partsInZone(at, brand.timezone) : null;
    const fm = firstMedia.findIndex((f) => f.postId === p.id);
    return {
      id: p.id,
      status: p.status,
      date: local?.date ?? null,
      time: local?.time ?? null,
      text: p.baseText.slice(0, 160),
      networks: Array.from(new Set(targets.filter((t) => t.postId === p.id).map((t) => t.network as Network))),
      thumb: fm >= 0 ? thumbUrls[fm] : null,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return (
    <>
      <PageHeader
        title="Planner"
        description={brand.name}
        actions={<Link href={`/b/${brand.id}/compose`} className={buttonClass("primary")}><Plus className="size-4" aria-hidden />Criar publicação</Link>}
      />
      <Planner brandId={brand.id} month={month} today={today} view={view} posts={posts} />
    </>
  );
}
