// Prompts da IA. Os ângulos criativos e as boas práticas vêm da SocialConnect original.
import type { Brand, BrandVoice, Network } from "@/lib/db/schema";

export const CREATIVE_ANGLES = [
  "storytelling emocional: abre com uma cena vívida que transporta o leitor para o local",
  "pergunta de engagement: começa com uma pergunta que convida a comentar ou partilhar",
  "destaque sensorial: sons, cheiros, texturas, sabores e vistas",
  "foco numa comodidade ou espaço específico, contado como um momento único",
  "convite à escapada: contraste entre o stress do dia a dia e a calma do local",
  "momento especial ou celebração: aniversários, lua de mel, ou simplesmente um mimo",
  "dica local: liga o espaço a uma experiência da região (gastronomia, cultura, natureza)",
  "testemunho imaginado: um hóspede ou cliente a contar na primeira pessoa o que sentiu",
  "antes e depois: como se chega (cansado) e como se parte (renovado)",
  "valor e urgência suave: algo exclusivo com um apelo à ação que cria desejo sem pressionar",
];

export function pickAngles(n: number): string[] {
  return [...CREATIVE_ANGLES].sort(() => Math.random() - 0.5).slice(0, n);
}

const NETWORK_GUIDE: Record<Network, string> = {
  instagram: "Instagram: até 2200 caracteres, mas as primeiras 125 têm de prender; emojis com conta; apelo à ação; hashtags no fim, separadas por uma linha.",
  facebook: "Facebook: tom mais conversacional, storytelling, pode ser um pouco mais longo; uma pergunta no fim ajuda o engagement; poucas hashtags (0 a 3).",
};

export function brandContext(brand: Brand, voice: BrandVoice | null): string {
  const lines = [
    `Marca: ${brand.name}`,
    brand.location && `Localização: ${brand.location}`,
    brand.description && `Descrição: ${brand.description}`,
    brand.amenities.length > 0 && `Destaques/comodidades: ${brand.amenities.join(", ")}`,
    voice && `Tom de escrita: ${voice.tone}`,
    voice?.audience && `Público-alvo: ${voice.audience}`,
    voice && voice.keywords.length > 0 && `Palavras-chave: ${voice.keywords.join(", ")}`,
    voice && voice.dos.length > 0 && `Fazer sempre: ${voice.dos.join("; ")}`,
    voice && voice.donts.length > 0 && `Nunca fazer: ${voice.donts.join("; ")}`,
  ].filter(Boolean);
  if (voice && voice.examplePosts.length > 0) {
    lines.push("Exemplos de posts de que a marca gosta (seguir o estilo, não copiar):");
    voice.examplePosts.slice(0, 3).forEach((p, i) => lines.push(`<exemplo ${i + 1}>\n${p}\n</exemplo ${i + 1}>`));
  }
  return lines.join("\n");
}

export const CAPTION_SYSTEM = `És um especialista em social media para marcas de hotelaria, restauração e turismo em Portugal.
Escreves legendas específicas e concretas, nunca genéricas, sempre em Português de Portugal (nunca do Brasil) salvo quando pedido outro idioma.
Regras:
- tom consistente com a identidade da marca
- 3 a 5 emojis relevantes, no máximo
- um apelo à ação claro (reservar, visitar, descobrir...)
- destaca um benefício ou experiência concreta, ligada à foto quando existir
- não inventes factos (preços, prémios, datas) que não estejam no contexto
- as hashtags vão no campo próprio, não no texto`;

export function captionPrompt(input: {
  context: string;
  networks: Network[];
  idea?: string;
  photos: { description?: string | null; tags: string[]; mood?: string; setting?: string }[];
  angles: string[];
  language: string;
}): string {
  const photoLines = input.photos.map((p, i) =>
    `Foto ${i + 1}: ${p.description ?? "(sem descrição)"}${p.setting ? ` | local: ${p.setting}` : ""}${p.mood ? ` | ambiente: ${p.mood}` : ""}${p.tags.length ? ` | tags: ${p.tags.join(", ")}` : ""}`);
  return [
    "<contexto_da_marca>", input.context, "</contexto_da_marca>",
    photoLines.length ? `<fotos>\n${photoLines.join("\n")}\n</fotos>` : "",
    input.idea ? `<ideia>${input.idea}</ideia>` : "",
    `Redes onde vai ser publicado:\n${input.networks.map((n) => `- ${NETWORK_GUIDE[n]}`).join("\n")}`,
    `Idioma da legenda: ${input.language}.`,
    `Escreve ${input.angles.length} propostas diferentes, uma por cada abordagem criativa, pela ordem:`,
    input.angles.map((a, i) => `${i + 1}. ${a}`).join("\n"),
    "Para cada proposta: o texto da legenda (sem hashtags) e 8 a 15 hashtags relevantes, misturando populares e de nicho. Junta uma dica curta de otimização para esta publicação.",
  ].filter(Boolean).join("\n\n");
}

export const REWRITE_ACTIONS = {
  shorter: "Encurta para cerca de metade, mantendo a ideia principal e o apelo à ação.",
  longer: "Desenvolve um pouco mais, com um detalhe concreto a mais, sem encher.",
  hashtags: "Mantém o texto e acrescenta no fim, depois de uma linha em branco, 8 a 12 hashtags relevantes.",
  cta: "Reforça o apelo à ação no fim, de forma natural.",
  fix: "Corrige ortografia, gramática e pontuação (Português de Portugal) sem mudar o estilo.",
  translate_en: "Traduz para Inglês (UK). Mantém emojis e tom; adapta as hashtags para inglês quando fizer sentido.",
  bilingual: "Devolve o texto em Português de Portugal seguido, depois de uma linha em branco, da versão em Inglês (UK). Começa cada versão com a bandeira 🇵🇹 / 🇬🇧. As hashtags ficam só no fim.",
} as const;
export type RewriteAction = keyof typeof REWRITE_ACTIONS;

export const ANALYSIS_PROMPT = `Analisa esta foto para uso em redes sociais da marca. Responde em Português de Portugal:
- description: descrição objetiva do que se vê (1-2 frases)
- tags: até 8 tags curtas em minúsculas
- mood: atmosfera (ex.: luxuoso, acolhedor, relaxante, animado)
- setting: onde foi tirada (ex.: piscina, quarto, restaurante, lobby, jardim, exterior, praia)
- subjects: o que aparece
- suggestions: 2 a 3 ideias curtas de legenda`;

export const BRAND_PROFILE_PROMPT = `A partir do texto do site da marca, extrai em Português de Portugal:
- description: 3-4 frases sobre a marca
- location: localidade/região
- amenities: comodidades, serviços ou destaques (lista curta)
- tone: tom de escrita sugerido para posts
- audience: público-alvo
- keywords: 8 a 12 palavras-chave para posts
Usa só o que está no texto. Se algo não aparecer, deixa vazio.`;
