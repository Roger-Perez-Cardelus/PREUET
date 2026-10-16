/* ===== core.js ===== */
/* ---------- core: data index, formatting, cost model ---------- */
const { html, render, h, createContext, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, useReducer, useErrorBoundary } = htmPreact;

const DAY = 86400000;
const WEIGHED = new Set(["fruita", "carn"]);
const PANTRY = new Set(["sal", "oli-oliva-ve", "oli-oliva-suau", "oli-gira-sol", "sucre", "farina", "mel"]);
const DIET_TAGS = ["sg", "sl", "vg", "vt"];
const ALLERGENS = ["gluten", "crustacis", "ous", "peix", "cacauets", "soja", "llet", "fruitsecs", "api", "mostassa", "sesam", "sulfits", "tramussos", "molluscs"];
const AMB_TOWNS = ["Badalona", "Badia del Vallès", "Barberà del Vallès", "Barcelona", "Begues", "Castellbisbal", "Castelldefels", "Cerdanyola del Vallès", "Cervelló", "Corbera de Llobregat", "Cornellà de Llobregat", "el Papiol", "el Prat de Llobregat", "Esplugues de Llobregat", "Gavà", "l'Hospitalet de Llobregat", "la Palma de Cervelló", "Molins de Rei", "Montcada i Reixac", "Montgat", "Pallejà", "Ripollet", "Sant Adrià de Besòs", "Sant Andreu de la Barca", "Sant Boi de Llobregat", "Sant Climent de Llobregat", "Sant Cugat del Vallès", "Sant Feliu de Llobregat", "Sant Joan Despí", "Sant Just Desvern", "Sant Vicenç dels Horts", "Santa Coloma de Cervelló", "Santa Coloma de Gramenet", "Tiana", "Torrelles de Llobregat", "Viladecans"];
const FRESH_DAYS = 30;

