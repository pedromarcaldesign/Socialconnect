// Primitivas da interface. Só classes de tokens (ver replica/design/components.md).
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Loader2, type LucideIcon } from "lucide-react";
import type { Network, PostStatus, TargetStatus } from "@/lib/db/schema";

export { clsx };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
};

export const buttonClass = (variant: ButtonProps["variant"] = "secondary", size: ButtonProps["size"] = "md") => clsx(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors duration-[120ms]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
  variant === "primary" && "bg-accent text-on-accent hover:bg-accent-hover",
  variant === "secondary" && "bg-bg text-text border border-border hover:bg-canvas",
  variant === "ghost" && "text-text-muted hover:bg-canvas hover:text-text",
  variant === "danger" && "bg-danger text-on-accent hover:opacity-90",
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={clsx(buttonClass(variant, size), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

const control = "w-full rounded-md border border-border-input bg-bg text-text text-sm placeholder:text-text-subtle focus:border-focus focus:outline-2 focus:outline-focus focus:outline-offset-0 disabled:bg-canvas aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(control, "h-10 px-3", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(control, "px-3 py-2 leading-6", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={clsx(control, "h-10 px-3", className)} {...rest} />;
});

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">{label}</label>
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={clsx("rounded-lg border border-border bg-surface-raised shadow-card", className)}>{children}</As>;
}

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
const toneClass: Record<Tone, string> = {
  neutral: "bg-canvas text-text-muted",
  accent: "bg-accent-soft text-on-accent-soft",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium", toneClass[tone], className)}>{children}</span>;
}

export const POST_STATUS: Record<PostStatus, { label: string; tone: Tone }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  scheduled: { label: "Agendado", tone: "info" },
  publishing: { label: "A publicar", tone: "accent" },
  published: { label: "Publicado", tone: "success" },
  partial: { label: "Publicado em parte", tone: "warning" },
  failed: { label: "Falhou", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export const TARGET_STATUS: Record<TargetStatus, { label: string; tone: Tone }> = {
  pending: { label: "Por publicar", tone: "neutral" },
  publishing: { label: "A publicar", tone: "accent" },
  published: { label: "Publicado", tone: "success" },
  failed: { label: "Falhou", tone: "danger" },
  skipped: { label: "Ignorado", tone: "neutral" },
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const s = POST_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Marca genérica da rede (inicial num círculo com a cor da rede). Não usa logótipos de terceiros. */
export function NetworkMark({ network, size = "md" }: { network: Network; size?: "sm" | "md" }) {
  return (
    <span
      aria-label={network === "instagram" ? "Instagram" : "Facebook"}
      title={network === "instagram" ? "Instagram" : "Facebook"}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-pill font-bold text-on-accent",
        size === "sm" ? "size-4 text-[9px]" : "size-6 text-[11px]",
        network === "instagram" ? "bg-net-instagram" : "bg-net-facebook",
      )}
    >
      {network === "instagram" ? "IG" : "FB"}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Icon className="size-10 text-text-subtle" aria-hidden />
      <p className="text-sm font-semibold text-text">{title}</p>
      {children ? <div className="max-w-md text-sm text-text-muted">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("shimmer rounded-md", className)} aria-hidden />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-text">{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral" | "accent">; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-md px-4 py-3 text-sm", toneClass[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-0.5" : undefined}>{children}</div>
    </div>
  );
}
