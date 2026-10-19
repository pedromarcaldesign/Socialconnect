"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays, PenSquare, Images, Settings2, Building2, Link2, Users, Menu, X, ChevronsUpDown, Check, Plus, LogOut, Search,
} from "lucide-react";
import { clsx } from "@/components/ui";

export type ShellBrand = { id: string; name: string; color: string | null; alert: boolean };

export function BrandAvatar({ name, color, size = "md" }: { name: string; color: string | null; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-md font-bold text-on-accent", size === "sm" ? "size-6 text-[11px]" : "size-8 text-sm", !color && "bg-accent")}
      style={color ? { backgroundColor: color } : undefined}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function BrandSwitcher({ brands, current }: { brands: ShellBrand[]; current: ShellBrand | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = brands.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));
  const go = (id: string) => {
    setOpen(false);
    const section = pathname.match(/^\/b\/[^/]+\/(planner|compose|media|settings)/)?.[1] ?? "planner";
    router.push(`/b/${id}/${section}`);
  };

  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-bg px-2 py-2 text-left hover:bg-canvas"
      >
        {current ? <BrandAvatar name={current.name} color={current.color} /> : <Building2 className="size-5 text-text-subtle" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-text-muted">Marca</span>
          <span className="block truncate text-sm font-semibold">{current?.name ?? "Escolher marca"}</span>
        </span>
        {current?.alert ? <span className="size-2 rounded-pill bg-danger" aria-label="Há contas a religar" /> : null}
        <ChevronsUpDown className="size-4 text-text-subtle" aria-hidden />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-border bg-surface-raised p-1 shadow-pop">
          {brands.length > 6 ? (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-text-subtle" aria-hidden />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar marca" aria-label="Procurar marca"
                className="h-9 w-full rounded-sm border border-border bg-bg pl-8 pr-2 text-sm" />
            </div>
          ) : null}
          <ul role="listbox" aria-label="Marcas" className="max-h-72 overflow-y-auto">
            {filtered.map((b) => (
              <li key={b.id} role="option" aria-selected={b.id === current?.id}>
                <button type="button" onClick={() => go(b.id)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-canvas">
                  <BrandAvatar name={b.name} color={b.color} size="sm" />
                  <span className="flex-1 truncate">{b.name}</span>
                  {b.alert ? <span className="size-2 rounded-pill bg-danger" aria-label="Há contas a religar" /> : null}
                  {b.id === current?.id ? <Check className="size-4 text-accent" aria-hidden /> : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? <li className="px-2 py-2 text-sm text-text-muted">Nenhuma marca encontrada.</li> : null}
          </ul>
          <Link href="/brands" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 border-t border-border px-2 pt-2 pb-1 text-sm text-text-muted hover:text-text">
            <Plus className="size-4" aria-hidden /> Gerir marcas
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NavLink({ href, icon: Icon, label, active, onClick }: { href: string; icon: typeof CalendarDays; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
        active ? "bg-accent-soft text-on-accent-soft" : "text-text-muted hover:bg-canvas hover:text-text",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
    </Link>
  );
}

export function AppShell({ brands, user, children }: {
  brands: ShellBrand[]; user: { email: string; name: string | null; role: string }; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const brandId = pathname.match(/^\/b\/([^/]+)/)?.[1];
  const current = brands.find((b) => b.id === brandId) ?? null;
  useEffect(() => setDrawer(false), [pathname]);

  const brandNav = current ? [
    { href: `/b/${current.id}/planner`, icon: CalendarDays, label: "Planner" },
    { href: `/b/${current.id}/compose`, icon: PenSquare, label: "Criar publicação" },
    { href: `/b/${current.id}/media`, icon: Images, label: "Biblioteca" },
    { href: `/b/${current.id}/settings`, icon: Settings2, label: "Marca e voz" },
  ] : [];
  const globalNav = [
    { href: "/brands", icon: Building2, label: "Marcas" },
    { href: "/connections", icon: Link2, label: "Ligações" },
    { href: "/team", icon: Users, label: "Equipa" },
  ];

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href="/" className="flex items-center gap-2 px-1">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden>P</span>
        <span className="text-sm font-bold">Social Purepixel</span>
      </Link>
      <BrandSwitcher brands={brands} current={current} />
      <nav aria-label="Marca" className="flex flex-col gap-0.5">
        {brandNav.map((n) => <NavLink key={n.href} {...n} active={pathname.startsWith(n.href)} />)}
      </nav>
      <nav aria-label="Geral" className="mt-2 flex flex-col gap-0.5 border-t border-border pt-4">
        {globalNav.map((n) => <NavLink key={n.href} {...n} active={pathname.startsWith(n.href)} />)}
      </nav>
      <div className="mt-auto border-t border-border pt-3">
        <p className="truncate px-1 text-xs text-text-muted" title={user.email}>{user.name ?? user.email}</p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="mt-1 flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm text-text-muted hover:text-text">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-border bg-bg lg:block">{sidebar}</aside>
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(22,21,31,.5)]" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-bg shadow-pop">
            <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-3 rounded-md p-1 text-text-muted" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 lg:hidden">
          <button type="button" onClick={() => setDrawer(true)} className="rounded-md p-2 text-text-muted hover:bg-canvas" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <span className="truncate text-sm font-semibold">{current?.name ?? "Social Purepixel"}</span>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
