import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function supabaseServer() {
  const url = env.supabaseUrl();
  const anon = env.supabaseAnonKey();
  if (!url || !anon) return null;
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // chamado a partir de um Server Component: o proxy.ts já renova a sessão
        }
      },
    },
  });
}
