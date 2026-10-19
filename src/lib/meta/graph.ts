import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

// Cliente mínimo da Graph API da Meta (só endpoints oficiais e públicos).

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "GraphError";
  }
  /** Token inválido, expirado ou sem permissão: é preciso religar a conta. */
  get isAuth(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 10 || (this.code !== undefined && this.code >= 200 && this.code < 300);
  }
  get isRateLimit(): boolean {
    return [4, 17, 32, 613].includes(this.code ?? -1) || this.status === 429;
  }
  /** Vale a pena tentar outra vez mais tarde. */
  get retryable(): boolean {
    return this.isRateLimit || this.status >= 500 || this.code === 1 || this.code === 2;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function withAuth(params: Params, token: string): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v));
  q.set("access_token", token);
  const secret = env.metaAppSecret();
  if (secret) q.set("appsecret_proof", createHmac("sha256", secret).update(token).digest("hex"));
  return q;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GraphError(`Resposta inválida da Meta (${res.status})`, res.status);
  }
  const err = (body as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } }).error;
  if (!res.ok || err) {
    throw new GraphError(err?.error_user_msg || err?.message || `Erro ${res.status} da Meta`, res.status, err?.code, err?.error_subcode);
  }
  return body as T;
}

function url(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${env.metaGraphBase()}/${env.metaGraphVersion()}/${path.replace(/^\//, "")}`;
}

export async function graphGet<T>(path: string, token: string, params: Params = {}): Promise<T> {
  const target = url(path);
  // URLs de paginação já trazem os parâmetros e o token
  const full = target.includes("access_token=") ? target : `${target}?${withAuth(params, token)}`;
  return parse<T>(await fetch(full, { cache: "no-store", signal: AbortSignal.timeout(30_000) }));
}

export async function graphPost<T>(path: string, token: string, params: Params = {}): Promise<T> {
  return parse<T>(await fetch(url(path), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: withAuth(params, token),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  }));
}
