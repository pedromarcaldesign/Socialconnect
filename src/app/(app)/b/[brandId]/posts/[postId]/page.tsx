import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { requireBrand } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { toViews } from "@/lib/media-view";
import { formatInZone } from "@/lib/time";
import { captionFor, FORMATS } from "@/lib/networks";
import { Alert, Badge, Card, NetworkMark, PageHeader, StatusBadge, TARGET_STATUS } from "@/components/ui";
import { PostActions, AutoRefresh } from "./client";

export const metadata = { title: "Publicação" };

export default async function PostPage({ params }: { params: Promise<{ brandId: string; postId: string }> }) {
  const { brandId, postId } = await params;
  const { brand, user } = await requireBrand(brandId);
  if (!/^[0-9a-f-]{36}$/i.test(postId)) notFound();
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brand.id)));
  if (!post) notFound();

  const targets = await db.select({ t: schema.postTargets, a: schema.socialAccounts })
    .from(schema.postTargets).innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.postTargets.socialAccountId))
    .where(eq(schema.postTargets.postId, post.id)).orderBy(asc(schema.socialAccounts.network));
  const media = await db.select({ m: schema.mediaAssets }).from(schema.postMedia)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.postMedia.mediaAssetId))
    .where(eq(schema.postMedia.postId, post.id)).orderBy(asc(schema.postMedia.position));
  const views = await toViews(media.map((r) => r.m));
  const attempts = targets.length ? await db.select().from(schema.publishAttempts)
    .where(inArray(schema.publishAttempts.postTargetId, targets.map((r) => r.t.id)))
    .orderBy(desc(schema.publishAttempts.createdAt)).limit(30) : [];
  const otherBrands = await db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands)
    .where(and(eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt), ne(schema.brands.id, brand.id)))
    .orderBy(asc(schema.brands.name));

  const when = post.status === "scheduled" && post.scheduledAt
    ? `Agendada para ${formatInZone(post.scheduledAt, brand.timezone, { dateStyle: "full", timeStyle: "short" })}`
    : post.publishedAt ? `Publicada a ${formatInZone(post.publishedAt, brand.timezone)}`
    : post.status === "draft" ? "Rascunho, ainda sem data" : null;

  return (
    <>
      <AutoRefresh active={post.status === "publishing"} />
      <PageHeader
        title="Publicação"
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={post.status} />{when}</span>}
        actions={<PostActions brandId={brand.id} postId={post.id} status={post.status} otherBrands={otherBrands} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          {post.status === "failed" || post.status === "partial" ? (
            <Alert tone={post.status === "failed" ? "danger" : "warning"} title={post.status === "failed" ? "A publicação falhou" : "Algumas redes falharam"}>
              Vê o motivo em cada rede. Podes tentar outra vez quando estiver resolvido.
            </Alert>
          ) : null}
          <Card as="section" className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Redes</h2>
            {targets.length === 0 ? <p className="text-sm text-text-muted">Nenhuma rede escolhida.</p> : (
              <ul className="divide-y divide-border">
                {targets.map(({ t, a }) => (
                  <li key={t.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <NetworkMark network={a.network} />
                      <span className="font-semibold">{a.username ? `@${a.username}` : a.displayName}</span>
                      <Badge>{FORMATS[a.network].find((f) => f.value === t.format)?.label ?? t.format}</Badge>
                      <Badge tone={TARGET_STATUS[t.status].tone}>{TARGET_STATUS[t.status].label}</Badge>
                      {t.externalUrl ? (
                        <a href={t.externalUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
                          Ver na rede <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                    {t.errorMessage ? <p className="text-sm text-danger">{t.errorMessage}</p> : null}
                    {t.textOverride ? <p className="text-xs text-text-muted">Com texto próprio para esta rede.</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card as="section" className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Texto</h2>
            <p className="whitespace-pre-line text-sm">{post.baseText || <span className="text-text-muted">Sem texto.</span>}</p>
            {targets.filter(({ t }) => t.textOverride).map(({ t, a }) => (
              <div key={t.id} className="mt-4 border-t border-border pt-3">
                <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-text-muted"><NetworkMark network={a.network} size="sm" /> Texto para {a.username ? `@${a.username}` : a.displayName}</p>
                <p className="whitespace-pre-line text-sm">{captionFor(post.baseText, t.textOverride)}</p>
              </div>
            ))}
          </Card>
          {attempts.length ? (
            <details className="rounded-lg border border-border bg-surface-raised p-5">
              <summary className="cursor-pointer text-sm font-semibold">Registo técnico ({attempts.length})</summary>
              <ul className="mt-3 flex flex-col gap-1 font-mono text-xs">
                {attempts.map((x) => (
                  <li key={x.id} className={x.ok ? "text-text-muted" : "text-danger"}>
                    {formatInZone(x.createdAt, brand.timezone, { dateStyle: "short", timeStyle: "medium" })} · {x.step} · {x.ok ? "ok" : "erro"}
                    {!x.ok && x.detail && typeof x.detail === "object" && "message" in x.detail ? ` · ${String((x.detail as { message: unknown }).message)}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Fotos ({views.length})</h2>
          {views.length === 0 ? <p className="text-sm text-text-muted">Só texto.</p> : (
            <ul className="grid grid-cols-3 gap-2">
              {views.map((m, i) => (
                <li key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url ?? ""} alt={m.description ?? `Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
