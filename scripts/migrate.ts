// Aplica as migrações SQL de db/migrations por ordem, uma vez cada.
// Uso: DATABASE_URL=postgres://... npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definido");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.resolve(import.meta.dirname, "../db/migrations");

try {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into _migrations (name) values (${file})`;
    });
    console.log(`aplicada ${file}`);
  }
  console.log("migrações em dia");
} finally {
  await sql.end();
}
