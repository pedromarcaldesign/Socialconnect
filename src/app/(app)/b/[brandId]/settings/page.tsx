import { eq } from "drizzle-orm";
import { requireBrand } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/service";
import { Alert, Card, PageHeader } from "@/components/ui";
import { BrandSettings } from "./client";

export const metadata = { title: "Marca e voz" };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { brandId } = await params;
  const { nova } = await searchParams;
  const { brand, user } = await requireBrand(brandId);
  const [voice] = await db.select().from(schema.brandVoices).where(eq(schema.brandVoices.brandId, brand.id));
  const accounts = await db.select({ id: schema.socialAccounts.id }).from(schema.socialAccounts).where(eq(schema.socialAccounts.brandId, brand.id));
  return (
    <>
      <PageHeader title="Marca e voz" description="O que a IA sabe sobre esta marca e como deve escrever." />
      <div className="flex flex-col gap-6">
        {nova ? (
          <Alert tone="success" title={`${brand.name} foi criada`}>
            Próximos passos: preenche o perfil (ou deixa a IA lê-lo do site), atribui as contas em Ligações e junta fotos à Biblioteca.
          </Alert>
        ) : null}
        {accounts.length === 0 ? (
          <Alert tone="info">Esta marca ainda não tem redes ligadas. {user.role !== "member" ? <a className="font-semibold underline" href="/connections">Atribuir contas</a> : "Pede a um administrador para atribuir as contas."}</Alert>
        ) : null}
        <Card className="p-5 md:p-6">
          <BrandSettings
            brand={JSON.parse(JSON.stringify(brand))}
            voice={voice ? JSON.parse(JSON.stringify(voice)) : null}
            aiEnabled={aiConfigured()}
            canArchive={user.role !== "member"}
          />
        </Card>
      </div>
    </>
  );
}
