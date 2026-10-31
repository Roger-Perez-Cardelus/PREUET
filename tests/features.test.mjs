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
