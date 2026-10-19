"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireBrand } from "@/lib/auth";
import { validateTarget, captionFor } from "@/lib/networks";
import { zonedToUtc } from "@/lib/time";
import { dispatchRetryTarget, dispatchScheduledPost } from "@/lib/jobs/dispatch";
import type { ActionResult } from "@/lib/validation";
import type { PostStatus } from "@/lib/db/schema";

const EDITABLE: PostStatus[] = ["draft", "scheduled", "failed", "cancelled"];

const postInput = z.object({
  postId: z.string().uuid().nullable(),
  baseText: z.string().max(63206),
  aspect: z.enum(["square", "portrait", "landscape"]),
  mediaIds: z.array(z.string().uuid()).max(10),
  targets: z.array(z.object({
    accountId: z.string().uuid(),
    format: z.enum(["feed", "carousel", "story"]),
    textOverride: z.string().max(63206).nullable(),
    firstComment: z.string().max(2200).nullable(),
  })).max(20),
  idea: z.string().max(1000).nullable().optional(),
  generationMode: z.enum(["manual", "idea", "batch"]).nullable().optional(),
  mode: z.enum(["draft", "schedule", "now"]),
  date: z.string().optional(),
  time: z.string().optional(),
});
export type PostInput = z.input<typeof postInput>;
export type TargetErrors = Record<string, string[]>;

/**
 * Guarda o post (cria ou atualiza) e, conforme o modo, deixa-o em rascunho, agenda-o ou publica-o já.
 * Toda a validação por rede é refeita aqui, independentemente do que o browser já validou.
 */
