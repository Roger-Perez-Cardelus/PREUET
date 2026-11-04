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
// a hang must fail the run, not keep it going for hours
const watchdog = setTimeout(() => { console.error("smoke: timed out (still at " + current + ")\n" + errors.join("\n")); process.exit(1); }, 180000);
let current = "start";
const step = async (name, fn) => {
  current = name; console.log("· " + name);
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
// Plus: the offers tab shows the offer first; asking for Plus records the answer and unlocks it (nothing is charged)
await step("07-plus-gate", async () => {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Ofertes|^Ofertas/ }).click();
  await page.locator(".plus-gate").waitFor();
  if (await page.locator("article.offer-card").count()) throw new Error("offers shown without Plus");
  await page.getByRole("button", { name: /Descobreix Preuet Plus/ }).click();
  await page.getByRole("radio", { name: /Mensual/ }).click();
  await page.getByRole("button", { name: /^2,00/ }).click();
});
await step("07b-plus-join", async () => {
  await page.getByRole("button", { name: /Vull Preuet Plus/ }).click();
  await page.getByText(/encara no cobra/).waitFor();
  await page.waitForFunction(() => { const u = JSON.parse(localStorage.getItem("preuet:user:v1") || "{}"); return u.plus && u.plus.on; });
  const pl = await page.evaluate(() => JSON.parse(localStorage.getItem("preuet:user:v1")).plus);
  if (!pl.on || pl.plan !== "month" || pl.wtp !== 2 || pl.from !== "offers" || pl.views.offers !== 1) throw new Error("Plus answer not saved: " + JSON.stringify(pl));
  await page.getByRole("button", { name: /^Continua/ }).click();
});
await step("07c-offers", async () => {
  await page.locator("article.offer-card").first().waitFor();
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

// keyboard only: open a product sheet, Tab stays inside it, the page behind is inert, Esc closes it and the focus comes back
await step("09b-keyboard", async () => {
  await page.getByRole("button", { name: /^Inici|^Inicio/ }).click();
  await page.locator(".cat-btn").first().waitFor();
  const opener = page.locator(".cat-btn").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await page.locator(".sheet").last().waitFor();
  const row = page.locator(".sheet .list .li button.grow").first();
  await row.focus();
  await page.keyboard.press("Enter");
  await page.locator(".sheet h1").waitFor();
  await page.waitForTimeout(600); // let the photo, the price history and the comments load
  const inTop = () => page.evaluate(() => { const s = document.querySelectorAll("#app > .sheet"); return s[s.length - 1].contains(document.activeElement); });
  for (let i = 0; i < 60; i++) { // checked after every key, so one gap in the trap is enough to fail
    await page.keyboard.press(i % 7 === 6 ? "Shift+Tab" : "Tab");
    await page.waitForTimeout(5);
    if (!(await inTop())) throw new Error("Tab left the open sheet after " + (i + 1) + " keys");
  }
  const inert = await page.evaluate(() => document.querySelector("#app > main").inert && document.querySelectorAll("#app > .sheet")[0].inert);
  if (!inert) throw new Error("the page behind the sheet is not inert");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const back = await page.evaluate(() => document.activeElement && document.activeElement.matches(".sheet .list .li button.grow"));
  if (!back) throw new Error("focus did not return to the row that opened the sheet");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const home = await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("cat-btn"));
  if (!home) throw new Error("focus did not return to the category button");
});

// location + nearby shops, with OpenStreetMap answered by a fixed sample
const geo = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block",
  geolocation: { latitude: 41.2795, longitude: 1.9762 }, permissions: ["geolocation"] });
const gp = await geo.newPage();
gp.setDefaultTimeout(8000);
gp.on("pageerror", e => errors.push("page (geo): " + e.message));
gp.on("console", m => { if (m.type() === "error") errors.push("console (geo): " + m.text()); });
await gp.route("https://overpass-api.de/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elements: [
  { type: "node", lat: 41.2801, lon: 1.9790, tags: { shop: "supermarket", brand: "Mercadona", name: "Mercadona", "addr:street": "Carrer de prova", "addr:housenumber": "1" } },
  { type: "way", center: { lat: 41.2900, lon: 1.9900 }, tags: { shop: "supermarket", name: "Lidl" } },
  { type: "node", lat: 41.2810, lon: 1.9770, tags: { shop: "convenience", name: "Fruites Paco" } },
] }) }));
await gp.addInitScript(() => localStorage.setItem("preuet:user:v1", JSON.stringify({ onboarded: true, updated: 1, town: "Barcelona", plus: { on: true } })));
await step.call(null, "10-nearby", async () => {
  await gp.goto(base + "#mes");
  await gp.getByText(/^Supermercats/).first().click();
  await gp.locator(".sheet .list .li", { hasText: "Mercadona" }).first().click();
  await gp.getByRole("button", { name: /Fes servir la meva ubicació/ }).first().click();
  await gp.getByText("Carrer de prova 1").waitFor();
  const town = (await gp.locator(".topbar .pill-btn").innerText()).trim();
  if (town !== "Castelldefels") throw new Error("town from location: " + town);
  if (SHOTS) await gp.screenshot({ path: path.join(SHOTS, "10-nearby.png") });
});
await geo.close();

