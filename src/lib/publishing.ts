import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { ensureRendition } from "@/lib/media";
import { accountToken, markNeedsReconnect } from "@/lib/meta/accounts";
import { graphGet, graphPost, GraphError } from "@/lib/meta/graph";
import { captionFor } from "@/lib/networks";
import type { MediaAsset, Post, PostStatus, PostTarget, RenditionPreset, SocialAccount } from "@/lib/db/schema";

export type PublishResult = { ok: true } | { ok: false; retryable: boolean; message: string };

const MEDIA_URL_TTL = 60 * 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logAttempt(targetId: string, step: string, ok: boolean, httpStatus?: number, detail?: unknown) {
  await db.insert(schema.publishAttempts).values({
    postTargetId: targetId, step, ok, httpStatus: httpStatus ?? null, detail: detail === undefined ? null : (detail as object),
  });
}

async function loadTarget(targetId: string) {
  const [row] = await db.select({ target: schema.postTargets, post: schema.posts, account: schema.socialAccounts, brand: schema.brands })
    .from(schema.postTargets)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postTargets.postId))
    .innerJoin(schema.socialAccounts, eq(schema.socialAccounts.id, schema.postTargets.socialAccountId))
    .innerJoin(schema.brands, eq(schema.brands.id, schema.posts.brandId))
    .where(eq(schema.postTargets.id, targetId));
  if (!row) return null;
  const media = await db.select({ asset: schema.mediaAssets })
    .from(schema.postMedia)
    .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.postMedia.mediaAssetId))
    .where(eq(schema.postMedia.postId, row.post.id))
    .orderBy(asc(schema.postMedia.position));
  return { ...row, media: media.map((m) => m.asset) };
}

async function mediaUrls(assets: MediaAsset[], preset: RenditionPreset): Promise<string[]> {
  const keys = await Promise.all(assets.map((a) => ensureRendition(a, preset)));
  return Promise.all(keys.map((k) => storage().signedUrl(k, MEDIA_URL_TTL)));
}

// ---------------------------------------------------------------------------
// Instagram (Graph API com login do Facebook): container → (esperar) → media_publish
// ---------------------------------------------------------------------------

async function waitForContainer(id: string, token: string, targetId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await graphGet<{ status_code?: string; status?: string }>(id, token, { fields: "status_code,status" });
    if (res.status_code === "FINISHED" || res.status_code === undefined) return;
    if (res.status_code === "ERROR" || res.status_code === "EXPIRED") {
      await logAttempt(targetId, "poll", false, 200, res);
      throw new GraphError(`O Instagram não aceitou a imagem (${res.status ?? res.status_code}).`, 400);
    }
    await sleep(Math.min(1000 * (i + 1), 5000));
  }
  throw new GraphError("O Instagram demorou demasiado a processar a imagem.", 503);
}

async function publishInstagram(t: NonNullable<Awaited<ReturnType<typeof loadTarget>>>, token: string): Promise<void> {
  const { target, post, account, media } = t;
  const igUser = account.externalId;
  const caption = captionFor(post.baseText, target.textOverride);

  let containerId = target.containerId;
  if (!containerId) {
    if (target.format === "story") {
      const [url] = await mediaUrls(media.slice(0, 1), "story");
      containerId = (await graphPost<{ id: string }>(`${igUser}/media`, token, { media_type: "STORIES", image_url: url })).id;
    } else if (target.format === "carousel") {
      const urls = await mediaUrls(media, post.aspect);
      const children: string[] = [];
      for (const url of urls) {
        children.push((await graphPost<{ id: string }>(`${igUser}/media`, token, { image_url: url, is_carousel_item: true })).id);
      }
      for (const c of children) await waitForContainer(c, token, target.id);
      containerId = (await graphPost<{ id: string }>(`${igUser}/media`, token, {
        media_type: "CAROUSEL", children: children.join(","), caption,
      })).id;
    } else {
      const [url] = await mediaUrls(media.slice(0, 1), post.aspect);
      containerId = (await graphPost<{ id: string }>(`${igUser}/media`, token, { image_url: url, caption })).id;
    }
    await db.update(schema.postTargets).set({ containerId }).where(eq(schema.postTargets.id, target.id));
    await logAttempt(target.id, "create_container", true, 200, { containerId });
  }

  await waitForContainer(containerId, token, target.id);

  const published = await graphPost<{ id: string }>(`${igUser}/media_publish`, token, { creation_id: containerId });
  // Guardar já o id: a partir daqui o post existe e não pode ser repetido.
  await db.update(schema.postTargets).set({ externalPostId: published.id }).where(eq(schema.postTargets.id, target.id));
  await logAttempt(target.id, "publish", true, 200, published);

  const info = await graphGet<{ permalink?: string }>(published.id, token, { fields: "permalink" }).catch(() => ({} as { permalink?: string }));
  if (info.permalink) await db.update(schema.postTargets).set({ externalUrl: info.permalink }).where(eq(schema.postTargets.id, target.id));

  if (target.firstComment?.trim() && target.format !== "story") {
    await graphPost(`${published.id}/comments`, token, { message: target.firstComment.trim() })
      .then((r) => logAttempt(target.id, "first_comment", true, 200, r))
      .catch((e: unknown) => logAttempt(target.id, "first_comment", false, e instanceof GraphError ? e.status : undefined, { message: String(e) }));
  }
}

