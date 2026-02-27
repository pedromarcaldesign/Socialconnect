import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface HotelProfile {
  description: string;
  location: string;
  stars: number;
  amenities: string[];
  tone: string;
  target_audience: string;
  keywords: string[];
  instagram_handle?: string;
  facebook_page?: string;
}

export interface PhotoAnalysis {
  description: string;
  tags: string[];
  mood: string;
  subjects: string[];
  setting: string;
  post_suggestions: string[];
}

export interface GeneratedPost {
  text_pt: string;
  hashtags: string[];
  platform_tip: string;
}

// Analyze a photo using Claude Vision
export async function analyzePhoto(imagePath: string): Promise<PhotoAnalysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      description: 'Análise de imagem não disponível (API key não configurada)',
      tags: ['hotel', 'foto'],
      mood: 'acolhedor',
      subjects: ['instalações do hotel'],
      setting: 'hotel',
      post_suggestions: ['Descubra os nossos espaços únicos', 'Uma experiência inesquecível']
    };
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mediaType = ext === 'jpg' ? 'image/jpeg' :
                      ext === 'jpeg' ? 'image/jpeg' :
                      ext === 'png' ? 'image/png' :
                      ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analisa esta imagem de um hotel e responde em JSON com o seguinte formato:
{
  "description": "descrição detalhada da imagem em português",
  "tags": ["tag1", "tag2", ...] (máximo 8 tags relevantes),
  "mood": "atmosfera/mood da imagem (ex: luxuoso, acolhedor, relaxante, animado)",
  "subjects": ["o que aparece na imagem"],
  "setting": "onde foi tirada a foto (ex: piscina, quarto, restaurante, lobby, jardim, exterior)",
  "post_suggestions": ["sugestão 1 para legenda de post", "sugestão 2"] (2-3 sugestões curtas)
}
Responde APENAS com o JSON, sem texto adicional.`
            }
          ],
        }
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error analyzing photo:', error);
  }

  return {
    description: 'Imagem do hotel',
    tags: ['hotel', 'turismo'],
    mood: 'acolhedor',
    subjects: ['hotel'],
    setting: 'hotel',
    post_suggestions: ['Descubra o nosso espaço']
  };
}

// Extract hotel information from scraped content
export async function extractHotelInfo(hotelName: string, scrapedContent: string): Promise<HotelProfile> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      description: `${hotelName} - Um hotel de excelência`,
      location: 'Portugal',
      stars: 4,
      amenities: ['Wi-Fi', 'Piscina', 'Restaurante', 'Spa'],
      tone: 'profissional, caloroso e sofisticado',
      target_audience: 'Viajantes de lazer e negócios',
      keywords: ['hotel', 'luxo', 'conforto', 'experiência'],
    };
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Com base no seguinte conteúdo sobre o hotel "${hotelName}", extrai as informações em JSON:

${scrapedContent.substring(0, 8000)}

Formato JSON esperado:
{
  "description": "descrição completa do hotel em português (3-4 frases)",
  "location": "localização do hotel",
  "stars": número de estrelas (1-5, ou 0 se não mencionado),
  "amenities": ["comodidade1", "comodidade2", ...] (lista de comodidades/serviços),
  "tone": "tom de escrita sugerido para posts (ex: 'luxuoso e sofisticado', 'familiar e acolhedor')",
  "target_audience": "público-alvo do hotel",
  "keywords": ["palavra1", "palavra2", ...] (8-12 palavras-chave para posts),
  "instagram_handle": "@handle se mencionado ou null",
  "facebook_page": "página facebook se mencionada ou null"
}

Responde APENAS com o JSON, sem texto adicional.`
        }
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error extracting hotel info:', error);
  }

  return {
    description: `${hotelName} - experiência única de hospitalidade`,
    location: 'Portugal',
    stars: 4,
    amenities: ['Wi-Fi', 'Piscina', 'Restaurante'],
    tone: 'profissional e acolhedor',
    target_audience: 'Turistas e viajantes de negócios',
    keywords: ['hotel', 'conforto', 'experiência', 'hospitalidade'],
  };
}

