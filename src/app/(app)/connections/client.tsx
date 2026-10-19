"use client";

import { useTransition } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Badge, Button, NetworkMark, Select } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import type { AccountStatus, Network } from "@/lib/db/schema";
import { assignAccount, syncAccounts } from "./actions";

export function SyncButton() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="primary"
      icon={RefreshCw}
      loading={pending}
      onClick={() => start(async () => {
        const r = await syncAccounts();
        if (r.ok) toast.success(r.message ?? "Sincronizado.");
        else toast.error(r.error);
      })}
    >
      Sincronizar com a Meta
    </Button>
  );
}

export function AccountRow({ account, brands, canEdit }: {
  account: { id: string; network: Network; displayName: string; username: string | null; avatarUrl: string | null; status: AccountStatus; lastError: string | null; brandId: string | null };
  brands: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const selectId = `assign-${account.id}`;
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatarUrl} alt="" className="size-10 shrink-0 rounded-pill bg-canvas object-cover" />
        ) : <span className="size-10 shrink-0 rounded-pill bg-canvas" aria-hidden />}
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <NetworkMark network={account.network} size="sm" />
            <span className="truncate">{account.displayName}</span>
          </p>
          <p className="truncate text-xs text-text-muted">
            {account.network === "instagram" ? "Instagram" : "Página de Facebook"}{account.username ? ` · @${account.username}` : ""}
          </p>
          {account.status === "needs_reconnect" ? (
            <p className="mt-1 flex items-start gap-1 text-xs text-danger">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {account.lastError ?? "Precisa de ser religada."}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:w-72">
        {account.status === "needs_reconnect" ? <Badge tone="danger">Religar</Badge> : <Badge tone="success">Ativa</Badge>}
        <label htmlFor={selectId} className="sr-only">Marca de {account.displayName}</label>
        <Select
          id={selectId}
          disabled={!canEdit || pending}
          value={account.brandId ?? ""}
          onChange={(e) => {
            const value = e.target.value || null;
            start(async () => {
              const r = await assignAccount(account.id, value);
              if (r.ok) toast.success(r.message ?? "Guardado.");
              else toast.error(r.error);
            });
          }}
        >
          <option value="">Sem marca</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>
    </li>
  );
}
