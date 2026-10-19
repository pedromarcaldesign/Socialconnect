"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/validation";

const inviteInput = z.object({ email: z.string().trim().toLowerCase().email("Email inválido."), role: z.enum(["admin", "member"]) });

export async function inviteMember(_: unknown, form: FormData): Promise<ActionResult> {
  let user;
  try { user = await requireAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const parsed = inviteInput.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: { email: parsed.error.issues[0].message } };
  const expiresAt = new Date(Date.now() + 14 * 86400_000);
  await db.insert(schema.workspaceInvites)
    .values({ workspaceId: user.workspaceId, email: parsed.data.email, role: parsed.data.role, invitedBy: user.id, expiresAt })
    .onConflictDoUpdate({ target: [schema.workspaceInvites.workspaceId, schema.workspaceInvites.email], set: { role: parsed.data.role, expiresAt, acceptedAt: null } });
  revalidatePath("/team");
  return { ok: true, message: `Convite criado. ${parsed.data.email} já pode entrar com este email.` };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  await db.delete(schema.workspaceInvites).where(and(eq(schema.workspaceInvites.id, inviteId), eq(schema.workspaceInvites.workspaceId, user.workspaceId)));
  revalidatePath("/team");
  return { ok: true, message: "Convite anulado." };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (userId === user.id) return { ok: false, error: "Não te podes remover a ti próprio." };
  const [target] = await db.select().from(schema.workspaceMembers)
    .where(and(eq(schema.workspaceMembers.workspaceId, user.workspaceId), eq(schema.workspaceMembers.userId, userId)));
  if (!target) return { ok: false, error: "Membro não encontrado." };
  if (target.role === "owner") return { ok: false, error: "O dono do workspace não pode ser removido." };
  await db.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.workspaceId, user.workspaceId), eq(schema.workspaceMembers.userId, userId)));
  revalidatePath("/team");
  return { ok: true, message: "Membro removido." };
}