// team mode against a stand-in Supabase: the server checks the code, then the team panel shows the totals
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const tp = await ctx.newPage();
  tp.setDefaultTimeout(8000);
  tp.on("pageerror", e => errors.push("page (team): " + e.message));
  tp.on("console", m => { if (m.type() === "error" && !/status of 400/.test(m.text())) errors.push("console (team): " + m.text()); });
  await tp.route("**/config.js", r => r.fulfill({ contentType: "text/javascript",
    body: 'window.PREUET_CONFIG = { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "sb_publishable_test", supabaseJs: "vendor/supabase-js-2.117.1.umd.js" };' }));
  const now = Math.floor(Date.now() / 1000);
  const session = { access_token: "a.b.c", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r",
    user: { id: "11111111-1111-1111-1111-111111111111", aud: "authenticated", role: "authenticated", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
  const stats = { users: 47, active7: 31, seen: 29, joined: 9, no: 14, wtp_avg: 1.8, wtp: { 0: 6, 2: 9 }, plans: { month: 6, year: 3 }, views: { offers: 21, recipes: 12 }, from: { offers: 4 }, contrib: 128, contrib7: { stock: 12 }, tests: 6 };
  await tp.route("https://test.supabase.co/**", r => {
    const p = new URL(r.request().url()).pathname;
    if (p === "/rest/v1/rpc/list_tests" && JSON.parse(r.request().postData() || "{}").team_key !== "codi-de-prova")
      return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "28000", message: "Codi d'equip incorrecte" }) });
    const body = p.startsWith("/auth/v1/") ? session : p === "/rest/v1/rpc/team_stats" ? stats : p === "/rest/v1/rpc/preuet_schema" ? 3
      : p === "/rest/v1/rpc/is_admin" ? false : p.startsWith("/rest/v1/user_state") && r.request().method() === "GET" ? null : [];
    return r.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await tp.routeWebSocket(/supabase\.co/, () => {});
  await tp.addInitScript(() => { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x", "1"); localStorage.setItem("preuet:user:v1", JSON.stringify({ onboarded: true, updated: 1 })); } });
  await step.call(null, "11-team", async () => {
    await tp.goto(base + "#mes");
    if (await tp.getByText(/^Mode prova/).count()) throw new Error("test mode listed without the team code");
    await tp.goto(base + "#equip");
    await tp.locator("#tm-code").fill("un-altre-codi");
    await tp.getByRole("button", { name: "Entra" }).click();
    await tp.getByText("Aquest codi no és correcte.").waitFor();
    await tp.locator("#tm-code").fill("codi-de-prova");
    await tp.getByRole("button", { name: "Entra" }).click();
    await tp.locator(".kpi", { hasText: "Persones" }).getByText("47").waitFor();
    if (SHOTS) await tp.screenshot({ path: path.join(SHOTS, "11-team.png") });
    await tp.keyboard.press("Escape");
    await tp.getByText(/^Mode prova/).first().waitFor();
    await tp.getByRole("button", { name: /^Ofertes|^Ofertas/ }).click();
    await tp.locator("article.offer-card").first().waitFor(); // Plus is open on a team phone
  });
  await ctx.close();
}

if (process.env.AXE) {
  const axePath = require.resolve("axe-core/axe.min.js", { paths: [process.cwd(), ROOT] });
  const ax = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", bypassCSP: true });
  await ax.addInitScript(() => localStorage.setItem("preuet:user:v1", JSON.stringify({ onboarded: true, updated: 1, basket: [{ p: "llet-semi", n: 2 }, { p: "ous-m", n: 1 }, { p: "macarrons", n: 1 }, { p: "platan-canaries", n: 1 }] })));
  await ax.goto(base + "#cistella");
  await ax.locator(".receipt").waitFor();
  await ax.addScriptTag({ path: axePath });
  const res = await ax.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag22aa"] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, eg: v.nodes.slice(0, 3).map(n => n.target.join(" ")) })));
  for (const v of res) console.log(`axe ${v.impact} ${v.id} (${v.n}): ${v.help} — ${v.eg.join(" | ")}`);
  if (res.some(v => v.impact === "critical" || v.impact === "serious")) errors.push("axe: serious or critical accessibility issues");
}

await browser.close();
server.close();
clearTimeout(watchdog);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("smoke: ok");
process.exit(0); // open connections (the stand-in Supabase socket) must not keep the run alive