function pad2(n) { return (n < 10 ? "0" : "") + n; }
function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function isoToday() { return isoOf(new Date()); }
function parseISO(s) { const a = String(s).slice(0, 10).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); }
function fmtD(iso) { if (!iso) return ""; const d = parseISO(iso); return d.getDate() + "/" + (d.getMonth() + 1); }
function fmtDL(iso) { if (!iso) return ""; const d = parseISO(iso); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(); }
function fmtDay(iso) { const d = parseISO(iso); return t("ds" + d.getDay()) + " " + d.getDate() + "/" + (d.getMonth() + 1); }
function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return t("now");
  if (s < 3600) return t("ago_min", { n: Math.floor(s / 60) });
  if (s < 86400) return t("ago_h", { n: Math.floor(s / 3600) });
  return t("ago_d", { n: Math.floor(s / 86400) });
}
function relDay(iso) {
  const d = daysBetween(isoToday(), iso);
  if (d === 0) return t("today");
  if (d === 1) return t("tomorrow");
  if (d === -1) return t("yesterday");
  return d > 0 ? t("in_d", { n: d }) : t("ago_d", { n: -d });
}
function num2(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(".", ","); }
function fmtNum(v) { return String(Math.round(v * 100) / 100).replace(".", ","); }
function eur(v) { return v == null || isNaN(v) ? "—" : num2(v) + " €"; }
function eurU(v, unit) { return v == null || isNaN(v) ? "—" : num2(v) + " " + t("per_u_" + unit); }
function pct(v) { return Math.round(v) + " %"; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/·/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function sum(a) { let s = 0; for (const v of a) s += v; return s; }
function fmtQty(q, unit) {
  if (unit === "kg") return q < 1 ? Math.round(q * 1000) + " g" : num2(q).replace(/,00$/, "") + " kg";
  if (unit === "l") return q < 1 ? Math.round(q * 1000) + " ml" : num2(q).replace(/,00$/, "") + " L";
  if (unit === "dotzena") { const u = Math.round(q * 12); return u + (LANG === "es" ? (u === 1 ? " huevo" : " huevos") : (u === 1 ? " ou" : " ous")); }
  return (Math.round(q * 100) / 100).toString().replace(".", ",") + " " + t("u_" + unit);
}
function textOn(hex) { // readable ink for a chain colour chip
  const c = hex.replace("#", ""); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#1E1525" : "#FFFFFF";
}

/* ---------- data index ---------- */
let X = null;
function indexData(D) {
  const P = new Map(D.products.map(p => [p.id, p]));
  const C = new Map(D.chains.map(c => [c.id, c]));
  const CAT = new Map(D.categories.map(c => [c.id, c]));
  const R = new Map(D.recipes.map(r => [r.id, r]));
  const byPC = new Map(), byP = new Map();
  for (const o of D.offerings) {
    const k = o.p + "|" + o.c;
    if (!byPC.has(k)) byPC.set(k, []);
    byPC.get(k).push(o);
    if (!byP.has(o.p)) byP.set(o.p, []);
    byP.get(o.p).push(o);
  }
  for (const a of byPC.values()) a.sort((x, y) => x.rank - y.rank);
  for (const p of D.products) {
    const cat = CAT.get(p.cat) || {};
    p._n = norm(p.ca + " " + p.es);
    p._s = norm([p.ca, p.es, cat.ca, cat.es].concat((byP.get(p.id) || []).map(o => o.name)).join(" "));
  }
  const idx = { D, P, C, CAT, R, byPC, byP, T: D.templates || [] };
  X = idx;
  idx.gidx = globalIndex({ brand: "own", fresh: true });
  return idx;
}

/* ---------- cost model ---------- */
function offerOK(o, p, opt) {
  if (opt.fresh && o.st !== "comunitat" && daysBetween(o.date, X.D.meta.updated) > FRESH_DAYS) return false;
  if (p.kind !== "marca") {
    if (opt.brand === "mb" && o.bk === "fab") return false;
    if (opt.brand === "fab" && o.bk === "mb") return false;
    if (opt.brand === "own" && o.bk !== "mb" && o.bk !== "fresc") return false;
  }
  return true;
}
function tillCost(l, p) { return WEIGHED.has(p.cat) || !l.packs ? l.cost : l.packs * l.o.price; }
function packText(l, p) {
  if (WEIGHED.has(p.cat) || !l.packs) return fmtQty(l.q, p.unit) + " × " + eurU(l.o.up, p.unit);
  if (l.packs * l.o.size > l.q * 1.01) return t("pack_bigger", { s: fmtQty(l.o.size, p.unit) }) + " · " + eur(l.o.price) + " (" + eurU(l.o.up, p.unit) + ")";
  return l.packs + " × " + eur(l.o.price);
}
function eligible(pid, cid, opt) {
  const p = X.P.get(pid);
  const list = (X.byPC.get(pid + "|" + cid) || []).filter(o => offerOK(o, p, opt));
  if (!list.length && opt.comm) { const c = opt.comm.get(pid + "|" + cid); if (c) list.push(c); }
  return list;
}
/* Cost of a basket line = quantity × unit price of the cheapest sensible pack.
   Packs more than 3× the quantity needed are ignored (a 5 L bottle is not "1 L"), unless they are all the chain sells;
   then the smallest pack's unit price is used and the line is flagged, because you would pay the whole pack. */
function itemAt(pid, n, cid, opt) {
  const p = X.P.get(pid);
  if (!p) return null;
  const q = n * p.ref;
  const list = eligible(pid, cid, opt);
  if (!list.length) return null;
  const weighed = WEIGHED.has(p.cat);
  let pool = weighed ? list : list.filter(o => o.size <= q * 3 + 1e-9);
  const big = !weighed && !pool.length;
  if (big) { const m = Math.min(...list.map(o => o.size)); pool = list.filter(o => o.size <= m + 1e-9); }
  let best = null;
  for (const o of pool) {
    const cost = q * o.up;
    if (!best || cost < best.cost - 1e-9) best = { cost, o, q, packs: weighed ? null : Math.max(1, Math.ceil(q / o.size - 1e-9)), big };
  }
  return best;
}
function propCost(pid, q, cid, opt) { // recipe: pay only what you use
  let best = null;
  for (const o of eligible(pid, cid, opt)) {
    const c = q * o.up;
    if (!best || c < best.cost) best = { cost: c, o };
  }
  return best;
}
function globalIndex(opt) {
  const logs = new Map();
  for (const p of X.D.products) {
    const costs = [];
    for (const c of X.D.chains) {
      const l = itemAt(p.id, 1, c.id, opt);
      if (l) costs.push([c.id, l.cost / l.q]);
    }
    if (costs.length < 2) continue;
    const m = Math.min(...costs.map(x => x[1]));
    if (!(m > 0)) continue;
    for (const [cid, v] of costs) {
      if (!logs.has(cid)) logs.set(cid, []);
      logs.get(cid).push(Math.log(Math.min(2, v / m)));
    }
  }
  const out = new Map();
  for (const [cid, a] of logs) if (a.length >= 5) out.set(cid, { idx: 100 * Math.exp(sum(a) / a.length), n: a.length });
  return out;
}
function compareBasket(items, chainIds, opt) {
  const n = items.length;
  const rows = chainIds.map(cid => {
    const lines = items.map(it => itemAt(it.p, it.n, cid, opt));
    let total = 0, k = 0;
    lines.forEach(l => { if (l) { total += l.cost; k++; } });
    return { cid, lines, total, k, n };
  });
  const mins = items.map((it, i) => {
    let m = null, mc = null;
    rows.forEach(r => { const l = r.lines[i]; if (l && (m === null || l.cost < m - 1e-9)) { m = l.cost; mc = r.cid; } });
    return { cost: m, cid: mc };
  });
  rows.forEach(r => {
    let num = 0, den = 0, cnt = 0;
    r.lines.forEach((l, i) => { if (l && mins[i].cost != null) { num += l.cost; den += mins[i].cost; cnt++; } });
    const g = X.gidx.get(r.cid);
    r.idx = cnt >= 3 && den > 0 ? 100 * num / den : (g ? g.idx : null);
    r.idxSrc = cnt >= 3 ? "basket" : "global";
    let est = 0, ne = 0;
    r.estLines = r.lines.map((l, i) => {
      if (l || mins[i].cost == null || !r.idx) return null;
      const v = mins[i].cost * Math.max(100, r.idx) / 100;
      est += v; ne++;
      return v;
    });
    r.est = est; r.ne = ne; r.estTotal = r.total + est;
    r.cov = n ? r.k / n : 0;
  });
  const withData = rows.filter(r => r.k > 0);
  const valid = withData.filter(r => r.cov >= 0.6);
  const key = opt.estimate ? (r => r.estTotal) : (r => r.total);
  let ranked;
  if (opt.estimate) ranked = valid.slice().sort((a, b) => key(a) - key(b) || b.k - a.k);
  else ranked = withData.slice().sort((a, b) => b.k - a.k || a.total - b.total);
  const best = ranked[0] || null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const pair = bestPair(withData, items, best);
  const minTotal = sum(mins.filter(m => m.cost != null).map(m => m.cost));
  const nowhere = mins.filter(m => m.cost == null).length;
  return { rows, mins, ranked, best, worst, pair, minTotal, nowhere, low: withData.filter(r => r.cov < 0.6), key };
}
function bestPair(rows, items, single) {
  let best = null;
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    const A = rows[a], B = rows[b];
    let total = 0, k = 0;
    const pick = items.map((it, i) => {
      const la = A.lines[i], lb = B.lines[i];
      const w = la && lb ? (la.cost <= lb.cost ? "a" : "b") : la ? "a" : lb ? "b" : null;
      if (w) { total += (w === "a" ? la : lb).cost; k++; }
      return w;
    });
    if (!pick.includes("a") || !pick.includes("b")) continue;
    const c = { a: A, b: B, total, k, pick };
    if (!best || k > best.k || (k === best.k && total < best.total - 1e-9)) best = c;
  }
  if (best && single) {
    let save = 0, extra = 0;
    items.forEach((it, i) => {
      const s = single.lines[i];
      const w = best.pick[i];
      const pl = w === "a" ? best.a.lines[i] : w === "b" ? best.b.lines[i] : null;
      if (s && pl) save += s.cost - pl.cost;
      if (!s && pl) extra++;
    });
    best.save = save; best.extra = extra;
  }
  return best;
}

