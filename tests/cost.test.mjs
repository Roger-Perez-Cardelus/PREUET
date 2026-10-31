import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, DATA } from "./harness.mjs";

// A tiny catalogue so the expected totals can be worked out by hand.
function mini() {
  const d = JSON.parse(JSON.stringify(DATA));
  d.meta.updated = "2026-10-26";
  d.products = [
    { id: "llet", cat: "lactics", ca: "Llet", es: "Leche", unit: "l", ref: 1, ref_ca: "1 L", ref_es: "1 L", kind: "classe" },
    { id: "oli", cat: "rebost", ca: "Oli", es: "Aceite", unit: "l", ref: 1, ref_ca: "1 L", ref_es: "1 L", kind: "classe" },
    { id: "poma", cat: "fruita", ca: "Poma", es: "Manzana", unit: "kg", ref: 1, ref_ca: "1 kg", ref_es: "1 kg", kind: "classe" },
  ];
  const o = (p, c, name, size, price) => ({ p, c, name, size, price, up: price / size, promo: "", src: null, date: "2026-10-26", st: "web", desde: false, bk: "mb", rank: 0 });
  d.offerings = [
    o("llet", "dia", "Llet 1 L", 1, 1.0), o("llet", "dia", "Llet pack 6 × 1 L", 6, 5.4),
    o("llet", "mercadona", "Llet 1,5 L", 1.5, 1.2),
    o("oli", "dia", "Oli 5 L", 5, 20), o("oli", "mercadona", "Oli 1 L", 1, 6),
    o("poma", "dia", "Poma granel", 1, 2), o("poma", "mercadona", "Poma malla 2 kg", 2, 3),
  ];
  d.recipes = []; d.templates = []; d.offers = [];
  return d;
}

test("a line costs whole packs, not a share of the pack", () => {
  const app = loadApp({ data: mini(), today: "2026-10-28" });
  const l = app.itemAt("llet", 1, "mercadona", { brand: "any", fresh: true });
  assert.equal(l.packs, 1);
  assert.equal(l.cost, 1.2);               // you pay the whole 1.5 L bottle
  assert.equal(Math.round(l.use * 100), 80); // the litre you need is worth 0.80
});

test("the cheapest option at the till wins, and a multipack wins when you need many", () => {
  const app = loadApp({ data: mini(), today: "2026-10-28" });
  const opt = { brand: "any", fresh: true };
  assert.equal(app.itemAt("llet", 2, "dia", opt).cost, 2.0);
  assert.equal(app.itemAt("llet", 6, "dia", opt).cost, 5.4);
  const l = app.itemAt("llet", 7, "dia", opt); // 6-pack + one bottle beats 7 bottles (7.00) and two 6-packs (10.80)
  assert.equal(Math.round(l.cost * 100), 640);
  assert.equal(l.parts.length, 2);
});

test("big packs are paid whole and flagged", () => {
  const app = loadApp({ data: mini(), today: "2026-10-28" });
  const l = app.itemAt("oli", 1, "dia", { brand: "any", fresh: true });
  assert.equal(l.cost, 20);
  assert.equal(l.big, true);
});

test("loose produce is paid by weight, bagged produce per bag", () => {
  const app = loadApp({ data: mini(), today: "2026-10-28" });
  const opt = { brand: "any", fresh: true };
  const a = app.itemAt("poma", 1, "dia", opt), b = app.itemAt("poma", 1, "mercadona", opt);
  assert.equal(a.loose, true); assert.equal(a.cost, 2);
  assert.equal(b.loose, false); assert.equal(b.cost, 3);
});

test("the basket ranking follows what you pay", () => {
  const app = loadApp({ data: mini(), today: "2026-10-28" });
  const cmp = app.compareBasket([{ p: "llet", n: 1 }, { p: "oli", n: 1 }, { p: "poma", n: 1 }], ["dia", "mercadona"], { brand: "any", fresh: true, estimate: false });
  const tot = Object.fromEntries(cmp.rows.map(r => [r.cid, Math.round(r.total * 100) / 100]));
  assert.deepEqual(tot, { dia: 23, mercadona: 10.2 });
  assert.equal(cmp.best.cid, "mercadona");
});

test("templates: every total equals the sum of whole packs on the receipt", () => {
  const app = loadApp({ today: "2026-10-28" });
  const X = app.X;
  for (const tp of X.T) {
    const items = tp.items.map(([p, n]) => ({ p, n }));
    const cmp = app.compareBasket(items, X.D.chains.map(c => c.id), { brand: "any", fresh: true, estimate: false });
    for (const r of cmp.rows) {
      const sumLines = r.lines.reduce((s, l) => s + (l ? (l.loose ? l.q * l.o.up : l.parts.reduce((a, x) => a + x.n * x.o.price, 0)) : 0), 0);
      assert.ok(Math.abs(sumLines - r.total) < 1e-6, tp.id + " " + r.cid);
    }
  }
});

test("the price index stays in a sane range", () => {
  const app = loadApp({ today: "2026-10-28" });
  for (const [cid, g] of app.X.gidx) assert.ok(g.idx >= 100 && g.idx < 200, cid + " " + g.idx);
});

test("community prices: plausible ones are used, odd ones wait for a second report", () => {
  const app = loadApp({ today: "2026-10-28" });
  const X = app.X;
  const pid = "llet-sencera";
  const ref = X.byP.get(pid).map(o => o.up).sort((a, b) => a - b);
  const mid = ref[Math.floor(ref.length / 2)];
  const now = Date.now();
  const item = (id, uid, price) => ({ t: "price", id, uid, ts: now - 1000, p: pid, c: "condis", price, size: 1, town: "" });
  app.set("community", [item("a", "u1", Math.round(mid * 100) / 100)]);
  assert.ok(app.commPrices().has(pid + "|condis"));
  app.set("community", [item("b", "u1", mid * 5)]);
  assert.ok(!app.commPrices().has(pid + "|condis"));
  app.set("community", [item("b", "u1", mid * 5), item("c", "u2", mid * 5 * 1.05)]);
  assert.ok(app.commPrices().has(pid + "|condis"));
});

test("backup code round-trips the basket and preferences", () => {
  const app = loadApp({ today: "2026-10-28" });
  const u = app.cleanUser({ basket: [{ p: "llet-sencera", n: 3 }], town: "Gavà", diets: ["sg"], nick: "Núria" });
  const code = app.backupCode(u);
  assert.match(code, /^PREUET1\.[A-Za-z0-9_-]+$/);
  const back = app.readBackup("  " + code + "\n");
  assert.equal(back.town, "Gavà"); assert.equal(back.nick, "Núria");
  assert.deepEqual(JSON.parse(JSON.stringify(back.basket)), [{ p: "llet-sencera", n: 3 }]);
  assert.equal(app.readBackup("PREUET1.!!!"), null);
});
