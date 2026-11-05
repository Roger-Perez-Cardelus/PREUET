import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./harness.mjs";

test("nearest town from coordinates, and nothing far from the AMB", () => {
  const app = loadApp();
  assert.equal(app.nearestTown([41.281, 1.979]), "Castelldefels");
  assert.equal(app.nearestTown([41.3887, 2.1590]), "Barcelona");
  assert.equal(app.nearestTown([41.9794, 2.8214]), null); // Girona
});

test("OpenStreetMap shops map to chains", () => {
  const app = loadApp();
  assert.equal(app.chainOfShop({ brand: "Mercadona" }), "mercadona");
  assert.equal(app.chainOfShop({ name: "Esclat" }), "bonpreu");
  assert.equal(app.chainOfShop({ brand: "Dia", name: "Dia %" }), "dia");
  assert.equal(app.chainOfShop({ name: "Carrefour Express" }), "carrefour");
  assert.equal(app.chainOfShop({ brand: "bonÀrea" }), "bonarea");
  assert.equal(app.chainOfShop({ name: "Diagonal Market" }), null);
  assert.equal(app.chainOfShop({ name: "Fruites Paco" }), null);
});

test("shared basket links survive the round trip and drop unknown products", () => {
  const app = loadApp();
  const items = app.parseBasketHash("#c=" + encodeURIComponent("llet-sencera*2,no-existeix*1,ous-m*120"));
  assert.deepEqual(JSON.parse(JSON.stringify(items)), [{ p: "llet-sencera", n: 2 }, { p: "ous-m", n: 99 }]);
  assert.equal(app.parseBasketHash("#cistella"), null);
});

test("savings and ticket accuracy", () => {
  const app = loadApp({ today: "2026-10-28" });
  const st = app.savingsStats([
    { id: "a", date: "2026-10-05", cid: "dia", n: 10, k: 10, est: 20, worst: 25, paid: 21 },
    { id: "b", date: "2026-09-30", cid: "dia", n: 10, k: 10, est: 30, worst: 33, paid: null },
  ]);
  assert.equal(st.month, 4);
  assert.equal(st.total, 7);
  assert.equal(st.nChecked, 1);
  assert.equal(Math.round(st.acc), 5);
});

test("healthier swaps only when the data says so", () => {
  const app = loadApp();
  const sw = app.healthySwaps([{ p: "llet-sencera", n: 2 }, { p: "coca-cola", n: 1 }, { p: "arros-rodo", n: 1 }, { p: "corn-flakes", n: 1 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(sw.map(s => [s.from, s.to, s.n]))), [["llet-sencera", "llet-semi", 2], ["coca-cola", "aigua-gas", 2], ["corn-flakes", "flocs-civada", 1]]);
  assert.equal(sw[0].gains[0].k, "sat");
  // nothing to offer when the healthier product is already in the basket
  assert.equal(app.healthySwaps([{ p: "llet-sencera", n: 1 }, { p: "llet-semi", n: 1 }]).length, 0);
});

test("shops without any product price are hidden, with their promotions", () => {
  const app = loadApp();
  const ids = app.X.D.chains.map(c => c.id);
  assert.ok(ids.length > 0 && app.X.D.chains.every(c => c.n_products > 0));
  assert.ok(app.X.D.offers.every(o => ids.includes(o.c)));
  assert.ok(app.X.C.has("condis")); // still known, for old community reports
});

test("a periodic purchase with bad fields is repaired instead of hanging the app", () => {
  const app = loadApp({ today: "2026-11-05" });
  const u = app.cleanUser({ schedules: [{ id: "s1", name: "x", items: [{ p: "llet-semi", n: 1 }], freq: "week", start: "ahir" }] });
  const s = u.schedules[0];
  assert.equal(s.freq, "w");
  assert.equal(s.dow, 1);
  assert.equal(s.start, "2026-11-05");
});
