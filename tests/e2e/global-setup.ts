import postgres from "postgres";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Base de dados limpa e uma foto de teste antes de cada corrida.
export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/purepixel";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`truncate workspaces, profiles, brands, social_accounts, media_assets, posts, ai_generations, notifications cascade`;
  await sql.end();
  await fetch(`${process.env.MOCK_GRAPH_URL ?? "http://localhost:4010"}/__reset`);
  await mkdir("tests/e2e/fixtures", { recursive: true });
  await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 40, g: 120, b: 200 } } })
    .composite([{ input: Buffer.from('<svg width="1600" height="1200"><circle cx="800" cy="600" r="300" fill="#f5c542"/></svg>') }])
    .jpeg().toFile("tests/e2e/fixtures/piscina.jpg");
  await sharp({ create: { width: 1200, height: 1500, channels: 3, background: { r: 200, g: 80, b: 60 } } })
    .png().toFile("tests/e2e/fixtures/terraco.png");
}
