import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { InviteForm, RemoveButton } from "./client";

export const metadata = { title: "Equipa" };

const ROLE = { owner: "Dono", admin: "Administrador", member: "Membro" } as const;

export default async function TeamPage() {
  const user = await requireUser();
  const isAdmin = user.role !== "member";
  const members = await db.select({ id: schema.profiles.id, email: schema.profiles.email, name: schema.profiles.fullName, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers).innerJoin(schema.profiles, eq(schema.profiles.id, schema.workspaceMembers.userId))
    .where(eq(schema.workspaceMembers.workspaceId, user.workspaceId)).orderBy(asc(schema.profiles.email));
  const invites = await db.select().from(schema.workspaceInvites)
    .where(and(eq(schema.workspaceInvites.workspaceId, user.workspaceId), isNull(schema.workspaceInvites.acceptedAt), gt(schema.workspaceInvites.expiresAt, new Date())))
    .orderBy(asc(schema.workspaceInvites.email));
  return (
    <>
      <PageHeader title="Equipa" description="Quem pode entrar na Social Purepixel. Todos os membros veem todas as marcas." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Membros ({members.length})</h2>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.name ?? m.email}</p>
                  {m.name ? <p className="truncate text-xs text-text-muted">{m.email}</p> : null}
                </div>
                <Badge tone={m.role === "member" ? "neutral" : "accent"}>{ROLE[m.role]}</Badge>
                {isAdmin && m.id !== user.id && m.role !== "owner" ? <RemoveButton userId={m.id} email={m.email} /> : null}
              </li>
            ))}
          </ul>
          {invites.length ? (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Convites pendentes</h3>
              <ul className="divide-y divide-border">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <Badge>{ROLE[i.role]}</Badge>
                    {isAdmin ? <RemoveButton inviteId={i.id} email={i.email} /> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
        {isAdmin ? (
          <Card as="section" className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Convidar</h2>
            <p className="mb-4 text-xs text-text-muted">A pessoa entra com este email através do link de login. O convite dura 14 dias.</p>
            <InviteForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
