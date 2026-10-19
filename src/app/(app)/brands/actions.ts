"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireBrand, requireUser } from "@/lib/auth";
import { brandInput, zodError, type ActionResult } from "@/lib/validation";

function formToBrand(form: FormData) {
  return brandInput.safeParse({
    name: form.get("name"),
    timezone: form.get("timezone") ?? "Europe/Lisbon",
    color: form.get("color") || null,
    website: form.get("website") ?? "",
    location: form.get("location") ?? "",
    description: form.get("description") ?? "",
    amenities: form.get("amenities") ?? "",
  });
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
}

export async function createBrand(_: unknown, form: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = formToBrand(form);
  if (!parsed.success) return zodError(parsed.error);
  try {
    const id = await db.transaction(async (tx) => {
      const [brand] = await tx.insert(schema.brands).values({ workspaceId: user.workspaceId, ...parsed.data }).returning({ id: schema.brands.id });
      await tx.insert(schema.brandVoices).values({ brandId: brand.id });
      return brand.id;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id } };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Já existe uma marca com esse nome.", fieldErrors: { name: "Já existe uma marca com esse nome." } };
    throw e;
  }
}

export async function updateBrand(brandId: string, _: unknown, form: FormData): Promise<ActionResult> {
  const { user } = await requireBrand(brandId);
  const parsed = formToBrand(form);
  if (!parsed.success) return zodError(parsed.error);
  try {
    await db.update(schema.brands).set(parsed.data)
      .where(and(eq(schema.brands.id, brandId), eq(schema.brands.workspaceId, user.workspaceId)));
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Já existe uma marca com esse nome.", fieldErrors: { name: "Já existe uma marca com esse nome." } };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Marca guardada." };
}

export async function archiveBrand(brandId: string): Promise<ActionResult> {
  const { user } = await requireBrand(brandId);
  if (user.role === "member") return { ok: false, error: "Só administradores podem arquivar marcas." };
  await db.update(schema.brands).set({ archivedAt: new Date() }).where(eq(schema.brands.id, brandId));
  // As contas ficam livres para outra marca; posts agendados são cancelados.
  await db.update(schema.socialAccounts).set({ brandId: null }).where(eq(schema.socialAccounts.brandId, brandId));
  await db.update(schema.posts).set({ status: "cancelled" })
    .where(and(eq(schema.posts.brandId, brandId), eq(schema.posts.status, "scheduled")));
  revalidatePath("/", "layout");
  return { ok: true };
}
