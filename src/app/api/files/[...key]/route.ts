import { NextResponse, type NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { env } from "@/lib/env";
import { verify } from "@/lib/crypto";
import { localPath, storage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/media";

// Só para STORAGE_DRIVER=local (dev e testes). Em produção os ficheiros vêm do Supabase Storage.

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function check(request: NextRequest, method: "GET" | "PUT", key: string): boolean {
  if (env.storageDriver() !== "local") return false;
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  return verify(`${method}:${key}:${exp}`, sig);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  if (!check(request, "GET", key)) return new NextResponse("Proibido", { status: 403 });
  try {
    const p = localPath(key);
    await stat(p);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(await readFile(p)), {
      headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=3600" },
    });
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  if (!check(request, "PUT", key)) return new NextResponse("Proibido", { status: 403 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) return new NextResponse("Tamanho inválido", { status: 413 });
  await storage().put(key, body, request.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 204 });
}
