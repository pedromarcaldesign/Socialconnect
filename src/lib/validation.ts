import { z } from "zod";

export const TIMEZONES = [
  { value: "Europe/Lisbon", label: "Lisboa / Porto (Portugal continental)" },
  { value: "Atlantic/Madeira", label: "Madeira" },
  { value: "Atlantic/Azores", label: "Açores" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/London", label: "Londres" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
] as const;

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();
const list = (maxItems: number) => z.string().optional().transform((v) =>
  (v ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, maxItems));

export const brandInput = z.object({
  name: z.string().trim().min(1, "Dá um nome à marca.").max(80, "Nome demasiado longo."),
  timezone: z.string().refine((tz) => TIMEZONES.some((t) => t.value === tz), "Fuso horário inválido."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  website: optionalText(300),
  location: optionalText(120),
  description: optionalText(2000),
  amenities: list(30),
});

export const voiceInput = z.object({
  tone: z.string().trim().min(1, "Descreve o tom.").max(300),
  audience: optionalText(300),
  languages: z.array(z.enum(["pt-PT", "en-GB", "es-ES", "fr-FR"])).min(1).default(["pt-PT"]),
  keywords: list(30),
  dos: list(15),
  donts: list(15),
  examplePosts: z.array(z.string().trim().max(2200)).max(5).transform((a) => a.filter(Boolean)),
});

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodError(e: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = String(issue.path[0] ?? "");
    if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
  }
  return { ok: false, error: e.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
}