/* ---------- quality-price ---------- */
function crowdOf(target, community) {
  const last = new Map();
  for (const c of community) if (c.t === "rating" && c.target === target) {
    const k = c.uid;
    if (!last.has(k) || last.get(k).ts < c.ts) last.set(k, c);
  }
  const v = [...last.values()].map(c => c.stars);
  return { n: v.length, avg: v.length ? sum(v) / v.length : null };
}
function qpRows(cmp, chainIds, w, community) {
  return chainIds.map(cid => {
    const ch = X.C.get(cid);
    const row = cmp ? cmp.rows.find(r => r.cid === cid) : null;
    const g = X.gidx.get(cid);
    const idx = row && row.k >= 3 && row.idxSrc === "basket" ? row.idx : (g ? g.idx : null);
    const price = idx ? Math.min(100, 10000 / idx) : null;
    const crowd = crowdOf("c:" + cid, community);
    const cw = crowd.n ? 0.3 * Math.min(1, crowd.n / 5) : 0;
    let quality = null;
    if (ch.ocu != null) quality = (1 - cw) * ch.ocu + cw * crowd.avg * 20;
    else if (crowd.n >= 3) quality = crowd.avg * 20;
    const score = price != null && quality != null ? w * price + (1 - w) * quality : null;
    return { cid, idx, price, quality, crowd, score };
  }).filter(r => r.idx != null).sort((a, b) => (a.score == null) - (b.score == null) || (b.score || 0) - (a.score || 0) || a.idx - b.idx);
}