// ---------------------------------------------------------------------------
// Facebook (Página): texto, uma foto, ou várias fotos num só post
// ---------------------------------------------------------------------------

async function publishFacebook(t: NonNullable<Awaited<ReturnType<typeof loadTarget>>>, token: string): Promise<void> {
  const { target, post, account, media } = t;
  const page = account.externalId;
  const message = captionFor(post.baseText, target.textOverride);
  let postId: string;

  if (media.length === 0) {
    postId = (await graphPost<{ id: string }>(`${page}/feed`, token, { message })).id;
  } else if (media.length === 1) {
    const [url] = await mediaUrls(media, "original");
    const res = await graphPost<{ id: string; post_id?: string }>(`${page}/photos`, token, { url, caption: message });
    postId = res.post_id ?? res.id;
  } else {
    const urls = await mediaUrls(media, "original");
    const ids: string[] = [];
    for (const url of urls) ids.push((await graphPost<{ id: string }>(`${page}/photos`, token, { url, published: false })).id);
    const attached: Record<string, string> = {};
    ids.forEach((id, i) => { attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
    postId = (await graphPost<{ id: string }>(`${page}/feed`, token, { message, ...attached })).id;
  }

  await db.update(schema.postTargets).set({ externalPostId: postId }).where(eq(schema.postTargets.id, target.id));
  await logAttempt(target.id, "publish", true, 200, { postId });

  const info = await graphGet<{ permalink_url?: string }>(postId, token, { fields: "permalink_url" }).catch(() => ({} as { permalink_url?: string }));
  if (info.permalink_url) await db.update(schema.postTargets).set({ externalUrl: info.permalink_url }).where(eq(schema.postTargets.id, target.id));

  if (target.firstComment?.trim()) {
    await graphPost(`${postId}/comments`, token, { message: target.firstComment.trim() })
      .then((r) => logAttempt(target.id, "first_comment", true, 200, r))
      .catch((e: unknown) => logAttempt(target.id, "first_comment", false, e instanceof GraphError ? e.status : undefined, { message: String(e) }));
  }
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/**
 * Publica um target. Nunca lança: devolve o resultado e deixa o target em
 * published ou failed. Seguro de repetir: um target já publicado não volta a sair.
 */
export async function publishTarget(targetId: string): Promise<PublishResult> {
  const claimed = await db.update(schema.postTargets)
    .set({ status: "publishing", attempts: sql`${schema.postTargets.attempts} + 1`, errorMessage: null })
    .where(and(eq(schema.postTargets.id, targetId), inArray(schema.postTargets.status, ["pending", "failed", "publishing"])))
    .returning({ externalPostId: schema.postTargets.externalPostId });
  if (claimed.length === 0) return { ok: true }; // já publicado ou ignorado

  const t = await loadTarget(targetId);
  if (!t) return { ok: false, retryable: false, message: "Target não encontrado." };

  const finish = async (status: "published" | "failed", errorMessage: string | null) => {
    await db.update(schema.postTargets)
      .set({ status, errorMessage, publishedAt: status === "published" ? new Date() : null })
      .where(eq(schema.postTargets.id, targetId));
  };

  // Uma tentativa anterior já publicou, mas não chegou a marcar: não repetir.
  if (claimed[0].externalPostId) {
    await finish("published", null);
    return { ok: true };
  }
  if (t.account.status !== "active") {
    const message = "A conta precisa de ser religada antes de publicar.";
    await finish("failed", message);
    return { ok: false, retryable: false, message };
  }

  try {
    const token = await accountToken(t.account.id);
    if (t.account.network === "instagram") await publishInstagram(t, token);
    else await publishFacebook(t, token);
    await finish("published", null);
    return { ok: true };
  } catch (e) {
    const graph = e instanceof GraphError ? e : null;
    const raw = e instanceof Error ? e.message : String(e);
    const message = graph?.isAuth
      ? `A Meta recusou o acesso a esta conta. Sincroniza as contas em Ligações ou gera um novo token. (${raw})`
      : graph?.isRateLimit ? `A Meta pediu para abrandar (limite de pedidos). (${raw})` : raw;
    await logAttempt(targetId, "error", false, graph?.status, { message: raw, code: graph?.code, subcode: graph?.subcode });
    if (graph?.isAuth) await markNeedsReconnect(t.account.id, t.brand.workspaceId, message);
    // Se o post saiu mas falhou depois (ex.: permalink), fica publicado.
    const [after] = await db.select({ ext: schema.postTargets.externalPostId }).from(schema.postTargets).where(eq(schema.postTargets.id, targetId));
    if (after?.ext) {
      await finish("published", null);
      return { ok: true };
    }
    await finish("failed", message);
    return { ok: false, retryable: Boolean(graph?.retryable) && !graph?.isAuth, message };
  }
}

/** Recalcula o estado do post a partir dos targets e cria notificações em caso de falha. */
export async function recomputePostStatus(postId: string): Promise<PostStatus> {
  const targets = await db.select().from(schema.postTargets).where(eq(schema.postTargets.postId, postId));
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!post) return "cancelled";
  const counted = targets.filter((t) => t.status !== "skipped");
  const published = counted.filter((t) => t.status === "published").length;
  const failed = counted.filter((t) => t.status === "failed").length;
  const running = counted.length - published - failed;

  let status: PostStatus;
  if (running > 0) status = "publishing";
  else if (failed === 0) status = "published";
  else if (published === 0) status = "failed";
  else status = "partial";

  if (status !== post.status) {
    await db.update(schema.posts)
      .set({ status, publishedAt: status === "published" || status === "partial" ? (post.publishedAt ?? new Date()) : post.publishedAt })
      .where(eq(schema.posts.id, postId));
    if (status === "failed" || status === "partial") {
      const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, post.brandId));
      if (brand) {
        await db.insert(schema.notifications).values({
          workspaceId: brand.workspaceId,
          kind: status === "failed" ? "publish_failed" : "publish_partial",
          payload: { postId, brandId: brand.id, brandName: brand.name },
        });
      }
    }
  }
  return status;
}

