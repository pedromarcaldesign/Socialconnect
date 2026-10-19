"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImagePlus, Sparkles, X, ArrowLeft, ArrowRight, CalendarClock, Send, Save, Wand2, Languages, Hash, Megaphone, Scissors, Expand, SpellCheck, Lightbulb, AlertTriangle, Link2,
} from "lucide-react";
import { Alert, Badge, Button, Card, Field, Input, NetworkMark, Select, Textarea, clsx } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { Dropzone, MediaTile, UploadList, useUploader } from "@/components/media-library";
import { FORMATS, LIMITS, NETWORK_LABEL, captionFor, countHashtags, defaultFormat, validateTarget } from "@/lib/networks";
import { zonedToUtc } from "@/lib/time";
import type { MediaView } from "@/lib/media-view";
import type { Network, PostAspect, TargetFormat } from "@/lib/db/schema";
import type { CaptionOptions } from "@/lib/ai/service";
import type { RewriteAction } from "@/lib/ai/prompts";
import { submitPost, type TargetErrors } from "@/app/(app)/b/[brandId]/posts/actions";
import { aiCaptions, aiPickPhoto, aiRewrite } from "@/app/(app)/b/[brandId]/compose/ai-actions";

export type ComposerAccount = { id: string; network: Network; name: string; username: string | null; avatarUrl: string | null; active: boolean };
type TargetState = { accountId: string; format: Exclude<TargetFormat, "reel">; textOverride: string | null; firstComment: string | null };
export type ComposerInitial = {
  postId: string | null; baseText: string; aspect: PostAspect; mediaIds: string[]; targets: TargetState[];
  date: string; time: string; mode: "draft" | "schedule" | "now"; idea: string | null;
};

const ASPECTS: { value: PostAspect; label: string; ratio: string }[] = [
  { value: "portrait", label: "Vertical 4:5", ratio: "aspect-[4/5]" },
  { value: "square", label: "Quadrado 1:1", ratio: "aspect-square" },
  { value: "landscape", label: "Horizontal 1.91:1", ratio: "aspect-[1.91/1]" },
];

const REWRITES: { action: RewriteAction; label: string; icon: typeof Wand2 }[] = [
  { action: "shorter", label: "Encurtar", icon: Scissors },
  { action: "longer", label: "Desenvolver", icon: Expand },
  { action: "hashtags", label: "Hashtags", icon: Hash },
  { action: "cta", label: "Apelo à ação", icon: Megaphone },
  { action: "fix", label: "Corrigir", icon: SpellCheck },
  { action: "bilingual", label: "PT + EN", icon: Languages },
];

// ---------------------------------------------------------------------------

function Counter({ network, text }: { network: Network; text: string }) {
  const max = network === "instagram" ? LIMITS.instagram.text : LIMITS.facebook.text;
  const len = text.length;
  const tags = countHashtags(text);
  const over = len > max || (network === "instagram" && tags > LIMITS.instagram.hashtags);
  const near = len > max * 0.9;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs tabular-nums", over ? "text-danger" : near ? "text-warning" : "text-text-subtle")} aria-live={over ? "polite" : undefined}>
      <NetworkMark network={network} size="sm" />
      {len.toLocaleString("pt-PT")} / {max.toLocaleString("pt-PT")}
      {network === "instagram" && tags > 0 ? ` · ${tags} #` : ""}
    </span>
  );
}

