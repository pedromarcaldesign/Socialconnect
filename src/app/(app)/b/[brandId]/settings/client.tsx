"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Archive, Globe, Sparkles } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { BrandForm } from "@/components/brand-form";
import type { Brand, BrandVoice } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/validation";
import type { BrandProfileOut } from "@/lib/ai/service";
import { archiveBrand, updateBrand } from "@/app/(app)/brands/actions";
import { applyProfile, fillFromWebsite, saveVoice } from "./actions";

const LANGS = [
  { value: "pt-PT", label: "Português (PT)" },
  { value: "en-GB", label: "Inglês (UK)" },
  { value: "es-ES", label: "Espanhol" },
  { value: "fr-FR", label: "Francês" },
];

function VoiceForm({ brandId, voice }: { brandId: string; voice: BrandVoice | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveVoice.bind(null, brandId), null);
  const toast = useToast();
  useEffect(() => { if (state?.ok) toast.success(state.message ?? "Guardado."); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  const examples = [...(voice?.examplePosts ?? []), "", "", ""].slice(0, 3);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Tom de escrita" htmlFor="v-tone" hint="Ex.: elegante e caloroso, sem exageros; trata o leitor por tu." error={fe.tone}>
        <Input id="v-tone" name="tone" required defaultValue={voice?.tone ?? "profissional e acolhedor"} />
      </Field>
      <Field label="Público-alvo" htmlFor="v-aud">
        <Input id="v-aud" name="audience" defaultValue={voice?.audience ?? ""} placeholder="Casais em escapadinha, famílias no verão, viajantes de negócios" />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Idiomas das legendas</legend>
        <div className="flex flex-wrap gap-4">
          {LANGS.map((l) => (
            <label key={l.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="languages" value={l.value} defaultChecked={(voice?.languages ?? ["pt-PT"]).includes(l.value)} className="size-4 accent-accent" />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Palavras-chave" htmlFor="v-kw" hint="Separadas por vírgulas.">
        <Input id="v-kw" name="keywords" defaultValue={voice?.keywords.join(", ") ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fazer sempre" htmlFor="v-dos" hint="Uma regra por linha.">
          <Textarea id="v-dos" name="dos" rows={4} defaultValue={voice?.dos.join("\n") ?? ""} placeholder="Mencionar a vista de mar" />
        </Field>
        <Field label="Nunca fazer" htmlFor="v-donts" hint="Uma regra por linha.">
          <Textarea id="v-donts" name="donts" rows={4} defaultValue={voice?.donts.join("\n") ?? ""} placeholder="Usar a palavra 'barato'" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Posts de exemplo</legend>
        <p className="text-xs text-text-muted">Até três legendas de que gostas. A IA segue o estilo, sem copiar.</p>
        {examples.map((e, i) => (
          <Textarea key={i} name="examplePosts" rows={3} defaultValue={e} aria-label={`Exemplo ${i + 1}`} />
        ))}
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>Guardar voz</Button>
      </div>
    </form>
  );
}

function WebsiteFill({ brandId, website, aiEnabled }: { brandId: string; website: string | null; aiEnabled: boolean }) {
  const [url, setUrl] = useState(website ?? "");
  const [proposal, setProposal] = useState<BrandProfileOut | null>(null);
  const [pending, start] = useTransition();
  const [applying, startApply] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!aiEnabled) return <Alert tone="info">Configura a IA (ANTHROPIC_API_KEY) para preencher o perfil a partir do site.</Alert>;
  return (
    <div className="flex flex-col gap-3 rounded-md bg-accent-soft p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-on-accent-soft"><Sparkles className="size-4" aria-hidden /> Preencher a partir do site</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="fill-url" className="sr-only">Site da marca</label>
        <Input id="fill-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="hotelatlantico.pt" />
        <Button icon={Globe} loading={pending} disabled={!url.trim()} onClick={() => start(async () => {
          const r = await fillFromWebsite(brandId, url);
          if (r.ok) setProposal(r.data!); else toast.error(r.error);
        })}>Ler site</Button>
      </div>
      <Modal open={Boolean(proposal)} onClose={() => setProposal(null)} title="Proposta da IA" footer={(
        <>
          <Button onClick={() => setProposal(null)}>Cancelar</Button>
          <Button loading={applying} onClick={() => startApply(async () => {
            const r = await applyProfile(brandId, proposal!, false);
            if (r.ok) { toast.success("Campos vazios preenchidos."); setProposal(null); router.refresh(); } else toast.error(r.error);
          })}>Só preencher o que está vazio</Button>
          <Button variant="primary" loading={applying} onClick={() => startApply(async () => {
            const r = await applyProfile(brandId, proposal!, true);
            if (r.ok) { toast.success("Perfil substituído."); setProposal(null); router.refresh(); } else toast.error(r.error);
          })}>Substituir tudo</Button>
        </>
      )}>
        {proposal ? (
          <dl className="grid gap-3 text-sm">
            {([
              ["Descrição", proposal.description], ["Localização", proposal.location], ["Destaques", proposal.amenities.join(", ")],
              ["Tom", proposal.tone], ["Público", proposal.audience], ["Palavras-chave", proposal.keywords.join(", ")],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-text-muted">{v || "—"}</dd></div>
            ))}
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}

export function BrandSettings({ brand, voice, aiEnabled, canArchive }: { brand: Brand; voice: BrandVoice | null; aiEnabled: boolean; canArchive: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [archiving, start] = useTransition();
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="perfil" className="flex flex-col gap-4">
        <h2 id="perfil" className="text-lg font-semibold">Perfil</h2>
        <WebsiteFill brandId={brand.id} website={brand.website} aiEnabled={aiEnabled} />
        <BrandForm key={brand.updatedAt?.toString()} action={updateBrand.bind(null, brand.id)} brand={brand} submitLabel="Guardar perfil" onDone={() => router.refresh()} />
      </section>
      <section aria-labelledby="voz" className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 id="voz" className="text-lg font-semibold">Voz da marca</h2>
        <VoiceForm key={voice?.updatedAt?.toString() ?? "new"} brandId={brand.id} voice={voice} />
      </section>
      {canArchive ? (
        <section aria-labelledby="arquivar" className="flex flex-col items-start gap-2 border-t border-border pt-8">
          <h2 id="arquivar" className="text-lg font-semibold">Arquivar marca</h2>
          <p className="text-sm text-text-muted">A marca sai das listas, as contas ficam livres e as publicações agendadas são canceladas.</p>
          <Button variant="danger" icon={Archive} onClick={() => setConfirm(true)}>Arquivar {brand.name}</Button>
          <Modal open={confirm} onClose={() => setConfirm(false)} title="Arquivar marca?" size="sm" footer={(
            <>
              <Button onClick={() => setConfirm(false)}>Cancelar</Button>
              <Button variant="danger" loading={archiving} onClick={() => start(async () => {
                const r = await archiveBrand(brand.id);
                if (r.ok) { toast.success("Marca arquivada."); router.push("/brands"); } else toast.error(r.error);
              })}>Arquivar</Button>
            </>
          )}>
            <p className="text-sm">As publicações agendadas de {brand.name} vão ser canceladas.</p>
          </Modal>
        </section>
      ) : null}
    </div>
  );
}
