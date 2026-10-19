"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, RotateCcw, Trash2, CalendarX } from "lucide-react";
import { Button, Field, Select, buttonClass } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import type { PostStatus } from "@/lib/db/schema";
import { cancelPost, deletePost, duplicatePost, retryFailedTargets } from "../actions";

export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);
  return active ? <p className="sr-only" role="status">A publicar. Esta página atualiza sozinha.</p> : null;
}

export function PostActions({ brandId, postId, status, otherBrands }: { brandId: string; postId: string; status: PostStatus; otherBrands: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [dup, setDup] = useState(false);
  const [dest, setDest] = useState(brandId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = ["draft", "scheduled", "failed", "cancelled"].includes(status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(r.message ?? "Feito."); after?.(); router.refresh(); } else toast.error(r.error ?? "Erro.");
  });

  return (
    <>
      {editable ? <Link href={`/b/${brandId}/compose?post=${postId}`} className={buttonClass("secondary")}><Pencil className="size-4" aria-hidden />Editar</Link> : null}
      {status === "scheduled" ? <Button icon={CalendarX} loading={pending} onClick={() => run(() => cancelPost(brandId, postId))}>Cancelar agendamento</Button> : null}
      {status === "failed" || status === "partial" ? <Button variant="primary" icon={RotateCcw} loading={pending} onClick={() => run(() => retryFailedTargets(brandId, postId))}>Tentar outra vez</Button> : null}
      <Button icon={Copy} onClick={() => setDup(true)}>Duplicar</Button>
      {["draft", "cancelled", "failed"].includes(status) ? <Button variant="ghost" icon={Trash2} className="text-danger" onClick={() => setConfirmDelete(true)}>Apagar</Button> : null}

      <Modal open={dup} onClose={() => setDup(false)} title="Duplicar publicação" size="sm" footer={(
        <>
          <Button onClick={() => setDup(false)}>Cancelar</Button>
          <Button variant="primary" loading={pending} onClick={() => start(async () => {
            const r = await duplicatePost(brandId, postId, dest);
            if (r.ok) { toast.success(r.message ?? "Duplicada."); router.push(`/b/${r.data!.brandId}/compose?post=${r.data!.postId}`); } else toast.error(r.error);
          })}>Duplicar</Button>
        </>
      )}>
        <Field label="Para que marca?" htmlFor="dup-dest" hint={dest !== brandId ? "Noutra marca copia só o texto. Escolhes lá as fotos e as redes." : "Copia texto, fotos e redes como rascunho."}>
          <Select id="dup-dest" value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value={brandId}>Esta marca</option>
            {otherBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Apagar publicação?" size="sm" footer={(
        <>
          <Button onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" loading={pending} onClick={() => run(() => deletePost(brandId, postId), () => router.push(`/b/${brandId}/planner`))}>Apagar</Button>
        </>
      )}>
        <p className="text-sm">Esta ação não se pode desfazer. As fotos continuam na biblioteca.</p>
      </Modal>
    </>
  );
}
