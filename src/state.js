/* ===== state.js ===== */
/* ---------- app state (one store, one root subscriber) ---------- */
const S = {
  ready: false, tab: "inici", sheets: [], user: null, community: [], profiles: {}, tests: {},
  toast: null, test: null, q: "", copyFallback: null, mode: "local",
};
const RENDER = new Set();
function set(patch) { Object.assign(S, typeof patch === "function" ? patch(S) : patch); RENDER.forEach(f => f()); }
let toastTimer = null;
function toast(msg) { clearTimeout(toastTimer); set({ toast: msg }); toastTimer = setTimeout(() => set({ toast: null }), 2800); }
let saveTimer = null;
function updUser(patch) {
  const p = typeof patch === "function" ? patch(S.user) : patch;
  S.user = Object.assign({}, S.user, p, { updated: Date.now() });
  if (S.user.lang !== LANG) { LANG = S.user.lang; document.documentElement.lang = LANG; }
  set({});
  clearTimeout(saveTimer);
  if (!Store.sandbox) saveTimer = setTimeout(() => Store.saveUser(S.user), 1200);
}

/* ---------- navigation ---------- */
function go(tab) {
  set({ tab, sheets: [] });
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  try { history.replaceState(null, "", "#" + tab); } catch (e) { /* ignore */ }
  emit("tab", { tab });
}
function openSheet(s) { set({ sheets: S.sheets.concat([s]) }); emit("sheet", s); }
function closeSheet() { set({ sheets: S.sheets.slice(0, -1) }); }
function replaceSheet(s) { set({ sheets: S.sheets.slice(0, -1).concat([s]) }); }

/* ---------- basket ---------- */
function qtyOf(pid) { const it = S.user.basket.find(x => x.p === pid); return it ? it.n : 0; }
function setQty(pid, n) {
  updUser(u => {
    const b = u.basket.slice();
    const i = b.findIndex(x => x.p === pid);
    if (n <= 0) { if (i >= 0) b.splice(i, 1); }
    else if (i >= 0) b[i] = { p: pid, n };
    else b.push({ p: pid, n });
    return { basket: b };
  });
  emit("basket", { n: S.user.basket.length });
}
function addToBasket(pid, n) { setQty(pid, qtyOf(pid) + (n || 1)); }
function mergeItems(items, replace) {
  updUser(u => {
    const b = replace ? [] : u.basket.slice();
    for (const it of items) {
      const i = b.findIndex(x => x.p === it.p);
      if (i >= 0) b[i] = { p: it.p, n: Math.min(99, b[i].n + it.n) };
      else b.push({ p: it.p, n: it.n });
    }
    return { basket: b };
  });
  emit("basket", { n: S.user.basket.length });
}
function loadTemplate(tid) {
  const tp = X.T.find(x => x.id === tid);
  if (!tp) return;
  const items = tp.items.map(([p, n]) => ({ p, n }));
  if (S.user.basket.length) { openSheet({ type: "merge", items, name: tl(tp) }); return; }
  mergeItems(items, true);
  toast(t("template_loaded", { name: tl(tp) }));
  go("cistella");
}

/* ---------- derived data (memoised on identity) ---------- */
const MEMO = new Map();
function memo(key, deps, fn) {
  const m = MEMO.get(key);
  if (m && m.deps.length === deps.length && m.deps.every((d, i) => d === deps[i])) return m.v;
  const v = fn();
  MEMO.set(key, { deps, v });
  return v;
}
function defaultChains() { return X.D.chains.filter(c => ["complet", "parcial", "antic"].includes(c.status)).map(c => c.id); }
function activeChains() { const a = S.user.chains; return a && a.length ? a : defaultChains(); }
/* Community prices: one person's report is used only when it is plausible (within −60 %…+60 % of the median official price
   for that product) or when a second report for the same product and chain agrees with it (±10 %). */
