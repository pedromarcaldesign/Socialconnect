import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { duePosts, runPost } from "@/lib/publishing";

export const maxDuration = 60;

// Alternativa ao Inngest: um cron externo (ex.: Netlify Scheduled Functions) chama isto a cada minuto
// com o cabeçalho "authorization: Bearer $CRON_SECRET" e os posts cuja hora passou são publicados.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const due = await duePosts();
  const results = [];
  for (const p of due) results.push({ id: p.id, status: await runPost(p.id, p.scheduleVersion) });
  return NextResponse.json({ ran: results.length, results });
}
