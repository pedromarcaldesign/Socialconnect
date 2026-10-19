"use client";

import { useActionState, useEffect } from "react";
import { Button, Field, Input, Select, Textarea, Alert } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { TIMEZONES, type ActionResult } from "@/lib/validation";
import type { Brand } from "@/lib/db/schema";

const COLORS = ["#5a3ff0", "#1b62d4", "#1d7a4e", "#9a5b00", "#c22f3b", "#c1356f", "#16151f", "#0e7490"];

export function BrandForm({ action, brand, submitLabel, onDone, compact }: {
  action: (state: unknown, form: FormData) => Promise<ActionResult<{ id: string }> | ActionResult>;
  brand?: Partial<Brand>;
  submitLabel: string;
  onDone?: (result: ActionResult<{ id: string }>) => void;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null as ActionResult<{ id: string }> | ActionResult | null);
  const toast = useToast();
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onDone?.(state as ActionResult<{ id: string }>);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok && !Object.keys(fe).length ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Nome" htmlFor="brand-name" error={fe.name}>
        <Input id="brand-name" name="name" required maxLength={80} defaultValue={brand?.name ?? ""} placeholder="Ex.: Hotel Atlântico" aria-invalid={Boolean(fe.name)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fuso horário" htmlFor="brand-tz" hint="As horas de publicação usam este fuso." error={fe.timezone}>
          <Select id="brand-tz" name="timezone" defaultValue={brand?.timezone ?? "Europe/Lisbon"}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Cor no calendário</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="color" value={c} defaultChecked={(brand?.color ?? COLORS[0]) === c} className="peer sr-only" />
                <span className="block size-7 rounded-pill ring-offset-2 peer-checked:ring-2 peer-checked:ring-focus peer-focus-visible:ring-2 peer-focus-visible:ring-focus" style={{ backgroundColor: c }} />
                <span className="sr-only">{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {!compact ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site" htmlFor="brand-website" error={fe.website}>
              <Input id="brand-website" name="website" type="text" inputMode="url" defaultValue={brand?.website ?? ""} placeholder="hotelatlantico.pt" />
            </Field>
            <Field label="Localização" htmlFor="brand-location" error={fe.location}>
              <Input id="brand-location" name="location" defaultValue={brand?.location ?? ""} placeholder="Cascais" />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="brand-description" hint="Usada pela IA para escrever sobre a marca." error={fe.description}>
            <Textarea id="brand-description" name="description" rows={4} defaultValue={brand?.description ?? ""} />
          </Field>
          <Field label="Destaques e comodidades" htmlFor="brand-amenities" hint="Separados por vírgulas." error={fe.amenities}>
            <Input id="brand-amenities" name="amenities" defaultValue={brand?.amenities?.join(", ") ?? ""} placeholder="Piscina, Spa, Restaurante com vista de mar" />
          </Field>
        </>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>{submitLabel}</Button>
      </div>
    </form>
  );
}