function officialRef(pid) {
  return memo("ref:" + pid, [X], () => {
    const ups = (X.byP.get(pid) || []).filter(o => daysBetween(o.date, X.D.meta.updated) <= FRESH_DAYS).map(o => o.up).sort((a, b) => a - b);
    return ups.length ? ups[Math.floor(ups.length / 2)] : null;
  });
}
function commPriceCheck() {
  return memo("cpc", [S.community, X], () => {
    const status = new Map(), groups = new Map();
    const cut = Date.now() - FRESH_DAYS * DAY;
    for (const c of S.community) if (c.t === "price" && c.ts > cut) {
      const k = c.p + "|" + c.c;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    }
    for (const list of groups.values()) for (const c of list) {
      const up = c.price / c.size, ref = officialRef(c.p);
      const plausible = ref != null && up >= ref * 0.4 && up <= ref * 1.6;
      const confirmed = list.some(o => o !== c && o.uid !== c.uid && Math.abs(o.price / o.size - up) <= up * 0.1);
      status.set(c.id, plausible || confirmed ? "ok" : "doubt");
    }
    return status;
  });
}
function commPrices() {
  return memo("cp", [S.community, LANG, X], () => {
    const m = new Map();
    const ok = commPriceCheck();
    const cut = Date.now() - FRESH_DAYS * DAY;
    for (const c of S.community) if (c.t === "price" && c.ts > cut && ok.get(c.id) === "ok") {
      const k = c.p + "|" + c.c;
      const prev = m.get(k);
      if (!prev || prev._ts < c.ts) {
        const p = X.P.get(c.p);
        m.set(k, { p: c.p, c: c.c, name: t("src_comunitat"), price: c.price, size: c.size, up: c.price / c.size, promo: "", src: null,
          date: isoOf(new Date(c.ts)), st: "comunitat", desde: false, bk: "", rank: 0, _ts: c.ts, unit: p && p.unit });
      }
    }
    return m;
  });
}
function OPT() { return { brand: S.user.brand, fresh: S.user.fresh, estimate: S.user.estimate, comm: commPrices() }; }
function OPT_ALL() { return { brand: "any", fresh: false, estimate: false, comm: commPrices() }; }
function sameTown(a, b) { return !a || !b || norm(a) === norm(b); }
function stockMap() {
  return memo("st", [S.community, S.user.town], () => {
    const m = new Map();
    const cut = Date.now() - 72 * 3600 * 1000;
    for (const c of S.community) if (c.t === "stock" && c.ts > cut && sameTown(c.town, S.user.town)) {
      const k = c.p + "|" + c.c;
      const prev = m.get(k);
      if (!prev) m.set(k, { s: c.s, ts: c.ts, n: 1 });
      else { prev.n++; if (c.ts > prev.ts) { prev.s = c.s; prev.ts = c.ts; } }
    }
    return m;
  });
}
function basketCompare() {
  const u = S.user;
  return memo("cmp", [u.basket, u.chains, u.brand, u.fresh, u.estimate, S.community, X], () =>
    u.basket.length ? compareBasket(u.basket, activeChains(), OPT()) : null);
}
function nChainsWithData() { return X.D.chains.filter(c => c.n_products > 0).length; }
function offerStatus(o, today) {
  if (o.to && o.to < today) return "ended";
  if (o.frm && o.frm > today) return "next";
  return "now";
}
function basketText(row, items) {
  const lines = [t("list_header"), ""];
  const ch = row ? X.C.get(row.cid) : null;
  if (ch) lines.push(t("receipt_at") + " " + ch.name + " (" + fmtDL(X.D.meta.updated) + ")", "");
  items.forEach((it, i) => {
    const p = X.P.get(it.p);
    const l = row ? row.lines[i] : null;
    let s = "- " + it.n + " × " + tl(p) + " (" + p["ref_" + LANG] + ")";
    if (l) s += " — " + l.o.name + ": " + eur(l.cost);
    else if (row) s += " — " + t("no_price_here", { chain: ch.name });
    lines.push(s);
  });
  if (row) lines.push("", t("receipt_total_real") + ": " + eur(row.total));
  lines.push("", "Preuet · " + X.D.meta.zone);
  return lines.join("\n");
}
