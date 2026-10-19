"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { error?: string; sent?: boolean };

async function canEnter(email: string): Promise<boolean> {
  if (env.allowedEmails().includes(email)) return true;
  const [member] = await db.select({ id: schema.profiles.id }).from(schema.profiles)
    .innerJoin(schema.workspaceMembers, eq(schema.workspaceMembers.userId, schema.profiles.id))
    .where(eq(schema.profiles.email, email)).limit(1);
  if (member) return true;
  const [invite] = await db.select({ id: schema.workspaceInvites.id }).from(schema.workspaceInvites)
    .where(and(eq(schema.workspaceInvites.email, email), isNull(schema.workspaceInvites.acceptedAt), gt(schema.workspaceInvites.expiresAt, new Date())))
    .limit(1);
  return Boolean(invite);
}

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Escreve um email válido." };
  const supabase = await supabaseServer();
  if (!supabase) return { error: "O login ainda não está configurado (Supabase)." };
  // Mesma resposta para emails sem acesso, para não revelar quem tem conta.
  if (!(await canEnter(email))) return { sent: true };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${env.appUrl()}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { error: "Não foi possível enviar o email. Tenta daqui a pouco." };
  return { sent: true };
}

export async function signInWithGoogle() {
  const supabase = await supabaseServer();
  if (!supabase) redirect("/login?erro=config");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.appUrl()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}
