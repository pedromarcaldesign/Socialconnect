// Captura de ecrã rápida: node tests/e2e/shot.mjs <url> <ficheiro> [largura]
import { chromium } from "@playwright/test";
const [url, out, width = "1440"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
if (errors.length) console.log("console errors:", errors);
await browser.close();
