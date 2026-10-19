import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { AppShell, type ShellBrand } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const rows = await db.select({
    id: schema.brands.id,
    name: schema.brands.name,
    color: schema.brands.color,
    broken: sql<number>`(select count(*) from social_accounts sa where sa.brand_id = ${schema.brands.id} and sa.status = 'needs_reconnect')`.mapWith(Number),
  }).from(schema.brands)
    .where(and(eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt)))
    .orderBy(asc(schema.brands.name));
  const brands: ShellBrand[] = rows.map((b) => ({ id: b.id, name: b.name, color: b.color, alert: b.broken > 0 }));
  return (
    <AppShell brands={brands} user={{ email: user.email, name: user.name ?? null, role: user.role }}>
      {children}
    </AppShell>
  );
}
