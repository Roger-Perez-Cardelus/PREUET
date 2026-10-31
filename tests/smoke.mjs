// End-to-end smoke test of the built web version (dist/web): opens it on a phone-sized screen, goes through the main
// screens and fails on any console error or uncaught exception. Supabase is switched off so it runs offline.
//   python3 tools/build.py web && node tests/smoke.mjs [--shots DIR]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = await import("playwright")); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist/web");
const shotsAt = process.argv.indexOf("--shots");
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === "/config.js") body = "window.PREUET_CONFIG = {};"; // offline: local mode
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(body);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
page.setDefaultTimeout(8000);
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", e => errors.push("page: " + e.message));
const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: false }); } };
const step = async (name, fn) => {
  try { await fn(); await page.waitForTimeout(150); await shot(name); }
  catch (e) { errors.push(name + ": " + e.message.split("\n")[0]); await shot(name + "-error"); }
};

await step("01-onboarding", async () => {
  await page.goto(base);
  await page.getByRole("dialog").waitFor();
});
await step("02-home", async () => {
  await page.getByRole("button", { name: /Ara no|Ahora no/ }).click();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
});
await step("03-basket", async () => {
  await page.locator(".tpl").first().click();
  await page.locator(".receipt").waitFor();
});
await step("04-receipt", async () => {
  await page.locator(".receipt").scrollIntoViewIfNeeded();
  const total = await page.locator(".rtotal").first().evaluate(el => el.textContent);
  if (!/\d+,\d\d\s€/.test(total)) throw new Error("no total on the receipt: " + total);
});
await step("05-product", async () => {
  await page.locator(".list .li button.grow").first().click();
  await page.locator(".sheet h1").waitFor();
});
await step("06-product-bottom", async () => {
  await page.locator(".sheet-body").evaluate(el => el.scrollTo(0, 1600));
});
await step("07-offers", async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Ofertes|^Ofertas/ }).click();
  await page.locator("article.card").first().waitFor();
});
await step("08-recipes", async () => {
  await page.getByRole("button", { name: /^Receptes|^Recetas/ }).click();
  await page.locator(".list .li").first().click();
  await page.locator(".sheet h1").waitFor();
});
await step("09-more", async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Més|^Más/ }).click();
  await page.locator(".list .li").first().waitFor();
});

if (process.env.AXE) {
  const axePath = require.resolve("axe-core/axe.min.js", { paths: [process.cwd(), ROOT] });
  await page.goto(base + "#cistella");
  await page.addScriptTag({ path: axePath });
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, eg: v.nodes.slice(0, 3).map(n => n.target.join(" ")) })));
  for (const v of res) console.log(`axe ${v.impact} ${v.id} (${v.n}): ${v.help} — ${v.eg.join(" | ")}`);
  if (res.some(v => v.impact === "critical" || v.impact === "serious")) errors.push("axe: serious or critical accessibility issues");
}

await browser.close();
server.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("smoke: ok");
