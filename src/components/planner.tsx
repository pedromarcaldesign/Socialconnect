"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, List, Plus } from "lucide-react";
import { Card, EmptyState, NetworkMark, POST_STATUS, StatusBadge, buttonClass, clsx } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import type { Network, PostStatus } from "@/lib/db/schema";
import { moveScheduledPost } from "@/app/(app)/b/[brandId]/posts/actions";

export type PlannerPost = {
  id: string; status: PostStatus; date: string | null; time: string | null; text: string; networks: Network[]; thumb: string | null; updatedAt: string;
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");

const DOT: Record<PostStatus, string> = {
  draft: "bg-text-subtle", scheduled: "bg-info", publishing: "bg-accent", published: "bg-success", partial: "bg-warning", failed: "bg-danger", cancelled: "bg-text-subtle",
};

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Dias da grelha (segunda a domingo) que cobrem o mês. */
function gridDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(y, m - 1, 1 - offset);
  const days: string[] = [];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start + i * 86400_000);
    days.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return days;
}

function Chip({ brandId, post, draggable }: { brandId: string; post: PlannerPost; draggable: boolean }) {
  return (
    <Link
      href={`/b/${brandId}/posts/${post.id}`}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("text/post", post.id); e.dataTransfer.effectAllowed = "move"; }}
      className={clsx("flex items-center gap-1.5 rounded-sm border border-border bg-bg px-1.5 py-1 text-xs hover:border-border-input", draggable && "cursor-grab")}
      aria-label={`${post.time ?? ""} ${POST_STATUS[post.status].label}: ${post.text || "sem texto"}`}
    >
      <span className={clsx("size-2 shrink-0 rounded-pill", DOT[post.status])} title={POST_STATUS[post.status].label} aria-hidden />
      <span className="tabular-nums text-text-muted">{post.time}</span>
      {post.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumb} alt="" className="size-5 shrink-0 rounded-sm object-cover" />
      ) : null}
      <span className="hidden min-w-0 flex-1 truncate xl:block">{post.text}</span>
      <span className="ml-auto flex shrink-0 gap-0.5">{post.networks.map((n) => <NetworkMark key={n} network={n} size="sm" />)}</span>
    </Link>
  );
}

