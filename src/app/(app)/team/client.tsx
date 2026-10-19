"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import type { ActionResult } from "@/lib/validation";
import { inviteMember, removeMember, revokeInvite } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(inviteMember, null);
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) { toast.success(state.message ?? "Convite criado."); form.current?.reset(); }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = state && !state.ok ? state.fieldErrors?.email ?? state.error : null;
  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="inv-email" error={err}>
        <Input id="inv-email" name="email" type="email" required aria-invalid={Boolean(err)} />
      </Field>
      <Field label="Papel" htmlFor="inv-role" hint="Administradores ligam contas e gerem a equipa.">
        <Select id="inv-role" name="role" defaultValue="member">
          <option value="member">Membro</option>
          <option value="admin">Administrador</option>
        </Select>
      </Field>
      <Button type="submit" variant="primary" icon={UserPlus} loading={pending}>Convidar</Button>
    </form>
  );
}

export function RemoveButton({ userId, inviteId, email }: { userId?: string; inviteId?: string; email: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button size="sm" variant="ghost" icon={X} loading={pending} aria-label={`Remover ${email}`} onClick={() => start(async () => {
      if (!confirm(`Remover ${email}?`)) return;
      const r = userId ? await removeMember(userId) : await revokeInvite(inviteId!);
      if (r.ok) toast.success(r.message ?? "Removido."); else toast.error(r.error);
    })} />
  );
}
