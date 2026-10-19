"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { ImagePlus, Images, Loader2, Search, Sparkles, Trash2, Upload, X, AlertTriangle, Check } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Textarea, clsx } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import type { MediaView } from "@/lib/media-view";
import { abortUpload, analyzeNow, completeUpload, deleteAssets, prepareUploads, updateAsset } from "@/app/(app)/b/[brandId]/media/actions";

type Uploading = { key: string; name: string; progress: number; error?: string };

function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("rede"));
    xhr.send(file);
  });
}

export function useUploader(brandId: string, onAdded: (v: MediaView) => void) {
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const toast = useToast();

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const prepared = await prepareUploads(brandId, files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
    if (!prepared.ok) { toast.error(prepared.error); return; }
    const list = prepared.data ?? [];
    setUploads((u) => [...u, ...list.map((p, i) => ({ key: p.assetId ?? `${p.name}-${i}-${Date.now()}`, name: p.name, progress: 0, error: p.error }))]);
    await Promise.all(list.map(async (p, i) => {
      if (!p.assetId || !p.target) return;
      const file = files[i];
      const set = (patch: Partial<Uploading>) => setUploads((u) => u.map((x) => (x.key === p.assetId ? { ...x, ...patch } : x)));
      try {
        await putWithProgress(p.target.url, file, p.target.headers, (progress) => set({ progress }));
        set({ progress: 1 });
        const done = await completeUpload(brandId, p.assetId);
        if (!done.ok) { set({ error: done.error }); return; }
        onAdded(done.data!);
        setUploads((u) => u.filter((x) => x.key !== p.assetId));
      } catch {
        set({ error: "O envio falhou. Tenta outra vez." });
        await abortUpload(brandId, p.assetId);
      }
    }));
  }, [brandId, onAdded, toast]);

  const dismiss = (key: string) => setUploads((u) => u.filter((x) => x.key !== key));
  return { uploads, upload, dismiss };
}

export function Dropzone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
      className={clsx(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-5" : "px-6 py-10",
        over ? "border-accent bg-accent-soft" : "border-border hover:border-border-input",
      )}
    >
      <Upload className="size-6 text-text-subtle" aria-hidden />
      <p className="text-sm font-semibold">Arrasta fotos para aqui ou clica para escolher</p>
      <p className="text-xs text-text-muted">JPEG, PNG ou WebP, até 25 MB cada</p>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />
    </div>
  );
}

export function UploadList({ uploads, onDismiss }: { uploads: Uploading[]; onDismiss: (key: string) => void }) {
  if (!uploads.length) return null;
  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {uploads.map((u) => (
        <li key={u.key} className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm">
          {u.error ? <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden /> : <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{u.name}</span>
          {u.error ? <span className="text-xs text-danger">{u.error}</span> : (
            <span className="h-1.5 w-24 overflow-hidden rounded-pill bg-canvas" role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`A enviar ${u.name}`}>
              <span className="block h-full bg-accent" style={{ width: `${Math.round(u.progress * 100)}%` }} />
            </span>
          )}
          {u.error ? <button type="button" onClick={() => onDismiss(u.key)} aria-label="Fechar" className="text-text-muted"><X className="size-4" /></button> : null}
        </li>
      ))}
    </ul>
  );
}

export function MediaTile({ item, selected, order, onClick, label }: { item: MediaView; selected?: boolean; order?: number; onClick: () => void; label?: string }) {
  const disabled = item.status !== "ready";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && item.status === "processing"}
      aria-pressed={selected}
      aria-label={label ?? item.description ?? item.filename ?? "Foto"}
      className={clsx(
        "group relative aspect-square overflow-hidden rounded-md bg-canvas outline-offset-2",
        selected && "ring-2 ring-accent ring-offset-2",
      )}
    >
      {item.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
      ) : item.status === "processing" ? <span className="shimmer block size-full" /> : (
        <span className="flex size-full items-center justify-center p-2 text-xs text-danger"><AlertTriangle className="size-5" aria-hidden /></span>
      )}
      {order !== undefined ? (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-pill bg-accent text-xs font-bold text-on-accent">{order}</span>
      ) : selected ? (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-pill bg-accent text-on-accent"><Check className="size-4" aria-hidden /></span>
      ) : null}
      {item.source === "ai" ? <span className="absolute bottom-1.5 left-1.5"><Badge tone="accent">IA</Badge></span> : null}
    </button>
  );
}

