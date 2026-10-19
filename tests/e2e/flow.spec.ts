import { test, expect, type Page } from "@playwright/test";

const MOCK = process.env.MOCK_GRAPH_URL ?? "http://localhost:4010";
type LogEntry = { method: string; path: string; params: Record<string, string>; token: string };
const graphLog = async (): Promise<LogEntry[]> => (await fetch(`${MOCK}/__log`)).json();

let brandUrl = "";

async function waitForPostStatus(page: Page, label: string) {
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe.serial("fluxo principal", () => {
  test("criar marca", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/brands$/);
    await expect(page.getByText("Ainda não há marcas")).toBeVisible();
    await page.getByRole("button", { name: "Nova marca" }).first().click();
    await page.getByLabel("Nome").fill("Hotel Atlântico");
    await page.getByRole("button", { name: "Criar marca" }).click();
    await expect(page).toHaveURL(/\/b\/[0-9a-f-]+\/settings\?nova=1/);
    await expect(page.getByText("Hotel Atlântico foi criada")).toBeVisible();
    brandUrl = page.url().replace(/\/settings.*$/, "");
  });

  test("sincronizar contas da Meta e atribuir à marca", async ({ page }) => {
    await page.goto("/connections");
    await page.getByRole("button", { name: "Sincronizar com a Meta" }).click();
    await expect(page.getByText("2 Páginas de Facebook e 1 contas de Instagram encontradas.")).toBeVisible();
    const selects = page.getByLabel("Marca de Hotel Atlântico");
    await expect(selects).toHaveCount(2);
    for (const i of [0, 1]) {
      await selects.nth(i).selectOption({ label: "Hotel Atlântico" });
      await expect(page.getByText("Conta atribuída.").first()).toBeVisible();
    }
    // o token da Página nunca é enviado para o browser
    expect(await page.content()).not.toContain("page-token-1");
  });

  test("carregar fotos para a biblioteca", async ({ page }) => {
    await page.goto(`${brandUrl}/media`);
    await page.locator('input[type="file"]').setInputFiles(["tests/e2e/fixtures/piscina.jpg", "tests/e2e/fixtures/terraco.png"]);
    await expect(page.locator("main ul li > button")).toHaveCount(2);
  });

  test("publicar já no Instagram e no Facebook", async ({ page }) => {
    await page.goto(`${brandUrl}/compose`);
    await expect(page.getByRole("checkbox", { name: /@hotelatlantico/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("checkbox", { name: /Hotel Atlântico/ }).last()).toHaveAttribute("aria-checked", "true");

    // Instagram sem imagem não pode publicar
    await page.getByRole("radio", { name: "Agora" }).click();
    await expect(page.getByText("O Instagram precisa de pelo menos uma imagem.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar agora" })).toBeDisabled();

    await page.getByRole("button", { name: "Juntar fotos" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("button[aria-pressed]").first().click();
    await dialog.getByRole("button", { name: /Concluído/ }).click();
    await page.getByLabel("Texto da publicação").fill("Fim de tarde na piscina ☀️ Reserva já a tua escapadinha. #verao #cascais");
    await page.getByRole("button", { name: "Publicar agora" }).click();

    await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
    await waitForPostStatus(page, "Publicado");
    await expect(page.getByRole("link", { name: /Ver na rede/ })).toHaveCount(2);

    const log = await graphLog();
    const igContainer = log.find((l) => l.path === "ig1/media");
    expect(igContainer?.params.caption).toContain("Fim de tarde na piscina");
    expect(igContainer?.token).toBe("page-token-1");
    expect(log.some((l) => l.path === "ig1/media_publish")).toBe(true);
    expect(log.some((l) => l.path === "p1/photos" && l.params.caption?.includes("#verao"))).toBe(true);
  });

  test("agendar um carrossel e vê-lo no planner", async ({ page }) => {
    await page.goto(`${brandUrl}/compose`);
    await page.getByRole("button", { name: "Juntar fotos" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("button[aria-pressed]").nth(0).click();
    await dialog.locator("button[aria-pressed]").nth(1).click();
    await dialog.getByRole("button", { name: /Concluído \(2\)/ }).click();
    await page.getByLabel("Texto da publicação").fill("Dois espaços, uma estadia.");
    // separador do Instagram: o formato passou a carrossel sozinho
    await page.getByRole("tab", { name: /@hotelatlantico/ }).click();
    await expect(page.getByLabel("Formato")).toHaveValue("carousel");
    await page.getByLabel("Primeiro comentário").fill("#hotel #portugal");
    const d = new Date(Date.now() + 3 * 86400_000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await page.getByLabel("Data").fill(date);
    await page.getByLabel("Hora").fill("18:30");
    await page.getByRole("button", { name: "Agendar" }).click();
    await expect(page).toHaveURL(/\/posts\//);
    await expect(page.getByText(/Agendada para/)).toBeVisible();

    await page.goto(`${brandUrl}/planner?mes=${date.slice(0, 7)}`);
    await expect(page.getByRole("link", { name: /18:30 Agendado: Dois espaços/ })).toBeVisible();
  });

  test("falha no Instagram: publicação parcial e conta a religar", async ({ page }) => {
    await fetch(`${MOCK}/__fail?target=instagram&code=190`);
    await page.goto(`${brandUrl}/compose`);
    await page.getByRole("button", { name: "Juntar fotos" }).click();
    await page.getByRole("dialog").locator("button[aria-pressed]").first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Concluído/ }).click();
    await page.getByLabel("Texto da publicação").fill("Teste de falha");
    await page.getByRole("radio", { name: "Agora" }).click();
    await page.getByRole("button", { name: "Publicar agora" }).click();
    await waitForPostStatus(page, "Publicado em parte");
    await expect(page.getByText(/A Meta recusou o acesso a esta conta/)).toBeVisible();
    await fetch(`${MOCK}/__reset`);

    await page.goto("/connections");
    await expect(page.getByText("Religar", { exact: true })).toBeVisible();
  });
});

test.describe.serial("agendamento", () => {
  test("um post agendado sai à hora marcada, e um cancelado não", async ({ page, request }) => {
    const { default: postgres } = await import("postgres");
    const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres@localhost:5499/purepixel", { max: 1, onnotice: () => {} });
    try {
      // O teste anterior deixou o Instagram "a religar": sincronizar outra vez reativa a conta.
      await page.goto("/connections");
      await page.getByRole("button", { name: "Sincronizar com a Meta" }).click();
      await expect(page.getByText("Ativa", { exact: true })).toHaveCount(3);
      // O carrossel agendado no teste anterior passa a ter a hora já vencida.
      const [carousel] = await sql`select id from posts where base_text = 'Dois espaços, uma estadia.'`;
      await sql`update posts set scheduled_at = now() - interval '1 minute' where id = ${carousel.id}`;
      // Um segundo post agendado e depois cancelado (volta a rascunho) não pode sair.
      const [brand] = await sql`select id from brands limit 1`;
      const [cancelled] = await sql`insert into posts (brand_id, base_text, status) values (${brand.id}, 'cancelado', 'draft') returning id`;

      await fetch(`${MOCK}/__reset`);
      const res = await request.post("/api/cron/due", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` } });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.results).toEqual([{ id: carousel.id, status: "published" }]);

      const log = await graphLog();
      expect(log.filter((l) => l.path === "ig1/media" && l.params.is_carousel_item === "true")).toHaveLength(2);
      expect(log.find((l) => l.params.media_type === "CAROUSEL")?.params.children?.split(",")).toHaveLength(2);
      expect(log.some((l) => l.path.endsWith("/comments") && l.params.message === "#hotel #portugal")).toBe(true);
      expect(log.filter((l) => l.path === "p1/photos" && l.params.published === "false")).toHaveLength(2);

      // Correr outra vez não volta a publicar nada.
      const again = await (await request.post("/api/cron/due", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron-secret"}` } })).json();
      expect(again.ran).toBe(0);
      const [still] = await sql`select status from posts where id = ${cancelled.id}`;
      expect(still.status).toBe("draft");
    } finally {
      await sql.end();
    }
  });

  test("sem segredo, o cron recusa", async ({ request }) => {
    const res = await request.post("/api/cron/due");
    expect(res.status()).toBe(401);
  });
});

test.describe.serial("IA (API simulada)", () => {
  const AI = process.env.MOCK_ANTHROPIC_URL ?? "http://localhost:4020";
  type AILog = { beta?: string; model: string; fallbacks: unknown; effort?: string; format?: string; hasImage: boolean };

  test("fotos novas são descritas e etiquetadas", async ({ page }) => {
    await page.goto(`${brandUrl}/media`);
    await page.locator('input[type="file"]').setInputFiles(["tests/e2e/fixtures/piscina.jpg"]);
    await expect(page.locator("main ul li > button")).toHaveCount(3);
    await page.waitForTimeout(1500); // a análise corre em segundo plano
    await page.reload();
    await page.locator("main ul li > button").first().click();
    await expect(page.getByLabel("Descrição")).toHaveValue("Piscina exterior com um grande sol amarelo.");
    await expect(page.getByLabel("Etiquetas")).toHaveValue(/piscina, sol/);
  });

  test("gerar legenda e reescrever no compositor", async ({ page }) => {
    await page.goto(`${brandUrl}/compose`);
    await page.getByRole("button", { name: "Juntar fotos" }).click();
    await page.getByRole("dialog").locator("button[aria-pressed]").first().click();
    await page.getByRole("dialog").getByRole("button", { name: /Concluído/ }).click();
    await page.getByRole("button", { name: "Escrever com IA" }).click();
    await page.getByLabel("Tema ou ideia").fill("tardes de verão na piscina");
    await page.getByRole("button", { name: "Gerar 3 propostas" }).click();
    await expect(page.getByRole("button", { name: "Usar esta" })).toHaveCount(3);
    await page.getByRole("button", { name: "Usar esta" }).first().click();
    await expect(page.getByLabel("Texto da publicação")).toHaveValue(/Reserva já o teu lugar ao sol ☀️\n\n#cascais #verao$/);

    await page.getByRole("button", { name: "Encurtar" }).click();
    await expect(page.getByLabel("Texto da publicação")).toHaveValue("Texto reescrito pela IA.");

    const log: AILog[] = await (await fetch(`${AI}/__log`)).json();
    expect(log.length).toBeGreaterThanOrEqual(3);
    for (const call of log) {
      expect(call.model).toBe("claude-opus-5-5");
      expect(call.fallbacks).toBe("default");
      expect(call.beta).toContain("server-side-fallback-2026-07-01");
      expect(call.format).toBe("json_schema");
    }
    expect(log.some((c) => c.hasImage && c.effort === "medium")).toBe(true); // legenda com a foto
  });

  test("ler site recusa endereços internos", async ({ page }) => {
    await page.goto(`${brandUrl}/settings`);
    await page.getByLabel("Site da marca").fill("http://localhost:3000");
    await page.getByRole("button", { name: "Ler site" }).click();
    await expect(page.getByText("Não foi possível abrir esse site.")).toBeVisible();
  });
});

test.describe("páginas legais", () => {
  test("privacidade e eliminação de dados abrem e ligam-se entre si", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { name: "Política de privacidade", level: 1 })).toBeVisible();
    await page.getByRole("article").getByRole("link", { name: "Eliminação de dados" }).click();
    await expect(page).toHaveURL(/\/eliminacao-de-dados$/);
    await expect(page.getByRole("heading", { name: "Como pedir a eliminação" })).toBeVisible();
  });
});
