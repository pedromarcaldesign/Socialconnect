import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function POST() {
  const supabase = await supabaseServer();
  await supabase?.auth.signOut();
  return NextResponse.redirect(`${env.appUrl()}/login`, { status: 303 });
}
