// Regras de cada rede, partilhadas pelo compositor (browser) e pelo servidor.
// Confirmar contra a documentação da Meta quando mudar a versão da Graph API.
import type { Network, TargetFormat } from "@/lib/db/schema";

export const NETWORK_LABEL: Record<Network, string> = { instagram: "Instagram", facebook: "Facebook" };

export const LIMITS = {
  instagram: { text: 2200, hashtags: 30, mentions: 20, carouselMin: 2, carouselMax: 10, imageMaxBytes: 8 * 1024 * 1024 },
  facebook: { text: 63206, maxImages: 10 },
} as const;

/** Formatos disponíveis neste corte (só imagens). */
export const FORMATS: Record<Network, { value: TargetFormat; label: string }[]> = {
  instagram: [
    { value: "feed", label: "Publicação" },
    { value: "carousel", label: "Carrossel" },
    { value: "story", label: "Story" },
  ],
  facebook: [{ value: "feed", label: "Publicação" }],
};

/** Formato por omissão do Instagram conforme o número de imagens. */
export function defaultFormat(network: Network, mediaCount: number): TargetFormat {
  if (network === "instagram" && mediaCount > 1) return "carousel";
  return "feed";
}

export function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function countMentions(text: string): number {
  return (text.match(/(^|\s)@[\w.]+/g) ?? []).length;
}

export function captionFor(baseText: string, override: string | null | undefined): string {
  return (override ?? "").trim() !== "" ? override!.trim() : baseText.trim();
}

export type TargetCheck = {
  network: Network;
  format: TargetFormat;
  text: string;
  mediaCount: number;
};

/** Lista de problemas em português; vazia quando o target pode ser publicado. */
export function validateTarget(t: TargetCheck): string[] {
  const errors: string[] = [];
  if (t.network === "instagram") {
    const l = LIMITS.instagram;
    if (t.format !== "story" && t.text.length > l.text) errors.push(`Texto com ${t.text.length} caracteres (máximo ${l.text}).`);
    if (countHashtags(t.text) > l.hashtags) errors.push(`Mais de ${l.hashtags} hashtags.`);
    if (countMentions(t.text) > l.mentions) errors.push(`Mais de ${l.mentions} menções.`);
    if (t.mediaCount === 0) errors.push("O Instagram precisa de pelo menos uma imagem.");
    if (t.format === "feed" && t.mediaCount > 1) errors.push("Uma publicação simples leva uma imagem. Para várias, usa Carrossel.");
    if (t.format === "carousel" && (t.mediaCount < l.carouselMin || t.mediaCount > l.carouselMax))
      errors.push(`Um carrossel leva entre ${l.carouselMin} e ${l.carouselMax} imagens.`);
    if (t.format === "story" && t.mediaCount !== 1) errors.push("Uma story leva exatamente uma imagem.");
    if (t.format === "reel") errors.push("Reels ainda não são suportados (precisam de vídeo).");
  } else {
    const l = LIMITS.facebook;
    if (t.format !== "feed") errors.push("No Facebook só está disponível a publicação normal.");
    if (t.text.length > l.text) errors.push(`Texto com ${t.text.length} caracteres (máximo ${l.text}).`);
    if (t.mediaCount > l.maxImages) errors.push(`No máximo ${l.maxImages} imagens.`);
    if (t.mediaCount === 0 && t.text.trim() === "") errors.push("Escreve um texto ou junta uma imagem.");
  }
  return errors;
}