export async function submitPost(brandId: string, raw: PostInput): Promise<ActionResult<{ postId: string; status: PostStatus }> & { targetErrors?: TargetErrors }> {
  const { user, brand } = await requireBrand(brandId);
  const parsed = postInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados da publicação inválidos." };
  const input = parsed.data;

  // contas e fotos têm de ser desta marca
  const accountIds = input.targets.map((t) => t.accountId);
  const accounts = accountIds.length
    ? await db.select().from(schema.socialAccounts).where(and(inArray(schema.socialAccounts.id, accountIds), eq(schema.socialAccounts.brandId, brandId)))
    : [];
  if (accounts.length !== new Set(accountIds).size) return { ok: false, error: "Uma das contas já não pertence a esta marca." };
  const media = input.mediaIds.length
    ? await db.select().from(schema.mediaAssets).where(and(
      inArray(schema.mediaAssets.id, input.mediaIds), eq(schema.mediaAssets.brandId, brandId), isNull(schema.mediaAssets.deletedAt), eq(schema.mediaAssets.status, "ready")))
    : [];
  if (media.length !== new Set(input.mediaIds).size) return { ok: false, error: "Uma das fotos já não está disponível na biblioteca." };

  let scheduledAt: Date | null = null;
  if (input.mode !== "draft") {
    if (input.targets.length === 0) return { ok: false, error: "Escolhe pelo menos uma rede." };
    const targetErrors: TargetErrors = {};
    for (const t of input.targets) {
      const acc = accounts.find((a) => a.id === t.accountId)!;
      const errs = validateTarget({ network: acc.network, format: t.format, text: captionFor(input.baseText, t.textOverride), mediaCount: input.mediaIds.length });
      if (acc.status !== "active") errs.push("Esta conta precisa de ser religada.");
      if (errs.length) targetErrors[t.accountId] = errs;
    }
    if (Object.keys(targetErrors).length) return { ok: false, error: "Há problemas a corrigir antes de publicar.", targetErrors };
    if (input.mode === "schedule") {
      scheduledAt = zonedToUtc({ date: input.date ?? "", time: input.time ?? "" }, brand.timezone);
      if (!scheduledAt) return { ok: false, error: "Essa hora não existe nesse dia (mudança de hora) ou a data é inválida." };
      if (scheduledAt.getTime() < Date.now() - 60_000) return { ok: false, error: "Essa hora já passou. Escolhe uma hora futura ou publica já." };
    } else {
      scheduledAt = new Date();
    }
  }

  const result = await db.transaction(async (tx) => {
    let postId = input.postId;
    if (postId) {
      const [existing] = await tx.select().from(schema.posts)
        .where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId))).for("update");
      if (!existing) return { error: "Publicação não encontrada." } as const;
      if (!EDITABLE.includes(existing.status)) return { error: "Esta publicação já saiu (ou está a sair) e não pode ser alterada. Duplica-a para fazer outra." } as const;
    }
    const status: PostStatus = input.mode === "draft" ? "draft" : "scheduled";
    const values = {
      baseText: input.baseText, aspect: input.aspect, status, scheduledAt: input.mode === "draft" ? null : scheduledAt,
      idea: input.idea ?? null, generationMode: input.generationMode ?? "manual",
    };
    if (postId) {
      await tx.update(schema.posts).set({ ...values, scheduleVersion: sql`${schema.posts.scheduleVersion} + 1` }).where(eq(schema.posts.id, postId));
    } else {
      postId = (await tx.insert(schema.posts).values({ brandId, createdBy: user.id, ...values }).returning({ id: schema.posts.id }))[0].id;
    }

    // targets: apagar os que saíram, criar/atualizar os restantes (voltam a "pending")
    const keep = input.targets.map((t) => t.accountId);
    const existingTargets = await tx.select().from(schema.postTargets).where(eq(schema.postTargets.postId, postId));
    const removed = existingTargets.filter((t) => !keep.includes(t.socialAccountId)).map((t) => t.id);
    if (removed.length) await tx.delete(schema.postTargets).where(inArray(schema.postTargets.id, removed));
    for (const t of input.targets) {
      await tx.insert(schema.postTargets).values({
        postId, socialAccountId: t.accountId, format: t.format,
        textOverride: t.textOverride?.trim() ? t.textOverride : null, firstComment: t.firstComment?.trim() ? t.firstComment : null,
      }).onConflictDoUpdate({
        target: [schema.postTargets.postId, schema.postTargets.socialAccountId],
        set: {
          format: t.format, textOverride: t.textOverride?.trim() ? t.textOverride : null, firstComment: t.firstComment?.trim() ? t.firstComment : null,
          status: "pending", containerId: null, errorMessage: null, externalPostId: null, externalUrl: null, publishedAt: null,
        },
      });
    }

    await tx.delete(schema.postMedia).where(eq(schema.postMedia.postId, postId));
    if (input.mediaIds.length) {
      await tx.insert(schema.postMedia).values(input.mediaIds.map((mediaAssetId, position) => ({ postId: postId!, position, mediaAssetId })));
    }
    const [saved] = await tx.select({ id: schema.posts.id, status: schema.posts.status, version: schema.posts.scheduleVersion, scheduledAt: schema.posts.scheduledAt })
      .from(schema.posts).where(eq(schema.posts.id, postId));
    return { saved } as const;
  });

  if ("error" in result) return { ok: false, error: result.error! };
  const { saved } = result;
  if (saved.status === "scheduled" && saved.scheduledAt) {
    await dispatchScheduledPost(saved.id, saved.version, saved.scheduledAt);
  }
  revalidatePath(`/b/${brandId}`, "layout");
  const message = input.mode === "draft" ? "Rascunho guardado." : input.mode === "now" ? "A publicar…" : "Publicação agendada.";
  return { ok: true, message, data: { postId: saved.id, status: saved.status } };
}

export async function cancelPost(brandId: string, postId: string): Promise<ActionResult> {
  await requireBrand(brandId);
  const rows = await db.update(schema.posts)
    .set({ status: "draft", scheduledAt: null, scheduleVersion: sql`${schema.posts.scheduleVersion} + 1` })
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId), eq(schema.posts.status, "scheduled")))
    .returning({ id: schema.posts.id });
  if (!rows.length) return { ok: false, error: "Esta publicação já não está agendada." };
  revalidatePath(`/b/${brandId}`, "layout");
  return { ok: true, message: "Agendamento cancelado. A publicação voltou a rascunho." };
}

