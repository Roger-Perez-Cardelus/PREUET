import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApp } from "./harness.mjs";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

test("every literal t(\"key\") exists, in Catalan and Spanish", () => {
  const app = loadApp();
  const missing = [];
  for (const f of fs.readdirSync(SRC).filter(n => n.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(SRC, f), "utf8");
    for (const m of code.matchAll(/\b(?:t|ca)\("([a-z0-9_]+)"(?!\s*\+)/g)) if (!app.STR[m[1]]) missing.push(f + ": " + m[1]);
  }
  assert.deepEqual(missing, []);
});

test("both languages are filled in and agree on placeholders and plural forms", () => {
  const app = loadApp();
  const bad = [];
  for (const [k, v] of Object.entries(app.STR)) {
    if (!Array.isArray(v) || v.length !== 2 || !v[0] || !v[1]) { bad.push(k + ": missing a language"); continue; }
    const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
    if (ph(v[0]) !== ph(v[1])) bad.push(k + ": placeholders differ");
    if (v[0].split("|").length !== v[1].split("|").length) bad.push(k + ": plural forms differ");
  }
  assert.deepEqual(bad, []);
});