/* ---------- nutrition ---------- */
function lights(nut) {
  if (!nut) return null;
  const d = nut.basis === "ml";
  const T = d ? { fat: [1.5, 8.75], sat: [0.75, 2.5], sug: [2.5, 11.25], salt: [0.3, 0.75] }
              : { fat: [3, 17.5], sat: [1.5, 5], sug: [5, 22.5], salt: [0.3, 1.5] };
  const o = {};
  for (const k of ["fat", "sat", "sug", "salt"]) {
    const v = nut[k];
    o[k] = v == null ? null : v <= T[k][0] ? "lo" : v > T[k][1] ? "hi" : "me";
  }
  return o;
}

/* ---------- origin hints from shelf names ---------- */
const ORIGIN_RX = [
  [/\bkm ?0\b/i, "Km 0", "Km 0"], [/\bigp\b/i, "IGP", "IGP"], [/\bd\.?o\.?p?\b(?!\w)|denominaci/i, "D.O.", "D.O."],
  [/ecol[oò]gic|\becol[oó]gico|\bbio\b|\beco\b/i, "Ecològic", "Ecológico"],
  [/catalunya|catalu[ñn]a|catal[aà]\b|\bcatalana\b/i, "Catalunya", "Cataluña"],
  [/\bespanya\b|\bespa[ñn]a\b|\bnacional\b/i, "Espanya", "España"],
  [/canari/i, "Canàries", "Canarias"], [/almer[ií]a/i, "Almeria", "Almería"], [/m[uú]rcia/i, "Múrcia", "Murcia"],
  [/val[eè]nci/i, "València", "Valencia"], [/lleida|l[eé]rida/i, "Lleida", "Lleida"], [/girona|gerona/i, "Girona", "Girona"],
  [/gal[ií]ci/i, "Galícia", "Galicia"], [/\bde ast[uú]ri|ast[uú]ries\b|asturias\b/i, "Astúries", "Asturias"], [/navarr/i, "Navarra", "Navarra"],
  [/huelva/i, "Huelva", "Huelva"], [/ja[eé]n/i, "Jaén", "Jaén"], [/andalu/i, "Andalusia", "Andalucía"],
  [/extremadur/i, "Extremadura", "Extremadura"], [/arag[oó]/i, "Aragó", "Aragón"], [/mallorca/i, "Mallorca", "Mallorca"],
  [/marroc|marruecos/i, "Marroc", "Marruecos"], [/\bper[uú]\b/i, "Perú", "Perú"], [/xile\b|\bchile\b/i, "Xile", "Chile"],
  [/sud[aá]frica|sud-[aà]frica/i, "Sud-àfrica", "Sudáfrica"], [/fran[cç]a\b|francia/i, "França", "Francia"],
  [/it[aà]li/i, "Itàlia", "Italia"], [/portugal/i, "Portugal", "Portugal"], [/costa rica/i, "Costa Rica", "Costa Rica"],
  [/colombia|col[oò]mbia/i, "Colòmbia", "Colombia"], [/equador|ecuador/i, "Equador", "Ecuador"],
  [/nova zelanda|nueva zelanda/i, "Nova Zelanda", "Nueva Zelanda"], [/argentin/i, "Argentina", "Argentina"],
  [/garrotxa|fageda/i, "la Garrotxa", "la Garrotxa"], [/guissona/i, "Guissona", "Guissona"],
];
function originHints(pid) {
  const out = [];
  const seen = new Set();
  for (const o of X.byP.get(pid) || []) {
    const s = o.name + " " + (o.promo || "");
    for (const [rx, ca, es] of ORIGIN_RX) if (rx.test(s)) {
      const k = o.c + "|" + ca;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ c: o.c, label: LANG === "es" ? es : ca, name: o.name });
    }
  }
  return out;
}
function originRule(p) {
  if (p.cat === "fruita") return t("origin_rule_fruita");
  if (p.cat === "carn" && !/pernil|gall|salmo|lluc|tonyina/.test(p.id)) return t("origin_rule_carn");
  if (p.id.startsWith("ous")) return t("origin_rule_ous");
  if (p.id.startsWith("oli-oliva")) return t("origin_rule_oli");
  if (p.id === "mel") return t("origin_rule_mel");
  return t("origin_rule_gen");
}

