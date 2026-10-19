import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { SyncButton, AccountRow } from "./client";

export const metadata = { title: "Ligações" };

export default async function ConnectionsPage() {
  const user = await requireUser();
  const isAdmin = user.role !== "member";
  const configured = Boolean(env.metaSystemUserToken());
  const accounts = await db.select().from(schema.socialAccounts)
    .where(and(eq(schema.socialAccounts.workspaceId, user.workspaceId), ne(schema.socialAccounts.status, "removed")))
    .orderBy(asc(schema.socialAccounts.displayName), asc(schema.socialAccounts.network));
  const brands = await db.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands)
    .where(and(eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt)))
    .orderBy(asc(schema.brands.name));
  const unassigned = accounts.filter((a) => !a.brandId).length;

  return (
    <>
      <PageHeader
        title="Ligações"
        description="Páginas de Facebook e contas de Instagram a que a app da Purepixel na Meta tem acesso. Atribui cada uma à marca certa."
        actions={isAdmin && configured ? <SyncButton /> : null}
      />
      <div className="flex flex-col gap-4">
        {!configured ? (
          <Alert tone="warning" title="A ligação à Meta ainda não está configurada">
            Falta a variável <code>META_SYSTEM_USER_TOKEN</code>. Cria a app da Meta e o System User no Business Manager e gera o token
            (passo a passo no README, secção &quot;Meta&quot;). Depois carrega em &quot;Sincronizar com a Meta&quot;.
          </Alert>
        ) : null}
        {unassigned > 0 ? <Alert tone="info">{unassigned} {unassigned === 1 ? "conta ainda não está atribuída" : "contas ainda não estão atribuídas"} a nenhuma marca.</Alert> : null}
        <Card>
          {accounts.length === 0 ? (
            <EmptyState icon={Link2} title="Nenhuma conta encontrada">
              {configured
                ? "Carrega em \"Sincronizar com a Meta\" para ir buscar as Páginas e contas de Instagram do Business Manager."
                : "Assim que o token estiver configurado, as contas aparecem aqui."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  account={{ id: a.id, network: a.network, displayName: a.displayName, username: a.username, avatarUrl: a.avatarUrl, status: a.status, lastError: a.lastError, brandId: a.brandId }}
                  brands={brands}
                  canEdit={isAdmin}
                />
              ))}
            </ul>
          )}
        </Card>
        {brands.length === 0 && accounts.length > 0 ? <Alert tone="info">Cria primeiro uma marca para poderes atribuir as contas.</Alert> : null}
      </div>
    </>
  );
}
