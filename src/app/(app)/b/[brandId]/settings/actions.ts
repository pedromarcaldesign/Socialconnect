"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireBrand } from "@/lib/auth";
import { voiceInput, zodError, type ActionResult } from "@/lib/validation";
import { AIError, profileFromWebsite, type BrandProfileOut } from "@/lib/ai/service";

export async function saveVoice(brandId: string, _: unknown, form: FormData): Promise<ActionResult> {
  await requireBrand(brandId);
  const parsed = voiceInput.safeParse({
    tone: form.get("tone"),
    audience: form.get("audience") ?? "",
    languages: form.getAll("languages"),
    keywords: form.get("keywords") ?? "",
    dos: form.get("dos") ?? "",
    donts: form.get("donts") ?? "",
    examplePosts: form.getAll("examplePosts").map(String),
  });
  if (!parsed.success) return zodError(parsed.error);
  await db.insert(schema.brandVoices).values({ brandId, ...parsed.data })
    .onConflictDoUpdate({ target: schema.brandVoices.brandId, set: parsed.data });
  revalidatePath(`/b/${brandId}/settings`);
  return { ok: true, message: "Voz da marca guardada." };
}

export async function fillFromWebsite(brandId: string, website: string): Promise<ActionResult<BrandProfileOut>> {
  const { user } = await requireBrand(brandId);
  try {
    const profile = await profileFromWebsite({ workspaceId: user.workspaceId, brandId, userId: user.id, website });
    return { ok: true, data: profile };
  } catch (e) {
    return { ok: false, error: e instanceof AIError ? e.message : "Não foi possível ler o site." };
  }
}

/** Aplica a proposta da IA: preenche só os campos que estão vazios, a não ser que overwrite seja true. */
export async function applyProfile(brandId: string, p: BrandProfileOut, overwrite: boolean): Promise<ActionResult> {
  const { brand } = await requireBrand(brandId);
  const [voice] = await db.select().from(schema.brandVoices).where(eq(schema.brandVoices.brandId, brandId));
  const pick = <T,>(current: T | null | undefined, next: T, empty: (v: T) => boolean) =>
    overwrite || current === null || current === undefined || empty(current) ? next : current;
  const emptyStr = (v: string) => v.trim() === "";
  const emptyArr = (v: string[]) => v.length === 0;
  await db.update(schema.brands).set({
    description: pick(brand.description, p.description || null, (v) => !v || emptyStr(v)),
    location: pick(brand.location, p.location || null, (v) => !v || emptyStr(v)),
    amenities: pick(brand.amenities, p.amenities.slice(0, 30), emptyArr),
  }).where(eq(schema.brands.id, brandId));
  const defaultTone = "profissional e acolhedor";
  await db.insert(schema.brandVoices).values({ brandId, tone: p.tone || defaultTone, audience: p.audience || null, keywords: p.keywords.slice(0, 30) })
    .onConflictDoUpdate({
      target: schema.brandVoices.brandId,
      set: {
        tone: pick(voice?.tone, p.tone || defaultTone, (v) => emptyStr(v) || v === defaultTone),
        audience: pick(voice?.audience, p.audience || null, (v) => !v || emptyStr(v)),
        keywords: pick(voice?.keywords, p.keywords.slice(0, 30), emptyArr),
      },
    });
  revalidatePath(`/b/${brandId}/settings`);
  return { ok: true, message: "Perfil da marca atualizado." };
}