function Preview({ account, text, images, aspect, format }: { account: ComposerAccount; text: string; images: MediaView[]; aspect: PostAspect; format: TargetFormat }) {
  const ratio = format === "story" ? "aspect-[9/16]" : ASPECTS.find((a) => a.value === aspect)!.ratio;
  const header = (
    <div className="flex items-center gap-2 px-3 py-2">
      {account.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatarUrl} alt="" className="size-7 rounded-pill object-cover" />
      ) : <span className="size-7 rounded-pill bg-canvas" aria-hidden />}
      <span className="truncate text-xs font-semibold">{account.username ?? account.name}</span>
    </div>
  );
  const image = images[0]?.url ? (
    <div className={clsx("relative w-full overflow-hidden bg-canvas", ratio)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[0].url} alt="" className="size-full object-cover" />
      {images.length > 1 ? <span className="absolute right-2 top-2 rounded-pill bg-[rgba(22,21,31,.6)] px-2 py-0.5 text-xs text-on-accent">1/{images.length}</span> : null}
    </div>
  ) : null;
  if (account.network === "facebook") {
    return (
      <div className="overflow-hidden rounded-md border border-border bg-bg">
        {header}
        {text ? <p className="whitespace-pre-line px-3 pb-2 text-sm">{text.length > 400 ? `${text.slice(0, 400)}… Ver mais` : text}</p> : null}
        {images.length > 1 ? (
          <div className="grid grid-cols-2 gap-0.5">
            {images.slice(0, 4).map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url ?? ""} alt="" className="aspect-square w-full object-cover" />
            ))}
          </div>
        ) : image}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg">
      {header}
      {image ?? <div className={clsx("flex w-full items-center justify-center bg-canvas text-xs text-text-muted", ratio)}>Sem imagem</div>}
      {format !== "story" ? (
        <p className="whitespace-pre-line px-3 py-2 text-sm">
          <span className="font-semibold">{account.username ?? account.name}</span>{" "}
          {text.length > 125 ? <>{text.slice(0, 125)}… <span className="text-text-muted">mais</span></> : text}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AIPanel({ brandId, open, onClose, mediaIds, networks, languages, text, onUse, onPickPhoto }: {
  brandId: string; open: boolean; onClose: () => void; mediaIds: string[]; networks: Network[]; languages: string[];
  text: string; onUse: (text: string, idea: string) => void; onPickPhoto: (id: string) => void;
}) {
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState(languages[0] ?? "pt-PT");
  const [result, setResult] = useState<CaptionOptions | null>(null);
  const [pending, start] = useTransition();
  const [picking, startPick] = useTransition();
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Escrever com IA" size="lg">
      <div className="flex flex-col gap-4">
        <Field label="Tema ou ideia" htmlFor="ai-idea" hint={mediaIds.length ? "A IA também olha para a primeira foto escolhida." : "Junta uma foto para a legenda falar do que se vê."}>
          <Textarea id="ai-idea" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ex.: jantares de verão no terraço, às sextas, com música ao vivo" />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Idioma" htmlFor="ai-lang" className="sm:w-48">
            <Select id="ai-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="pt-PT">Português (PT)</option>
              <option value="en-GB">Inglês (UK)</option>
              <option value="es-ES">Espanhol</option>
              <option value="fr-FR">Francês</option>
            </Select>
          </Field>
          <Button variant="primary" icon={Sparkles} loading={pending} onClick={() => start(async () => {
            const r = await aiCaptions(brandId, { idea: idea || undefined, assetIds: mediaIds, networks, language: language as "pt-PT", count: 3 });
            if (r.ok) setResult(r.data!); else toast.error(r.error);
          })}>Gerar 3 propostas</Button>
          {idea.trim() ? (
            <Button icon={Lightbulb} loading={picking} onClick={() => startPick(async () => {
              const r = await aiPickPhoto(brandId, idea);
              if (!r.ok) toast.error(r.error);
              else if (r.data) { onPickPhoto(r.data); toast.success("Foto escolhida e junta à publicação."); }
              else toast.info("Nenhuma foto da biblioteca serve para esta ideia.");
            })}>Escolher foto pela ideia</Button>
          ) : null}
        </div>
        {pending ? <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-md" />)}</div> : null}
        {result && !pending ? (
          <div className="flex flex-col gap-3">
            {result.tip ? <Alert tone="info" title="Dica">{result.tip}</Alert> : null}
            {result.options.map((o, i) => (
              <Card key={i} className="flex flex-col gap-2 p-4">
                <p className="whitespace-pre-line text-sm">{o.text}</p>
                <p className="text-xs text-accent">{o.hashtags.join(" ")}</p>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" onClick={() => { onUse(`${o.text}\n\n${o.hashtags.join(" ")}`.trim(), idea); onClose(); }}>
                    {text.trim() ? "Substituir texto" : "Usar esta"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function MediaPicker({ brandId, open, onClose, library, setLibrary, selected, onToggle }: {
  brandId: string; open: boolean; onClose: () => void; library: MediaView[]; setLibrary: (fn: (l: MediaView[]) => MediaView[]) => void;
  selected: string[]; onToggle: (id: string) => void;
}) {
  const onAdded = useCallback((v: MediaView) => { setLibrary((l) => [v, ...l]); onToggle(v.id); }, [setLibrary, onToggle]);
  const { uploads, upload, dismiss } = useUploader(brandId, onAdded);
  const ready = library.filter((m) => m.status === "ready");
  return (
    <Modal open={open} onClose={onClose} title="Escolher fotos" size="lg" footer={<Button variant="primary" onClick={onClose}>Concluído ({selected.length})</Button>}>
      <div className="flex flex-col gap-4">
        <Dropzone onFiles={upload} compact />
        <UploadList uploads={uploads} onDismiss={dismiss} />
        {ready.length === 0 ? <p className="text-sm text-text-muted">A biblioteca desta marca ainda não tem fotos.</p> : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {ready.map((m) => {
              const idx = selected.indexOf(m.id);
              return (
                <li key={m.id}>
                  <MediaTile item={m} selected={idx >= 0} order={idx >= 0 ? idx + 1 : undefined} onClick={() => onToggle(m.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function Composer({ brandId, brandName, timezone, accounts, media, initial, aiEnabled, languages }: {
  brandId: string; brandName: string; timezone: string; accounts: ComposerAccount[]; media: MediaView[];
  initial: ComposerInitial; aiEnabled: boolean; languages: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [library, setLibrary] = useState(media);
  const [baseText, setBaseText] = useState(initial.baseText);
  const [aspect, setAspect] = useState<PostAspect>(initial.aspect);
  const [mediaIds, setMediaIds] = useState<string[]>(initial.mediaIds);
  const [targets, setTargets] = useState<TargetState[]>(initial.targets);
  const [mode, setMode] = useState(initial.mode);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [idea, setIdea] = useState(initial.idea);
  const [tab, setTab] = useState<string>("base");
  const [previewId, setPreviewId] = useState<string | null>(initial.targets[0]?.accountId ?? null);
  const [picker, setPicker] = useState(false);
  const [ai, setAi] = useState(false);
  const [serverErrors, setServerErrors] = useState<TargetErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rewriting, startRewrite] = useTransition();

  const selectedMedia = mediaIds.map((id) => library.find((m) => m.id === id)).filter((m): m is MediaView => Boolean(m));
  const accountById = (id: string) => accounts.find((a) => a.id === id)!;
  const selectedNetworks = Array.from(new Set(targets.map((t) => accountById(t.accountId).network)));
  const hasInstagram = selectedNetworks.includes("instagram");

  const toggleMedia = useCallback((id: string) => {
    setMediaIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 10 ? ids : [...ids, id]));
  }, []);

  // O formato do Instagram acompanha o número de fotos (stories ficam como estão).
  useEffect(() => {
    setTargets((ts) => ts.map((t) => {
      const acc = accounts.find((a) => a.id === t.accountId);
      if (acc?.network !== "instagram" || t.format === "story") return t;
      const format = defaultFormat("instagram", mediaIds.length) as TargetState["format"];
      return t.format === format ? t : { ...t, format };
    }));
  }, [mediaIds.length, accounts]);

  const moveMedia = (i: number, dir: -1 | 1) => setMediaIds((ids) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return ids;
    const copy = [...ids];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const toggleAccount = (acc: ComposerAccount) => {
    setTargets((ts) => ts.some((t) => t.accountId === acc.id)
      ? ts.filter((t) => t.accountId !== acc.id)
      : [...ts, { accountId: acc.id, format: defaultFormat(acc.network, mediaIds.length) as TargetState["format"], textOverride: null, firstComment: null }]);
    if (!previewId) setPreviewId(acc.id);
  };
  const updateTarget = (id: string, patch: Partial<TargetState>) => setTargets((ts) => ts.map((t) => (t.accountId === id ? { ...t, ...patch } : t)));

  const localErrors = useMemo(() => {
    const out: TargetErrors = {};
    for (const t of targets) {
      const acc = accountById(t.accountId);
      const errs = validateTarget({ network: acc.network, format: t.format, text: captionFor(baseText, t.textOverride), mediaCount: mediaIds.length });
      if (!acc.active) errs.push("Esta conta precisa de ser religada.");
      if (errs.length) out[t.accountId] = errs;
    }
    return out;
  }, [targets, baseText, mediaIds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const whenError = useMemo(() => {
    if (mode !== "schedule") return null;
    const utc = zonedToUtc({ date, time }, timezone);
    if (!utc) return "Essa hora não existe nesse dia (mudança de hora) ou a data é inválida.";
    if (utc.getTime() < Date.now()) return "Essa hora já passou.";
    return null;
  }, [mode, date, time, timezone]);

  const errorsFor = (id: string) => serverErrors[id] ?? localErrors[id] ?? [];
  const blocking = mode !== "draft" && (targets.length === 0 || Object.keys(localErrors).length > 0 || Boolean(whenError));

  const submit = (m: "draft" | "schedule" | "now") => start(async () => {
    setFormError(null);
    setServerErrors({});
    const r = await submitPost(brandId, {
      postId: initial.postId, baseText, aspect, mediaIds, targets, mode: m, date, time, idea, generationMode: idea ? "idea" : "manual",
    });
    if (!r.ok) {
      setFormError(r.error);
      if (r.targetErrors) setServerErrors(r.targetErrors);
      return;
    }
    toast.success(r.message ?? "Guardado.");
    router.push(m === "draft" ? `/b/${brandId}/planner?vista=rascunhos` : `/b/${brandId}/posts/${r.data!.postId}`);
    router.refresh();
  });

  const rewrite = (action: RewriteAction) => startRewrite(async () => {
    const r = await aiRewrite(brandId, baseText, action);
    if (r.ok) { setBaseText(r.data!); toast.success("Texto atualizado."); } else toast.error(r.error);
  });

  const previewAccount = previewId && targets.some((t) => t.accountId === previewId) ? accountById(previewId) : targets[0] ? accountById(targets[0].accountId) : null;
  const previewTarget = previewAccount ? targets.find((t) => t.accountId === previewAccount.id)! : null;

  if (accounts.length === 0) {
    return (
      <Alert tone="warning" title={`${brandName} ainda não tem redes ligadas`}>
        Atribui uma Página de Facebook ou uma conta de Instagram a esta marca em <Link href="/connections" className="font-semibold underline">Ligações</Link>. Entretanto podes guardar rascunhos.
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Redes */}
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Publicar em</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Contas">
            {accounts.map((acc) => {
              const on = targets.some((t) => t.accountId === acc.id);
              return (
                <button
                  key={acc.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleAccount(acc)}
                  className={clsx(
                    "flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm",
                    on ? "border-accent bg-accent-soft text-on-accent-soft" : "border-border text-text-muted hover:bg-canvas",
                  )}
                >
                  <NetworkMark network={acc.network} size="sm" />
                  <span className="max-w-[16ch] truncate">{acc.username ? `@${acc.username}` : acc.name}</span>
                  {!acc.active ? <AlertTriangle className="size-3.5 text-danger" aria-label="Precisa de ser religada" /> : null}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Fotos */}
        <Card as="section" className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Fotos <span className="font-normal text-text-muted">({mediaIds.length}/10)</span></h2>
            <Button size="sm" icon={ImagePlus} onClick={() => setPicker(true)}>{mediaIds.length ? "Mudar fotos" : "Juntar fotos"}</Button>
          </div>
          {selectedMedia.length === 0 ? (
            <button type="button" onClick={() => setPicker(true)} className="flex w-full flex-col items-center gap-1 rounded-md border-2 border-dashed border-border px-4 py-8 text-sm text-text-muted hover:border-border-input">
              <ImagePlus className="size-6 text-text-subtle" aria-hidden />
              Escolher da biblioteca ou carregar novas
            </button>
          ) : (
            <ol className="flex gap-3 overflow-x-auto pb-1">
              {selectedMedia.map((m, i) => (
                <li key={m.id} className="relative w-28 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url ?? ""} alt={m.description ?? `Foto ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
                  <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-pill bg-accent text-[11px] font-bold text-on-accent">{i + 1}</span>
                  <button type="button" onClick={() => toggleMedia(m.id)} aria-label={`Tirar foto ${i + 1}`} className="absolute right-1.5 top-1.5 rounded-pill bg-[rgba(22,21,31,.6)] p-0.5 text-on-accent">
                    <X className="size-3.5" />
                  </button>
                  {selectedMedia.length > 1 ? (
                    <div className="mt-1 flex justify-center gap-1">
                      <button type="button" disabled={i === 0} onClick={() => moveMedia(i, -1)} aria-label="Mover para a esquerda" className="rounded-sm p-1 text-text-muted hover:bg-canvas disabled:opacity-30"><ArrowLeft className="size-3.5" /></button>
                      <button type="button" disabled={i === selectedMedia.length - 1} onClick={() => moveMedia(i, 1)} aria-label="Mover para a direita" className="rounded-sm p-1 text-text-muted hover:bg-canvas disabled:opacity-30"><ArrowRight className="size-3.5" /></button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {hasInstagram && mediaIds.length > 0 ? (
            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold text-text-muted">Recorte para o Instagram</legend>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <label key={a.value} className={clsx("cursor-pointer rounded-md border px-3 py-1.5 text-xs", aspect === a.value ? "border-accent bg-accent-soft text-on-accent-soft" : "border-border text-text-muted")}>
                    <input type="radio" name="aspect" value={a.value} checked={aspect === a.value} onChange={() => setAspect(a.value)} className="sr-only" />
                    {a.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </Card>

        {/* Texto */}
        <Card as="section" className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Texto</h2>
            {aiEnabled ? <Button size="sm" variant="primary" icon={Sparkles} onClick={() => setAi(true)}>Escrever com IA</Button> : null}
          </div>
          <div role="tablist" aria-label="Texto por rede" className="mb-3 flex flex-wrap gap-1 border-b border-border">
            {[{ id: "base", label: "Todas as redes" }, ...targets.map((t) => ({ id: t.accountId, label: accountById(t.accountId).username ? `@${accountById(t.accountId).username}` : accountById(t.accountId).name }))].map((tb) => (
              <button
                key={tb.id}
                role="tab"
                type="button"
                aria-selected={tab === tb.id}
                onClick={() => setTab(tb.id)}
                className={clsx("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold", tab === tb.id ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text")}
              >
                {tb.id !== "base" ? <NetworkMark network={accountById(tb.id).network} size="sm" /> : null}
                <span className="max-w-[14ch] truncate">{tb.label}</span>
                {tb.id !== "base" && targets.find((t) => t.accountId === tb.id)?.textOverride ? <Badge tone="accent">próprio</Badge> : null}
                {tb.id !== "base" && errorsFor(tb.id).length ? <AlertTriangle className="size-3.5 text-danger" aria-label="Com problemas" /> : null}
              </button>
            ))}
          </div>

          {tab === "base" || !targets.some((t) => t.accountId === tab) ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="base-text" className="sr-only">Texto da publicação</label>
              <Textarea id="base-text" rows={9} value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="Escreve a legenda. Podes ajustá-la por rede nos separadores acima." />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3">{selectedNetworks.map((n) => <Counter key={n} network={n} text={baseText} />)}</div>
                {aiEnabled && baseText.trim() ? (
                  <div className="flex flex-wrap gap-1" aria-label="Reescrever com IA">
                    {REWRITES.map((r) => (
                      <Button key={r.action} size="sm" variant="ghost" icon={r.icon} disabled={rewriting} onClick={() => rewrite(r.action)}>{r.label}</Button>
                    ))}
                  </div>
                ) : null}
              </div>
              {rewriting ? <p className="text-xs text-text-muted" role="status">A IA está a reescrever…</p> : null}
            </div>
          ) : (() => {
            const t = targets.find((x) => x.accountId === tab)!;
            const acc = accountById(t.accountId);
            const errs = errorsFor(t.accountId);
            return (
              <div className="flex flex-col gap-4">
                <Field label="Formato" htmlFor={`fmt-${acc.id}`}>
                  <Select id={`fmt-${acc.id}`} value={t.format} onChange={(e) => updateTarget(acc.id, { format: e.target.value as TargetState["format"] })} className="sm:w-56">
                    {FORMATS[acc.network].map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                </Field>
                <Field label={`Texto só para ${NETWORK_LABEL[acc.network]}`} htmlFor={`ovr-${acc.id}`} hint="Vazio = usa o texto de todas as redes.">
                  <Textarea id={`ovr-${acc.id}`} rows={7} value={t.textOverride ?? ""} placeholder={baseText} onChange={(e) => updateTarget(acc.id, { textOverride: e.target.value || null })} />
                </Field>
                <Counter network={acc.network} text={captionFor(baseText, t.textOverride)} />
                {t.format !== "story" ? (
                  <Field label="Primeiro comentário" htmlFor={`fc-${acc.id}`} hint="Útil para pôr hashtags fora da legenda.">
                    <Textarea id={`fc-${acc.id}`} rows={2} value={t.firstComment ?? ""} onChange={(e) => updateTarget(acc.id, { firstComment: e.target.value || null })} />
                  </Field>
                ) : null}
                {errs.length ? <Alert tone="danger">{errs.map((e) => <p key={e}>{e}</p>)}</Alert> : null}
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Coluna direita: pré-visualização e envio */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <Card as="section" className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Pré-visualização</h2>
            {targets.length > 1 ? (
              <Select aria-label="Pré-visualizar conta" value={previewAccount?.id ?? ""} onChange={(e) => setPreviewId(e.target.value)} className="h-8 w-44 text-xs">
                {targets.map((t) => <option key={t.accountId} value={t.accountId}>{NETWORK_LABEL[accountById(t.accountId).network]} · {accountById(t.accountId).username ?? accountById(t.accountId).name}</option>)}
              </Select>
            ) : null}
          </div>
          {previewAccount && previewTarget ? (
            <Preview account={previewAccount} text={captionFor(baseText, previewTarget.textOverride)} images={selectedMedia} aspect={aspect} format={previewTarget.format} />
          ) : <p className="text-sm text-text-muted">Escolhe pelo menos uma conta.</p>}
          <p className="mt-2 text-xs text-text-subtle">Aproximação. Cada rede mostra a publicação à sua maneira.</p>
        </Card>

        <Card as="section" className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold">Quando</h2>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-canvas p-1" role="radiogroup" aria-label="Quando publicar">
            {([["schedule", "Agendar"], ["now", "Agora"], ["draft", "Rascunho"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
                className={clsx("rounded-sm py-1.5 text-xs font-semibold", mode === v ? "bg-bg text-text shadow-card" : "text-text-muted")}>{l}</button>
            ))}
          </div>
          {mode === "schedule" ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <label className="sr-only" htmlFor="when-date">Data</label>
                <Input id="when-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(whenError)} />
                <label className="sr-only" htmlFor="when-time">Hora</label>
                <Input id="when-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={Boolean(whenError)} />
              </div>
              <p className={clsx("text-xs", whenError ? "text-danger" : "text-text-muted")}>{whenError ?? `Hora de ${timezone.split("/")[1]?.replace("_", " ") ?? timezone}`}</p>
            </div>
          ) : null}
          {Object.keys(localErrors).length && mode !== "draft" ? (
            <Alert tone="danger" title="Falta corrigir">
              {Object.entries(localErrors).map(([id, errs]) => <p key={id}><strong>{accountById(id).username ? `@${accountById(id).username}` : accountById(id).name}:</strong> {errs[0]}</p>)}
            </Alert>
          ) : null}
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          {mode === "draft" ? (
            <Button variant="primary" icon={Save} loading={pending} onClick={() => submit("draft")}>Guardar rascunho</Button>
          ) : mode === "now" ? (
            <Button variant="primary" icon={Send} loading={pending} disabled={blocking} onClick={() => submit("now")}>Publicar agora</Button>
          ) : (
            <Button variant="primary" icon={CalendarClock} loading={pending} disabled={blocking} onClick={() => submit("schedule")}>Agendar</Button>
          )}
          {mode !== "draft" ? <Button variant="ghost" size="sm" icon={Save} disabled={pending} onClick={() => submit("draft")}>Guardar como rascunho</Button> : null}
        </Card>
        <p className="flex items-start gap-1.5 text-xs text-text-subtle"><Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />Publica através da API oficial da Meta com a app da Purepixel.</p>
      </div>

      <MediaPicker brandId={brandId} open={picker} onClose={() => setPicker(false)} library={library} setLibrary={setLibrary} selected={mediaIds} onToggle={toggleMedia} />
      {aiEnabled ? (
        <AIPanel
          brandId={brandId}
          open={ai}
          onClose={() => setAi(false)}
          mediaIds={mediaIds}
          networks={selectedNetworks}
          languages={languages}
          text={baseText}
          onUse={(t, i) => { setBaseText(t); if (i) setIdea(i); setTab("base"); }}
          onPickPhoto={(id) => { if (!mediaIds.includes(id)) toggleMedia(id); }}
        />
      ) : null}
    </div>
  );
}
