import { redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { requireBrand } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { listMedia } from "@/lib/media-view";
import { aiConfigured } from "@/lib/ai/service";
import { partsInZone } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { Composer, type ComposerAccount, type ComposerInitial } from "@/components/composer";

export const metadata = { title: "Criar publicação" };

const EDITABLE = ["draft", "scheduled", "failed", "cancelled"];

export default async function ComposePage({ params, searchParams }: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ post?: string; date?: string }>;
}) {
  const { brandId } = await params;
  const sp = await searchParams;
  const { brand } = await requireBrand(brandId);

  const accounts: ComposerAccount[] = (await db.select().from(schema.socialAccounts)
    .where(and(eq(schema.socialAccounts.brandId, brand.id), ne(schema.socialAccounts.status, "removed")))
    .orderBy(asc(schema.socialAccounts.network), asc(schema.socialAccounts.displayName)))
    .map((a) => ({ id: a.id, network: a.network, name: a.displayName, username: a.username, avatarUrl: a.avatarUrl, active: a.status === "active" }));
  const media = await listMedia(brand.id);
  const [voice] = await db.select().from(schema.brandVoices).where(eq(schema.brandVoices.brandId, brand.id));

  const tomorrow = partsInZone(new Date(Date.now() + 24 * 3600_000), brand.timezone);
  let initial: ComposerInitial = {
    postId: null, baseText: "", aspect: "portrait", mediaIds: [], targets: [],
    date: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : tomorrow.date, time: "10:00", mode: "schedule", idea: null,
  };

  if (sp.post && /^[0-9a-f-]{36}$/i.test(sp.post)) {
    const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, sp.post), eq(schema.posts.brandId, brand.id)));
    if (!post) redirect(`/b/${brand.id}/compose`);
    if (!EDITABLE.includes(post.status)) redirect(`/b/${brand.id}/posts/${post.id}`);
    const targets = await db.select().from(schema.postTargets).where(eq(schema.postTargets.postId, post.id));
    const pm = await db.select().from(schema.postMedia).where(eq(schema.postMedia.postId, post.id)).orderBy(asc(schema.postMedia.position));
    const when = post.scheduledAt ? partsInZone(post.scheduledAt, brand.timezone) : null;
    initial = {
      postId: post.id, baseText: post.baseText, aspect: post.aspect, mediaIds: pm.map((m) => m.mediaAssetId), idea: post.idea,
      targets: targets.map((t) => ({ accountId: t.socialAccountId, format: t.format === "reel" ? "feed" : t.format, textOverride: t.textOverride, firstComment: t.firstComment })),
      date: when?.date ?? initial.date, time: when?.time ?? initial.time, mode: post.status === "scheduled" ? "schedule" : "draft",
    };
  } else if (accounts.length) {
    initial.targets = accounts.filter((a) => a.active).map((a) => ({ accountId: a.id, format: "feed", textOverride: null, firstComment: null }));
  }

  return (
    <>
      <PageHeader title={initial.postId ? "Editar publicação" : "Criar publicação"} description={brand.name} />
      <Composer
        brandId={brand.id}
        brandName={brand.name}
        timezone={brand.timezone}
        accounts={accounts}
        media={media}
        initial={initial}
        aiEnabled={aiConfigured()}
        languages={voice?.languages ?? ["pt-PT"]}
      />
    </>
  );
}
