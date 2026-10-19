import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { encrypt, decrypt } from "@/lib/crypto";
import { graphGet, GraphError } from "@/lib/meta/graph";

type PageNode = {
  id: string;
  name: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
};

type Paged<T> = { data: T[]; paging?: { next?: string } };

export type SyncResult = { pages: number; instagram: number; lost: number };

/**
 * Lê todas as Páginas (e contas IG ligadas) a que o token do System User tem acesso
 * e guarda-as em social_accounts. Contas que deixaram de aparecer ficam needs_reconnect.
 * Não mexe na marca atribuída a contas que já existiam.
 */
export async function syncMetaAccounts(workspaceId: string): Promise<SyncResult> {
  const token = env.metaSystemUserToken();
  if (!token) throw new Error("Falta META_SYSTEM_USER_TOKEN nas variáveis de ambiente.");

  const pages: PageNode[] = [];
  let next: string | undefined = "me/accounts";
  let params: Record<string, string> = {
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
    limit: "100",
  };
  while (next) {
    const res: Paged<PageNode> = await graphGet<Paged<PageNode>>(next, token, params);
    pages.push(...res.data);
    next = res.paging?.next;
    params = {};
  }

  const seen: string[] = [];
  let instagram = 0;
  const now = new Date();

  for (const page of pages) {
    if (!page.access_token) continue; // sem tarefa de criação de conteúdo nesta Página
    const tokenEnc = encrypt(page.access_token);
    const fbId = await upsertAccount(workspaceId, {
      network: "facebook",
      externalId: page.id,
      displayName: page.name,
      username: null,
      avatarUrl: page.picture?.data?.url ?? null,
      pageExternalId: page.id,
    }, tokenEnc, now);
    seen.push(fbId);

    const ig = page.instagram_business_account;
    if (ig) {
      const igId = await upsertAccount(workspaceId, {
        network: "instagram",
        externalId: ig.id,
        displayName: ig.name || ig.username || page.name,
        username: ig.username ?? null,
        avatarUrl: ig.profile_picture_url ?? null,
        pageExternalId: page.id,
      }, tokenEnc, now);
      seen.push(igId);
      instagram++;
    }
  }

  const lostRows = await db.update(schema.socialAccounts)
    .set({ status: "needs_reconnect", lastError: "Deixou de estar acessível ao System User da Meta.", lastCheckedAt: now })
    .where(and(
      eq(schema.socialAccounts.workspaceId, workspaceId),
      eq(schema.socialAccounts.status, "active"),
      seen.length ? notInArray(schema.socialAccounts.id, seen) : undefined,
    ))
    .returning({ id: schema.socialAccounts.id });

  return { pages: pages.filter((p) => p.access_token).length, instagram, lost: lostRows.length };
}

async function upsertAccount(
  workspaceId: string,
  a: { network: "facebook" | "instagram"; externalId: string; displayName: string; username: string | null; avatarUrl: string | null; pageExternalId: string },
  tokenEnc: string,
  now: Date,
): Promise<string> {
  const [row] = await db.insert(schema.socialAccounts)
    .values({ workspaceId, ...a, status: "active", lastCheckedAt: now })
    .onConflictDoUpdate({
      target: [schema.socialAccounts.workspaceId, schema.socialAccounts.network, schema.socialAccounts.externalId],
      set: { displayName: a.displayName, username: a.username, avatarUrl: a.avatarUrl, pageExternalId: a.pageExternalId, status: "active", lastError: null, lastCheckedAt: now },
    })
    .returning({ id: schema.socialAccounts.id });
  await db.insert(schema.socialAccountSecrets)
    .values({ socialAccountId: row.id, accessTokenEnc: tokenEnc })
    .onConflictDoUpdate({ target: schema.socialAccountSecrets.socialAccountId, set: { accessTokenEnc: tokenEnc, updatedAt: now } });
  return row.id;
}

export async function accountToken(socialAccountId: string): Promise<string> {
  const [row] = await db.select().from(schema.socialAccountSecrets)
    .where(eq(schema.socialAccountSecrets.socialAccountId, socialAccountId)).limit(1);
  if (!row) throw new Error("Esta conta não tem token. Sincroniza as contas da Meta outra vez.");
  return decrypt(row.accessTokenEnc);
}

/** Verifica se cada token ainda funciona. Corre todos os dias. */
export async function healthcheckAccounts(): Promise<{ checked: number; broken: number }> {
  const accounts = await db.select().from(schema.socialAccounts)
    .where(inArray(schema.socialAccounts.status, ["active", "needs_reconnect"]));
  let broken = 0;
  for (const acc of accounts) {
    try {
      const token = await accountToken(acc.id);
      await graphGet(acc.externalId, token, { fields: "id" });
      await db.update(schema.socialAccounts).set({ status: "active", lastError: null, lastCheckedAt: new Date() })
        .where(eq(schema.socialAccounts.id, acc.id));
    } catch (e) {
      if (e instanceof GraphError && !e.isAuth) continue; // falha temporária: tenta amanhã
      broken++;
      await markNeedsReconnect(acc.id, acc.workspaceId, e instanceof Error ? e.message : String(e));
    }
  }
  return { checked: accounts.length, broken };
}

export async function markNeedsReconnect(accountId: string, workspaceId: string, message: string) {
  const [prev] = await db.select({ status: schema.socialAccounts.status, name: schema.socialAccounts.displayName })
    .from(schema.socialAccounts).where(eq(schema.socialAccounts.id, accountId));
  await db.update(schema.socialAccounts)
    .set({ status: "needs_reconnect", lastError: message, lastCheckedAt: new Date() })
    .where(eq(schema.socialAccounts.id, accountId));
  if (prev?.status === "active") {
    await db.insert(schema.notifications).values({
      workspaceId, kind: "account_needs_reconnect", payload: { accountId, name: prev.name, message },
    });
  }
}
