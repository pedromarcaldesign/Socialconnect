import "server-only";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { sign } from "@/lib/crypto";

export type UploadTarget = { url: string; method: "PUT"; headers: Record<string, string> };

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(keys: string[]): Promise<void>;
  /** URL temporária que o browser e a Meta conseguem descarregar. */
  signedUrl(key: string, expiresInSec: number): Promise<string>;
  signedUrls(keys: string[], expiresInSec: number): Promise<string[]>;
  /** Destino para o browser enviar o ficheiro diretamente, sem passar pelo servidor. */
  uploadTarget(key: string, contentType: string): Promise<UploadTarget>;
}

const LOCAL_ROOT = path.resolve(process.cwd(), ".data/uploads");

export function localPath(key: string): string {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("chave inválida");
  return p;
}

export function localSignature(method: "GET" | "PUT", key: string, exp: number): string {
  return sign(`${method}:${key}:${exp}`);
}

const local: Storage = {
  async put(key, body) {
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  },
  get: (key) => readFile(localPath(key)),
  async remove(keys) {
    await Promise.all(keys.map((k) => rm(localPath(k), { force: true })));
  },
  async signedUrl(key, expiresInSec) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const q = new URLSearchParams({ exp: String(exp), sig: localSignature("GET", key, exp) });
    return `${env.appUrl()}/api/files/${key}?${q}`;
  },
  signedUrls(keys, expiresInSec) {
    return Promise.all(keys.map((k) => local.signedUrl(k, expiresInSec)));
  },
  async uploadTarget(key, contentType) {
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const q = new URLSearchParams({ exp: String(exp), sig: localSignature("PUT", key, exp) });
    return { url: `/api/files/${key}?${q}`, method: "PUT", headers: { "content-type": contentType } };
  },
};

let supabaseClient: SupabaseClient | undefined;
function supabaseAdmin(): SupabaseClient {
  const url = env.supabaseUrl();
  const key = env.supabaseServiceKey();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são precisos para o storage");
  supabaseClient ??= createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

const supabase: Storage = {
  async put(key, body, contentType) {
    const { error } = await supabaseAdmin().storage.from(env.storageBucket()).upload(key, body, { contentType, upsert: true });
    if (error) throw error;
  },
  async get(key) {
    const { data, error } = await supabaseAdmin().storage.from(env.storageBucket()).download(key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  },
  async remove(keys) {
    if (keys.length === 0) return;
    const { error } = await supabaseAdmin().storage.from(env.storageBucket()).remove(keys);
    if (error) throw error;
  },
  async signedUrl(key, expiresInSec) {
    const { data, error } = await supabaseAdmin().storage.from(env.storageBucket()).createSignedUrl(key, expiresInSec);
    if (error) throw error;
    return data.signedUrl;
  },
  async signedUrls(keys, expiresInSec) {
    if (keys.length === 0) return [];
    const { data, error } = await supabaseAdmin().storage.from(env.storageBucket()).createSignedUrls(keys, expiresInSec);
    if (error) throw error;
    return data.map((d) => d.signedUrl ?? "");
  },
  async uploadTarget(key, contentType) {
    const { data, error } = await supabaseAdmin().storage.from(env.storageBucket()).createSignedUploadUrl(key, { upsert: true });
    if (error) throw error;
    return { url: data.signedUrl, method: "PUT", headers: { "content-type": contentType } };
  },
};

export function storage(): Storage {
  return env.storageDriver() === "supabase" ? supabase : local;
}