function MonthView({ brandId, month, today, posts }: { brandId: string; month: string; today: string; posts: PlannerPost[] }) {
  const router = useRouter();
  const toast = useToast();
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const days = gridDays(month);
  const byDay = new Map<string, PlannerPost[]>();
  for (const p of posts) if (p.date) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <div className="grid grid-cols-7 border-b border-border bg-surface text-center text-xs font-semibold text-text-muted">
        {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.startsWith(month);
          const list = (byDay.get(day) ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
          const past = day < today;
          return (
            <div
              key={day}
              onDragOver={(e) => { if (!past) { e.preventDefault(); setOver(day); } }}
              onDragLeave={() => setOver((o) => (o === day ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/post");
                const post = posts.find((p) => p.id === id);
                if (!post || post.date === day) return;
                start(async () => {
                  const r = await moveScheduledPost(brandId, id, day);
                  if (r.ok) { toast.success(r.message ?? "Reagendada."); router.refresh(); } else toast.error(r.error);
                });
              }}
              className={clsx(
                "group flex min-h-28 flex-col gap-1 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-surface",
                over === day && "bg-accent-soft",
              )}
              aria-label={day}
            >
              <div className="flex items-center justify-between">
                <span className={clsx(
                  "flex size-6 items-center justify-center rounded-pill text-xs",
                  day === today ? "bg-accent font-bold text-on-accent" : inMonth ? "text-text" : "text-text-subtle",
                )}>{Number(day.slice(8))}</span>
                {!past ? (
                  <Link href={`/b/${brandId}/compose?date=${day}`} className="rounded-sm p-0.5 text-text-subtle opacity-0 hover:bg-canvas hover:text-text focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Criar publicação a ${day}`}>
                    <Plus className="size-4" />
                  </Link>
                ) : null}
              </div>
              {list.slice(0, 3).map((p) => <Chip key={p.id} brandId={brandId} post={p} draggable={p.status === "scheduled"} />)}
              {list.length > 3 ? <span className="px-1 text-xs text-text-muted">+{list.length - 3} mais</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ brandId, posts, empty }: { brandId: string; posts: PlannerPost[]; empty: React.ReactNode }) {
  if (!posts.length) return <Card>{empty}</Card>;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={p.status === "draft" || p.status === "cancelled" ? `/b/${brandId}/compose?post=${p.id}` : `/b/${brandId}/posts/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface">
              {p.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumb} alt="" className="size-12 shrink-0 rounded-md object-cover" />
              ) : <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-canvas"><FileText className="size-5 text-text-subtle" aria-hidden /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{p.text || <span className="text-text-muted">Sem texto</span>}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <StatusBadge status={p.status} />
                  {p.date ? <span className="tabular-nums">{p.date.split("-").reverse().join("/")} {p.time}</span> : <span>Editada {new Date(p.updatedAt).toLocaleDateString("pt-PT")}</span>}
                </p>
              </div>
              <span className="flex gap-1">{p.networks.map((n) => <NetworkMark key={n} network={n} size="sm" />)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Planner({ brandId, month, today, view, posts }: { brandId: string; month: string; today: string; view: "mes" | "lista" | "rascunhos"; posts: PlannerPost[] }) {
  const [y, m] = month.split("-").map(Number);
  const base = `/b/${brandId}/planner`;
  const tabs = [
    { v: "mes", label: "Mês", icon: CalendarDays, href: `${base}?mes=${month}` },
    { v: "lista", label: "Lista", icon: List, href: `${base}?vista=lista` },
    { v: "rascunhos", label: "Rascunhos", icon: FileText, href: `${base}?vista=rascunhos` },
  ] as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vista" className="flex gap-1 rounded-md bg-bg p-1 shadow-card">
          {tabs.map((t) => (
            <Link key={t.v} href={t.href} aria-current={view === t.v ? "page" : undefined}
              className={clsx("flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold", view === t.v ? "bg-accent-soft text-on-accent-soft" : "text-text-muted hover:text-text")}>
              <t.icon className="size-4" aria-hidden />{t.label}
            </Link>
          ))}
        </nav>
        {view === "mes" ? (
          <div className="flex items-center gap-2">
            <Link href={`${base}?mes=${shiftMonth(month, -1)}`} className={buttonClass("ghost", "sm")} aria-label="Mês anterior"><ChevronLeft className="size-4" /></Link>
            <h2 className="min-w-36 text-center text-sm font-semibold capitalize" aria-live="polite">{MONTHS[m - 1]} {y}</h2>
            <Link href={`${base}?mes=${shiftMonth(month, 1)}`} className={buttonClass("ghost", "sm")} aria-label="Mês seguinte"><ChevronRight className="size-4" /></Link>
            {!today.startsWith(month) ? <Link href={base} className={buttonClass("secondary", "sm")}>Hoje</Link> : null}
          </div>
        ) : null}
      </div>
      {view === "mes" ? (
        <>
          <MonthView brandId={brandId} month={month} today={today} posts={posts} />
          <p className="text-xs text-text-muted">Arrasta uma publicação agendada para outro dia para a reagendar. Carrega num dia para criar uma publicação.</p>
        </>
      ) : view === "lista" ? (
        <ListView brandId={brandId} posts={posts} empty={<EmptyState icon={CalendarDays} title="Nada agendado nem publicado nos últimos 30 dias" action={<Link href={`/b/${brandId}/compose`} className={buttonClass("primary")}>Criar publicação</Link>} />} />
      ) : (
        <ListView brandId={brandId} posts={posts} empty={<EmptyState icon={FileText} title="Sem rascunhos">Os rascunhos guardados no compositor aparecem aqui.</EmptyState>} />
      )}
    </div>
  );
}
