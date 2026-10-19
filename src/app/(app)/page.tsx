import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export default async function Home() {
  const user = await requireUser();
  const [first] = await db.select({ id: schema.brands.id }).from(schema.brands)
    .where(and(eq(schema.brands.workspaceId, user.workspaceId), isNull(schema.brands.archivedAt)))
    .orderBy(asc(schema.brands.name)).limit(1);
  redirect(first ? `/b/${first.id}/planner` : "/brands");
}