/**
 * Passa um post agendado a "publishing" se ainda estiver na versão esperada.
 * Devolve os ids dos targets a publicar, ou null se outro job já o apanhou ou se foi reagendado.
 */
export async function claimPost(postId: string, version: number): Promise<string[] | null> {
  const rows = await db.update(schema.posts)
    .set({ status: "publishing" })
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.status, "scheduled"), eq(schema.posts.scheduleVersion, version)))
    .returning({ id: schema.posts.id });
  if (rows.length === 0) return null;
  const targets = await db.select({ id: schema.postTargets.id }).from(schema.postTargets)
    .where(and(eq(schema.postTargets.postId, postId), inArray(schema.postTargets.status, ["pending", "failed"])));
  return targets.map((t) => t.id);
}

/** Publica um post do princípio ao fim neste processo (modo sem Inngest e rede de segurança). */
export async function runPost(postId: string, version: number): Promise<PostStatus | null> {
  const targetIds = await claimPost(postId, version);
  if (!targetIds) return null;
  for (const id of targetIds) {
    let result = await publishTarget(id);
    for (let attempt = 1; !result.ok && result.retryable && attempt < 3; attempt++) {
      await sleep(2000 * attempt);
      result = await publishTarget(id);
    }
  }
  return recomputePostStatus(postId);
}

/** Posts agendados cuja hora já passou (rede de segurança se um evento se perder). */
export async function duePosts(now = new Date()): Promise<Pick<Post, "id" | "scheduleVersion">[]> {
  return db.select({ id: schema.posts.id, scheduleVersion: schema.posts.scheduleVersion })
    .from(schema.posts)
    .where(and(eq(schema.posts.status, "scheduled"), lte(schema.posts.scheduledAt, now)))
    .orderBy(asc(schema.posts.scheduledAt))
    .limit(50);
}

export type { PostTarget, SocialAccount };
