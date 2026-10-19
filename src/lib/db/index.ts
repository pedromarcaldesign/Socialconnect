import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "@/lib/env";

// Uma ligação por processo (reaproveitada entre hot reloads em dev).
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

function client() {
  if (!globalForDb.pgClient) {
    // prepare:false para funcionar atrás do pooler do Supabase (modo transaction)
    globalForDb.pgClient = postgres(env.databaseUrl(), { max: 5, prepare: false, onnotice: () => {} });
  }
  return globalForDb.pgClient;
}

export const db = drizzle({ client: client(), schema });
export type DB = typeof db;
export { schema };
