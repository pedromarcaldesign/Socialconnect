import "server-only";
import { cache } from "react";
import { createHash } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { connection } from "next/server";
import { and, eq, isNull, gt, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/db/schema";

export type SessionUser = { id: string; email: string; name?: string | null; avatarUrl?: string | null };
export type AppUser = SessionUser & { workspaceId: string; role: WorkspaceRole };

function uuidFromEmail(email: string): string {
  const h = createHash("sha256").update(`dev:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function sessionUser(): Promise<SessionUser | null> {
  const devEmail = env.devAuthEmail();
  if (devEmail) return { id: uuidFromEmail(devEmail.toLowerCase()), email: devEmail.toLowerCase(), name: "Dev" };
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  const meta = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
  };
}

/**
 * Liga o utilizador da sessão a um workspace. Só entra quem tem convite pendente
 * ou está em ALLOWED_EMAILS. O primeiro a entrar cria o workspace e fica owner.
 */
async function resolveMembership(user: SessionUser): Promise<AppUser | null> {
  await db.insert(schema.profiles)
    .values({ id: user.id, email: user.email, fullName: user.name ?? null, avatarUrl: user.avatarUrl ?? null })
    .onConflictDoUpdate({ target: schema.profiles.id, set: { email: user.email } });

  const [member] = await db.select().from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.userId, user.id)).orderBy(asc(schema.workspaceMembers.createdAt)).limit(1);
  if (member) return { ...user, workspaceId: member.workspaceId, role: member.role };

  const [invite] = await db.select().from(schema.workspaceInvites).where(and(
    eq(schema.workspaceInvites.email, user.email),
    isNull(schema.workspaceInvites.acceptedAt),
    gt(schema.workspaceInvites.expiresAt, new Date()),
  )).limit(1);
  if (invite) {
    await db.transaction(async (tx) => {
      await tx.insert(schema.workspaceMembers).values({ workspaceId: invite.workspaceId, userId: user.id, role: invite.role }).onConflictDoNothing();
      await tx.update(schema.workspaceInvites).set({ acceptedAt: new Date() }).where(eq(schema.workspaceInvites.id, invite.id));
    });
    return { ...user, workspaceId: invite.workspaceId, role: invite.role };
  }

  const allowed = env.allowedEmails().includes(user.email) || env.devAuthEmail()?.toLowerCase() === user.email;
  if (!allowed) return null;
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.workspaces).orderBy(asc(schema.workspaces.createdAt)).limit(1);
    const workspaceId = existing?.id ?? (await tx.insert(schema.workspaces).values({ name: "Purepixel" }).returning())[0].id;
    const role: WorkspaceRole = existing ? "admin" : "owner";
    await tx.insert(schema.workspaceMembers).values({ workspaceId, userId: user.id, role }).onConflictDoNothing();
    return { ...user, workspaceId, role };
  });
}

/** Utilizador autenticado e com acesso, ou null. Memorizado por pedido. */
export const getUser = cache(async (): Promise<AppUser | null> => {
  await connection(); // depende sempre do pedido: nunca pré-gerar na build
  const user = await sessionUser();
  if (!user) return null;
  return resolveMembership(user);
});

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role === "member") throw new Error("Só administradores podem fazer isto.");
  return user;
}

/** A marca, se pertencer ao workspace do utilizador. 404 caso contrário. */
export const requireBrand = cache(async (brandId: string) => {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(brandId)) notFound();
  const [brand] = await db.select().from(schema.brands)
    .where(and(eq(schema.brands.id, brandId), eq(schema.brands.workspaceId, user.workspaceId))).limit(1);
  if (!brand) notFound();
  return { user, brand };
});
