import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  acesso: "Este email não tem acesso. Pede um convite a um administrador da Purepixel.",
  link: "O link expirou ou já foi usado. Pede um novo.",
  config: "O login ainda não está configurado.",
  google: "Não foi possível entrar com o Google.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getUser()) redirect("/");
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-accent text-lg font-bold text-on-accent" aria-hidden>P</div>
          <div>
            <p className="text-lg font-bold leading-tight">Social Purepixel</p>
            <p className="text-xs text-text-muted">Redes sociais de todas as marcas, num só sítio</p>
          </div>
        </div>
        <LoginForm error={erro ? ERRORS[erro] ?? null : null} googleEnabled={Boolean(env.supabaseUrl())} />
        <nav aria-label="Informação legal" className="mt-6 flex justify-center gap-4 text-xs text-text-muted">
          <Link href="/privacidade" className="hover:text-text">Privacidade</Link>
          <Link href="/eliminacao-de-dados" className="hover:text-text">Eliminação de dados</Link>
        </nav>
      </div>
    </main>
  );
}
