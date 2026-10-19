"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { syncMetaAccounts } from "@/lib/meta/accounts";
import { GraphError } from "@/lib/meta/graph";
import type { ActionResult } from "@/lib/validation";

export async function syncAccounts(): Promise<ActionResult> {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const r = await syncMetaAccounts(user.workspaceId);
    revalidatePath("/", "layout");
    const lost = r.lost ? ` ${r.lost} deixaram de estar acessíveis.` : "";
    return { ok: true, message: `${r.pages} Páginas de Facebook e ${r.instagram} contas de Instagram encontradas.${lost}` };
  } catch (e) {
    if (e instanceof GraphError) return { ok: false, error: `A Meta respondeu: ${e.message}` };
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível sincronizar." };
  }
}

const assignInput = z.object({ accountId: z.string().uuid(), brandId: z.string().uuid().nullable() });

export async function assignAccount(accountId: string, brandId: string | null): Promise<ActionResult> {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = assignInput.safeParse({ accountId, brandId });
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  if (brandId) {
    const [brand] = await db.select({ id: schema.brands.id }).from(schema.brands)
      .where(and(eq(schema.brands.id, brandId), eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt)));
    if (!brand) return { ok: false, error: "Marca não encontrada." };
  }
  const res = await db.update(schema.socialAccounts).set({ brandId })
    .where(and(eq(schema.socialAccounts.id, accountId), eq(schema.socialAccounts.workspaceId, user.workspaceId)))
    .returning({ id: schema.socialAccounts.id });
  if (res.length === 0) return { ok: false, error: "Conta não encontrada." };
  revalidatePath("/", "layout");
  return { ok: true, message: brandId ? "Conta atribuída." : "Conta retirada da marca." };
}
