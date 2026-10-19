import Link from "next/link";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { Building2, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Card, EmptyState, NetworkMark, PageHeader, Badge } from "@/components/ui";
import { BrandAvatar } from "@/components/app-shell";
import { NewBrandButton } from "./new-brand";
import type { Network } from "@/lib/db/schema";

export const metadata = { title: "Marcas" };

export default async function BrandsPage() {
  const user = await requireUser();
  const brands = await db.select({
    id: schema.brands.id, name: schema.brands.name, color: schema.brands.color, location: schema.brands.location,
    scheduled: sql<number>`(select count(*) from posts p where p.brand_id = ${schema.brands.id} and p.status = 'scheduled')`.mapWith(Number),
    media: sql<number>`(select count(*) from media_assets m where m.brand_id = ${schema.brands.id} and m.deleted_at is null)`.mapWith(Number),
  }).from(schema.brands)
    .where(and(eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt)))
    .orderBy(asc(schema.brands.name));
  const accounts = await db.select({ brandId: schema.socialAccounts.brandId, network: schema.socialAccounts.network, status: schema.socialAccounts.status })
    .from(schema.socialAccounts).where(eq(schema.socialAccounts.workspaceId, user.workspaceId));

  return (
    <>
      <PageHeader title="Marcas" description="Cada marca tem as suas redes, a sua biblioteca de fotos e o seu calendário." actions={<NewBrandButton />} />
      {brands.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="Ainda não há marcas" action={<NewBrandButton />}>
            Cria a primeira marca (por exemplo, um hotel) e depois liga-lhe as contas de Instagram e Facebook.
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => {
            const mine = accounts.filter((a) => a.brandId === b.id);
            const broken = mine.some((a) => a.status === "needs_reconnect");
            return (
              <li key={b.id}>
                <Link href={`/b/${b.id}/planner`} className="block rounded-lg focus-visible:outline-2">
                  <Card className="flex h-full flex-col gap-4 p-5 hover:border-border-input">
                    <div className="flex items-center gap-3">
                      <BrandAvatar name={b.name} color={b.color} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{b.name}</p>
                        {b.location ? <p className="truncate text-xs text-text-muted">{b.location}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {mine.length === 0 ? <Badge>Sem redes ligadas</Badge> : mine.map((a, i) => <NetworkMark key={i} network={a.network as Network} />)}
                      {broken ? <Badge tone="danger"><AlertTriangle className="size-3" aria-hidden /> Religar conta</Badge> : null}
                    </div>
                    <p className="mt-auto text-xs text-text-muted">{b.scheduled} agendadas · {b.media} fotos</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
