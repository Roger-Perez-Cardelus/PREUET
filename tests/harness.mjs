// Loads the app modules (without the boot code) into a sandbox so tests can call them.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/preuet-data.json"), "utf8"));

export function loadApp({ data = DATA, today } = {}) {
  const order = fs.readFileSync(path.join(ROOT, "src/_order.txt"), "utf8").split("\n").map(s => s.trim())
    .filter(n => n && n !== "00_wrap_open.js" && n !== "main.js");
  const code = order.map(n => fs.readFileSync(path.join(ROOT, "src", n), "utf8")).join("\n");
  const noop = () => {};
  const hook = () => [undefined, noop];
  const store = new Map();
  const ctx = {
    console: { log: noop, warn: noop, error: console.error },
    htmPreact: { html: () => null, render: noop, h: noop, createContext: noop, useState: v => [v, noop], useEffect: noop, useLayoutEffect: noop,
      useMemo: f => f(), useRef: () => ({ current: null }), useCallback: f => f, useContext: noop, useReducer: hook, useErrorBoundary: () => [null, noop] },
    window: {}, document: { documentElement: {}, body: { classList: { toggle: noop }, style: {} } },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    navigator: {}, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Intl, URL, TextEncoder, TextDecoder, btoa, atob,
  };
  if (today) {
    const fixed = new Date(today + "T12:00:00").getTime();
    ctx.Date = class extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  }
  vm.createContext(ctx);
  vm.runInContext(code + "\n;globalThis.__app = { get X() { return X; }, get S() { return S; }, Store, indexData, cleanUser, defaultUser, " +
    "itemAt, compareBasket, commPriceCheck, officialRef, globalIndex, minPrice, recipeBest, recipeAt, packText, commPrices, isLoose, t, STR, LANGS, " +
    "set: (k, v) => { S[k] = v; }, setLang: l => { LANG = l; } };", ctx, { filename: "app.js" });
  const app = ctx.__app;
  app.indexData(JSON.parse(JSON.stringify(data)));
  app.set("user", app.cleanUser(null));
  return app;
}
