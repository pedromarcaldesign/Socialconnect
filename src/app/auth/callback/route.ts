import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const base = env.appUrl();
  const supabase = await supabaseServer();
  if (!code || !supabase) return NextResponse.redirect(`${base}/login?erro=link`);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${base}/login?erro=link`);
  const user = await getUser();
  if (!user) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${base}/login?erro=acesso`);
  }
  return NextResponse.redirect(`${base}/`);
}