// Generate a social media post
export async function generatePost(params: {
  hotelName: string;
  hotelDescription: string;
  hotelTone: string;
  hotelKeywords: string[];
  hotelAmenities: string[];
  hotelLocation: string;
  photoDescription?: string;
  photoTags?: string[];
  photoMood?: string;
  photoSetting?: string;
  platform: string;
  idea?: string;
  targetAudience?: string;
}): Promise<GeneratedPost> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const mockText = params.idea
      ? `${params.idea} ✨ ${params.hotelName} oferece uma experiência única em ${params.hotelLocation}. Reserve já a sua estadia! #${params.hotelName.replace(/\s/g, '')} #hotel`
      : `Descubra o que torna ${params.hotelName} especial em ${params.hotelLocation}. ${params.hotelDescription?.substring(0, 100)}... Venha viver esta experiência! ✨`;

    return {
      text_pt: mockText,
      hashtags: ['#hotel', '#turismo', '#portugal', `#${params.hotelName.replace(/\s/g, '').toLowerCase()}`],
      platform_tip: params.platform === 'instagram' ? 'Use os primeiros 125 caracteres de forma impactante.' : 'Posts com fotos têm 2x mais engagement.'
    };
  }

  const photoContext = params.photoDescription
    ? `\nFoto: ${params.photoDescription}\nAmbiente da foto: ${params.photoMood}\nLocal: ${params.photoSetting}\nTags da foto: ${params.photoTags?.join(', ')}`
    : '';

  const ideaContext = params.idea ? `\nIdeia/tema para o post: ${params.idea}` : '';

  const platformGuide = params.platform === 'instagram'
    ? 'Instagram: máximo 2200 caracteres, usa emojis estrategicamente, faz call-to-action, linha de quebra antes dos hashtags'
    : params.platform === 'facebook'
    ? 'Facebook: pode ser mais longo (até 500 palavras), conversacional, storytelling, pergunta de engagement'
    : 'Facebook & Instagram: cria um texto versátil mas com boas práticas para ambas as plataformas';

  // Randomly pick a creative angle to ensure varied posts each time
  const angles = [
    'storytelling emocional — abre com uma cena vívida que transporta o leitor para o hotel (ex: "Fecha os olhos. Imagina acordar com...")',
    'pergunta de engagement — começa com uma pergunta intrigante que convida o leitor a comentar ou partilhar (ex: "E se a tua próxima escapada fosse...")',
    'destaque sensorial — descreve a experiência através dos sentidos: sons, cheiros, texturas, sabores e vistas do hotel',
    'foco numa comodidade específica — elege UMA comodidade ou espaço e conta a história desse momento único (piscina, spa, restaurante, quarto com vista, etc.)',
    'convite à escapada — usa linguagem de fuga ao quotidiano, contraste entre o stress do dia-a-dia e a paz do hotel',
    'momento especial / celebração — posiciona o hotel como o lugar perfeito para celebrar aniversários, lua-de-mel, pedidos de casamento, ou simplesmente mimar-se',
    'dica de viagem local — combina o hotel com uma experiência única da região (gastronomia, cultura, natureza) como ponto de partida',
    'testemunho imaginado — escreve como se fosse um hóspede a descrever em primeira pessoa o que sentiu durante a estadia',
    'antes e depois — cria contraste entre como o hóspede chega (cansado, stressado) e como parte (renovado, feliz)',
    'oferta de valor / urgência suave — destaca algo exclusivo do hotel com um call-to-action que cria desejo sem ser agressivo',
  ];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `És um especialista em social media para hotelaria. Cria um post para ${params.platform === 'both' ? 'Facebook e Instagram' : params.platform}.

Hotel: ${params.hotelName}
Localização: ${params.hotelLocation}
Descrição: ${params.hotelDescription}
Tom de escrita: ${params.hotelTone}
Público-alvo: ${params.targetAudience || 'Viajantes em geral'}
Comodidades principais: ${params.hotelAmenities?.join(', ')}
Palavras-chave: ${params.hotelKeywords?.join(', ')}${photoContext}${ideaContext}

Guia da plataforma: ${platformGuide}

ABORDAGEM CRIATIVA OBRIGATÓRIA para este post (segue isto à risca):
${randomAngle}

Boas práticas obrigatórias:
- Tom consistente com a identidade do hotel
- Emojis relevantes mas não excessivos (3-5 máximo)
- Call-to-action claro (reservar, visitar, descobrir, etc.)
- Texto diferente de qualquer post genérico — seja específico, concreto e criativo
- Destaca um benefício/experiência única do hotel
- Linguagem em Português de Portugal (não Brasil)

Responde em JSON:
{
  "text_pt": "texto completo do post em português de Portugal",
  "hashtags": ["#hashtag1", "#hashtag2", ...] (10-15 hashtags relevantes, mistura populares e nicho),
  "platform_tip": "dica de otimização específica para esta publicação"
}

Responde APENAS com o JSON, sem texto adicional.`
        }
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('Error generating post:', error);
  }

  return {
    text_pt: `Descubra ${params.hotelName} em ${params.hotelLocation} ✨ Uma experiência única que vai querer repetir. Reserve já a sua estadia!`,
    hashtags: ['#hotel', '#turismo', '#portugal', '#viagem'],
    platform_tip: 'Adicione emojis e um call-to-action claro.'
  };
}

// Translate post to English
export async function translatePost(textPt: string, hotelName: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `[EN] ${textPt} (Translation unavailable - API key not configured)`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Traduz este post de hotel do Português para Inglês (UK English). Mantém os emojis, o tom e adapta os hashtags para inglês quando necessário. Devolve APENAS o texto traduzido, sem explicações.

Post a traduzir:
${textPt}`
        }
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
  } catch (error) {
    console.error('Error translating post:', error);
  }

  return textPt;
}

// Suggest photo for a given idea
export async function suggestPhotoForIdea(idea: string, availablePhotos: Array<{ id: string; description: string; tags: string[]; setting: string }>): Promise<string | null> {
  if (availablePhotos.length === 0) return null;

  if (!process.env.ANTHROPIC_API_KEY) {
    return availablePhotos[0].id;
  }

  try {
    const photosContext = availablePhotos.map((p, i) =>
      `${i + 1}. ID: ${p.id} | ${p.setting} | Tags: ${p.tags.join(', ')} | ${p.description}`
    ).join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Dado a ideia para um post: "${idea}"

Escolhe a foto mais adequada desta lista:
${photosContext}

Responde APENAS com o ID da foto escolhida (ex: "abc-123"), sem texto adicional.`
        }
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const photoId = content.text.trim().replace(/"/g, '');
      const found = availablePhotos.find(p => p.id === photoId);
      return found ? photoId : availablePhotos[0].id;
    }
  } catch (error) {
    console.error('Error suggesting photo:', error);
  }

  return availablePhotos[0].id;
}