export async function retryFailedTargets(brandId: string, postId: string): Promise<ActionResult> {
  await requireBrand(brandId);
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId)));
  if (!post) return { ok: false, error: "Publicação não encontrada." };
  if (!["failed", "partial"].includes(post.status)) return { ok: false, error: "Não há nada para repetir." };
  const failed = await db.update(schema.postTargets).set({ status: "pending", errorMessage: null })
    .where(and(eq(schema.postTargets.postId, postId), eq(schema.postTargets.status, "failed")))
    .returning({ id: schema.postTargets.id });
  if (!failed.length) return { ok: false, error: "Não há redes com falha." };
  await db.update(schema.posts).set({ status: "publishing" }).where(eq(schema.posts.id, postId));
  for (const t of failed) await dispatchRetryTarget(t.id, postId);
  revalidatePath(`/b/${brandId}`, "layout");
  return { ok: true, message: "A tentar outra vez…" };
}

export async function duplicatePost(brandId: string, postId: string, toBrandId?: string): Promise<ActionResult<{ postId: string; brandId: string }>> {
  const { user } = await requireBrand(brandId);
  const target = toBrandId && toBrandId !== brandId ? (await requireBrand(toBrandId)).brand : null;
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId)));
  if (!post) return { ok: false, error: "Publicação não encontrada." };
  const destBrand = target?.id ?? brandId;
  const newId = await db.transaction(async (tx) => {
    const [copy] = await tx.insert(schema.posts).values({
      brandId: destBrand, baseText: post.baseText, aspect: post.aspect, status: "draft", createdBy: user.id, idea: post.idea, generationMode: post.generationMode,
    }).returning({ id: schema.posts.id });
    if (!target) {
      // mesma marca: copiar fotos e redes; noutra marca as fotos e contas são outras
      const media = await tx.select().from(schema.postMedia).where(eq(schema.postMedia.postId, postId)).orderBy(asc(schema.postMedia.position));
      if (media.length) await tx.insert(schema.postMedia).values(media.map((m) => ({ ...m, postId: copy.id })));
      const targets = await tx.select().from(schema.postTargets).where(eq(schema.postTargets.postId, postId));
      if (targets.length) {
        await tx.insert(schema.postTargets).values(targets.map((t) => ({
          postId: copy.id, socialAccountId: t.socialAccountId, format: t.format, textOverride: t.textOverride, firstComment: t.firstComment,
        })));
      }
    }
    return copy.id;
  });
  revalidatePath(`/b/${destBrand}`, "layout");
  return { ok: true, message: target ? `Copiada para ${target.name} como rascunho.` : "Duplicada como rascunho.", data: { postId: newId, brandId: destBrand } };
}

export async function deletePost(brandId: string, postId: string): Promise<ActionResult> {
  await requireBrand(brandId);
  const rows = await db.delete(schema.posts)
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId), inArray(schema.posts.status, ["draft", "cancelled", "failed"])))
    .returning({ id: schema.posts.id });
  if (!rows.length) return { ok: false, error: "Só se podem apagar rascunhos ou publicações que falharam." };
  revalidatePath(`/b/${brandId}`, "layout");
  return { ok: true, message: "Publicação apagada." };
}

/** Reagendar arrastando no calendário: mantém a hora local, muda o dia. */
export async function moveScheduledPost(brandId: string, postId: string, date: string): Promise<ActionResult> {
  const { brand } = await requireBrand(brandId);
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.brandId, brandId)));
  if (!post || post.status !== "scheduled" || !post.scheduledAt) return { ok: false, error: "Só se podem mover publicações agendadas." };
  const { partsInZone } = await import("@/lib/time");
  const time = partsInZone(post.scheduledAt, brand.timezone).time;
  const when = zonedToUtc({ date, time }, brand.timezone);
  if (!when) return { ok: false, error: "Essa hora não existe nesse dia." };
  if (when.getTime() < Date.now()) return { ok: false, error: "Não se pode agendar para o passado." };
  const [saved] = await db.update(schema.posts)
    .set({ scheduledAt: when, scheduleVersion: sql`${schema.posts.scheduleVersion} + 1` })
    .where(and(eq(schema.posts.id, postId), eq(schema.posts.status, "scheduled")))
    .returning({ version: schema.posts.scheduleVersion });
  if (!saved) return { ok: false, error: "A publicação já não está agendada." };
  await dispatchScheduledPost(postId, saved.version, when);
  revalidatePath(`/b/${brandId}`, "layout");
  return { ok: true, message: "Reagendada." };
}
