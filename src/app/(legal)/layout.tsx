import Link from "next/link";

// Páginas públicas (sem login), exigidas pela Meta para a app estar em modo Live.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden>P</span>
          <span className="text-sm font-bold">Social Purepixel</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="flex flex-col gap-4 text-sm leading-6 text-text [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:font-semibold [&_a]:text-accent [&_a]:underline">
          {children}
        </article>
      </main>
      <footer className="border-t border-border">
        <nav aria-label="Informação legal" className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-6 text-xs text-text-muted">
          <Link href="/privacidade" className="hover:text-text">Política de privacidade</Link>
          <Link href="/eliminacao-de-dados" className="hover:text-text">Eliminação de dados</Link>
          <Link href="/login" className="hover:text-text">Entrar</Link>
        </nav>
      </footer>
    </div>
  );
}