function AssetDetail({ brandId, item, onClose, onChange, onDeleted }: {
  brandId: string; item: MediaView; onClose: () => void; onChange: (v: MediaView) => void; onDeleted: (id: string) => void;
}) {
  const [description, setDescription] = useState(item.description ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [saving, startSave] = useTransition();
  const [analyzing, startAnalyze] = useTransition();
  const [deleting, startDelete] = useTransition();
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title={item.filename ?? "Foto"} size="lg"
      footer={(
        <>
          <Button variant="ghost" icon={Trash2} loading={deleting} className="mr-auto text-danger" onClick={() => startDelete(async () => {
            const r = await deleteAssets(brandId, [item.id]);
            if (r.ok) { toast.success(r.message ?? "Apagada."); onDeleted(item.id); } else toast.error(r.error);
          })}>Apagar</Button>
          <Button onClick={onClose}>Fechar</Button>
          <Button variant="primary" loading={saving} onClick={() => startSave(async () => {
            const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
            const r = await updateAsset(brandId, item.id, { description: description.trim() || null, tags: tagList });
            if (r.ok) { toast.success("Guardado."); onChange({ ...item, description: description.trim() || null, tags: tagList }); } else toast.error(r.error);
          })}>Guardar</Button>
        </>
      )}
    >
      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="flex items-center justify-center rounded-md bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.url ? <img src={item.url} alt={item.description ?? ""} className="max-h-[60vh] w-auto rounded-md object-contain" /> : null}
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            {item.width && item.height ? `${item.width} × ${item.height}px · ` : ""}{item.usedIn ? `usada em ${item.usedIn} ${item.usedIn === 1 ? "publicação" : "publicações"}` : "ainda não usada"}
          </p>
          <Field label="Descrição" htmlFor="asset-desc" hint="A IA usa isto para escolher fotos e escrever legendas.">
            <Textarea id="asset-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Etiquetas" htmlFor="asset-tags" hint="Separadas por vírgulas.">
            <Input id="asset-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="piscina, verão, pôr do sol" />
          </Field>
          <Button icon={Sparkles} loading={analyzing} onClick={() => startAnalyze(async () => {
            const r = await analyzeNow(brandId, item.id);
            if (r.ok && r.data) { setDescription(r.data.description ?? ""); setTags(r.data.tags.join(", ")); onChange(r.data); toast.success("Foto analisada."); }
            else if (!r.ok) toast.error(r.error);
          })}>Descrever com IA</Button>
        </div>
      </div>
    </Modal>
  );
}

export function MediaLibrary({ brandId, initial }: { brandId: string; initial: MediaView[] }) {
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<MediaView | null>(null);
  const { uploads, upload, dismiss } = useUploader(brandId, useCallback((v: MediaView) => setItems((xs) => [v, ...xs]), []));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => (i.description ?? "").toLowerCase().includes(s) || i.tags.some((t) => t.includes(s)) || (i.filename ?? "").toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div className="flex flex-col gap-5">
      <Dropzone onFiles={upload} compact={items.length > 0} />
      <UploadList uploads={uploads} onDismiss={dismiss} />
      {items.length > 0 ? (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-text-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por etiqueta ou descrição" aria-label="Procurar fotos" className="pl-9" />
        </div>
      ) : null}
      {items.length === 0 && uploads.length === 0 ? (
        <EmptyState icon={Images} title="A biblioteca está vazia">Junta as fotos desta marca. Ficam guardadas aqui para usares em qualquer publicação.</EmptyState>
      ) : filtered.length === 0 && q ? (
        <EmptyState icon={ImagePlus} title="Nenhuma foto encontrada">Experimenta outra palavra.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {filtered.map((item) => (
            <li key={item.id}>
              <MediaTile item={item} onClick={() => setOpen(item)} />
              {item.status === "failed" ? <p className="mt-1 text-xs text-danger">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <AssetDetail
          key={open.id}
          brandId={brandId}
          item={open}
          onClose={() => setOpen(null)}
          onChange={(v) => setItems((xs) => xs.map((x) => (x.id === v.id ? { ...x, ...v, url: x.url } : x)))}
          onDeleted={(id) => { setItems((xs) => xs.filter((x) => x.id !== id)); setOpen(null); }}
        />
      ) : null}
    </div>
  );
}