/* ---------- search ---------- */
function searchProducts(q) {
  const qs = norm(q).split(" ").filter(Boolean);
  if (!qs.length) return [];
  const out = [];
  for (const p of X.D.products) {
    let score = 0, ok = true;
    for (const w0 of qs) {
      const w1 = w0.length > 4 ? w0.replace(/(es|s)$/, "") : w0;
      if (p._n.includes(w0) || p._n.includes(w1)) score += (" " + p._n).includes(" " + w1) ? 6 : 3;
      else if (p._s.includes(w0) || p._s.includes(w1)) score += 1;
      else { ok = false; break; }
    }
    if (ok) out.push([score, p]);
  }
  out.sort((a, b) => b[0] - a[0] || chainsWith(b[1].id) - chainsWith(a[1].id));
  return out.map(x => x[1]);
}
function chainsWith(pid) { const s = new Set((X.byP.get(pid) || []).map(o => o.c)); return s.size; }
function minPrice(pid, opt) {
  let best = null;
  for (const c of X.D.chains) { const l = itemAt(pid, 1, c.id, opt); if (l && (!best || l.cost < best.cost)) best = { cost: l.cost, c: c.id }; }
  return best;
}

/* ---------- schedules ---------- */
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function nextFrom(s, fromIso) {
  const from = parseISO(fromIso);
  if (s.freq === "m") {
    let y = from.getFullYear(), m = from.getMonth();
    let d = new Date(y, m, Math.min(s.dom, daysInMonth(y, m)));
    if (d < from) { m += 1; if (m > 11) { m = 0; y += 1; } d = new Date(y, m, Math.min(s.dom, daysInMonth(y, m))); }
    return isoOf(d);
  }
  const step = s.freq === "2w" ? 14 : 7;
  const first = parseISO(s.start);
  while (first.getDay() !== s.dow) first.setDate(first.getDate() + 1);
  if (from <= first) return isoOf(first);
  const k = Math.ceil((from - first) / DAY / step - 1e-9);
  const d = new Date(first); d.setDate(d.getDate() + k * step);
  return isoOf(d);
}
function dueOf(s) {
  const from = s.lastDone ? addDays(s.lastDone, 1) : s.start;
  const next = nextFrom(s, from > s.start ? from : s.start);
  return { next, due: next <= isoToday() };
}

/* ---------- recipes ---------- */
function recipeAt(r, cid, opt, serv) {
  const f = (serv || r.serv) / r.serv;
  const lines = r.ing.map(([pid, q0]) => {
    const q = q0 * f;
    const pc = propCost(pid, q, cid, opt);
    return { pid, q, pc };
  });
  const miss = lines.filter(l => !l.pc).length;
  const cost = sum(lines.filter(l => l.pc).map(l => l.pc.cost));
  return { cid, lines, miss, cost, per: cost / (serv || r.serv) };
}
function recipeMix(r, chainIds, opt, serv) {
  const f = (serv || r.serv) / r.serv;
  const lines = r.ing.map(([pid, q0]) => {
    const q = q0 * f;
    let best = null;
    for (const cid of chainIds) { const pc = propCost(pid, q, cid, opt); if (pc && (!best || pc.cost < best.cost)) best = { ...pc, cid }; }
    return { pid, q, pc: best };
  });
  const miss = lines.filter(l => !l.pc).length;
  const cost = sum(lines.filter(l => l.pc).map(l => l.pc.cost));
  return { cid: null, lines, miss, cost, per: cost / (serv || r.serv) };
}
function recipeBest(r, chainIds, opt, serv) {
  let best = null;
  for (const cid of chainIds) {
    const rc = recipeAt(r, cid, opt, serv);
    if (rc.lines.length - rc.miss === 0) continue;
    if (!best || rc.miss < best.miss || (rc.miss === best.miss && rc.cost < best.cost)) best = rc;
  }
  if (!best || best.miss > 0) {
    const mix = recipeMix(r, chainIds, opt, serv);
    if (!best || mix.miss < best.miss) return mix;
  }
  return best;
}
function recipeDiet(r) {
  const tags = r.ing.map(([pid]) => (X.P.get(pid) || {}).tags || []);
  return {
    sg: tags.every(a => a.includes("sg")),
    vg: tags.every(a => a.includes("vg")),
    vt: tags.every(a => a.includes("vg") || a.includes("vt")),
    sl: r.ing.every(([pid]) => { const p = X.P.get(pid) || {}; return !(p.allergens || []).includes("llet") || (p.tags || []).includes("sl"); }),
  };
}
function recipeAllergens(r) {
  const s = new Set();
  r.ing.forEach(([pid]) => ((X.P.get(pid) || {}).allergens || []).forEach(a => s.add(a)));
  return [...s];
}

/* ---------- tiny event bus (test mode listens) ---------- */
const BUS = new Set();
function emit(name, data) { BUS.forEach(f => { try { f(name, data || {}); } catch (e) { console.error(e); } }); }
