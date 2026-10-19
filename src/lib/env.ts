import "server-only";

// Variáveis de ambiente lidas num só sítio. Ver .env.example.
function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) throw new Error(`Variável de ambiente em falta: ${name}`);
  return v;
}

export const env = {
  isProd: process.env.NODE_ENV === "production",
  databaseUrl: () => required("DATABASE_URL"),
  appUrl: () => (optional("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  // chave de 32 bytes em base64 para AES-256-GCM e para assinar URLs
  appSecret: () => required("APP_SECRET"),

  supabaseUrl: () => optional("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => optional("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => optional("SUPABASE_SERVICE_ROLE_KEY"),
  storageBucket: () => optional("STORAGE_BUCKET") ?? "media",
  // 'supabase' em produção; 'local' guarda ficheiros em .data/uploads (dev e testes)
  storageDriver: () => (optional("STORAGE_DRIVER") ?? (optional("SUPABASE_SERVICE_ROLE_KEY") ? "supabase" : "local")) as "supabase" | "local",

  // emails autorizados a entrar quando ainda não há convite (bootstrap da equipa)
  allowedEmails: () => (optional("ALLOWED_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  // só fora de produção: entra automaticamente com este email, sem Supabase Auth
  devAuthEmail: () => (process.env.NODE_ENV === "production" ? undefined : optional("DEV_AUTH_EMAIL")),

  metaGraphBase: () => (optional("META_GRAPH_BASE") ?? "https://graph.facebook.com").replace(/\/$/, ""),
  metaGraphVersion: () => optional("META_GRAPH_VERSION") ?? "v24.0",
  metaSystemUserToken: () => optional("META_SYSTEM_USER_TOKEN"),
  metaAppSecret: () => optional("META_APP_SECRET"),

  anthropicApiKey: () => optional("ANTHROPIC_API_KEY"),
  aiModel: () => optional("AI_MODEL") ?? "claude-opus-5-5",

  // sem chave do Inngest, os jobs correm logo no processo (dev/testes)
  inngestEnabled: () => Boolean(optional("INNGEST_EVENT_KEY") || optional("INNGEST_DEV")),
};
