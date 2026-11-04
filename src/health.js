/* ===== health.js ===== */
/* ---------- a healthier basket: swaps for a similar product with better nutrition ----------
   The swaps are chosen by hand (a similar product, used the same way); a swap is offered only when the data shows it is
   better (per 100 g or ml): at least 20 % less saturated fat, sugar or salt, or 30 % more fibre, and nothing clearly worse
   (WORSE).
   x: how many of the new product replace one of the old (e.g. a 2 l bottle for 1 l ones). */
const HEALTH_SWAPS = {
  "llet-sencera": ["llet-semi"], "llet-nostra": ["llet-semi"],
  "pa-motlle": ["pa-motlle-integral"], "pa-motlle-sc": ["pa-motlle-integral"],
  "corn-flakes": ["flocs-civada"],
  "coca-cola": ["aigua-gas", 2], "refresc-taronja": ["aigua-gas", 2],
  "suc-taronja": ["taronges"],
  "tomaquet-fregit": ["tomaquet-triturat"],
  "iogurt-grec": ["iogurt-natural"], "natilles": ["iogurt-natural"], "flam": ["iogurt-natural"],
  "carn-picada": ["pit-pollastre"], "hamburgueses": ["pit-pollastre"], "salsitxes": ["pit-pollastre"],
  "cuixes-pollastre": ["pit-pollastre", 2],
  "baco": ["pit-gall-dindi"], "pernil-serra": ["pit-gall-dindi"],
  "formatge-curat": ["formatge-fresc"], "formatge-llesques": ["formatge-fresc"],
};
const LESS = ["sat", "sug", "salt"];
const MIN = { sat: 0.5, sug: 1, salt: 0.2 }; // the least change (g per 100 g) worth mentioning
const WORSE = { sat: 1.5, sug: 5, salt: 0.5 }; // g per 100 g more than this (and 50 % more) counts as clearly worse
/* what gets better (and by how much) going from product a to product b; null if it is not clearly better */
function healthGain(a, b) {
  const na = a && a.nut, nb = b && b.nut;
  if (!na || !nb) return null;
  const gains = [];
  for (const k of LESS) {
    const x = na[k], y = nb[k];
    if (x == null || y == null) continue;
    if (y - x > WORSE[k] && y > x * 1.5) return null; // clearly worse in something
    if (x - y >= MIN[k] && y <= x * 0.8) gains.push({ k, a: x, b: y, r: (x - y) / x });
  }
  if (na.fib != null && nb.fib != null && nb.fib >= na.fib * 1.3 && nb.fib - na.fib >= 1) gains.push({ k: "fib", a: na.fib, b: nb.fib, r: (nb.fib - na.fib) / nb.fib });
  return gains.length ? gains.sort((p, q) => q.r - p.r) : null;
}
function healthySwaps(items) {
  const out = [];
  items.forEach(it => {
    const s = HEALTH_SWAPS[it.p];
    if (!s || !X.P.has(s[0]) || items.some(x => x.p === s[0])) return;
    const gains = healthGain(X.P.get(it.p), X.P.get(s[0]));
    if (gains) out.push({ from: it.p, to: s[0], n: clamp(Math.round(it.n * (s[1] || 1)), 1, 99), gains });
  });
  return out;
}
function applySwaps(items, swaps) {
  return items.map(it => { const s = swaps.find(x => x.from === it.p); return s ? { p: s.to, n: s.n } : it; });
}
function gainText(g) {
  const v = x => fmtNum(Math.round(x * 10) / 10) + " g";
  return t("hl_k_" + g.k) + ": " + v(g.a) + " → " + v(g.b);
}

function HealthyTeaser() {
  const n = healthySwaps(S.user.basket).length;
  if (!n) return null;
  return html`<button type="button" class="card row healthy-teaser" style="width:100%;text-align:left" onClick=${() => openSheet({ type: "healthy" })}>
    <span class="plus-ic healthy-ic" aria-hidden="true"><${Icon} n="leaf" s=${22} /></span>
    <span class="grow stack-s" style="gap:2px"><span class="row" style="gap:0"><b>${t("hl_btn")}</b><${PlusTag} /></span><span class="small muted">${t("hl_btn_sub", { n })}</span></span>
    <${Icon} n="chevR" /></button>`;
}
function HealthySheet() {
  const u = S.user;
  const swaps = healthySwaps(u.basket);
  const chains = activeChains(), opt = OPT();
  const now = basketCompare();
  const bestOf = items => { const c = compareBasket(items, chains, opt); return c && c.best ? { cid: c.best.cid, v: c.key(c.best) } : null; };
  const base = now && now.best ? { cid: now.best.cid, v: now.key(now.best) } : null;
  const delta = sw => { const b = bestOf(applySwaps(u.basket, [sw])); return b && base ? b.v - base.v : null; };
  const all = swaps.length > 1 ? bestOf(applySwaps(u.basket, swaps)) : null;
  const money = d => d == null ? "" : Math.abs(d) < 0.005 ? t("hl_same") : (d > 0 ? "+" : "−") + eur(Math.abs(d));
  const swap = list => {
    updUser({ basket: applySwaps(S.user.basket, list) });
    toast(list.length === 1 ? t("hl_done", { a: tl(X.P.get(list[0].from)), b: tl(X.P.get(list[0].to)) }) : t("hl_done_n", { n: list.length }));
    emit("healthy:swap", { n: list.length });
    if (list.length === swaps.length) closeSheet();
  };
  const foot = swaps.length > 1 ? html`<button type="button" class="btn primary block" onClick=${() => swap(swaps)}><${Icon} n="leaf" s=${18} />${t("hl_all", { n: swaps.length })}${all && base ? " · " + money(all.v - base.v) : ""}</button>` : null;
  return html`<${Sheet} title=${t("hl_title")} onClose=${closeSheet} foot=${foot} id="healthy"><div class="stack">
    <p class="small muted">${t("hl_sub")}</p>
    ${swaps.length ? html`<div class="list">${swaps.map(sw => {
      const a = X.P.get(sw.from), b = X.P.get(sw.to), d = delta(sw);
      return html`<div class="li healthy-li" key=${sw.from}>
        <div class="grow stack-s" style="min-width:0;gap:6px">
          <div class="row" style="gap:8px;flex-wrap:wrap"><${ProductThumb} p=${a} size=${36} /><span class="small" style="text-decoration:line-through;color:var(--ink-3)">${tl(a)}</span>
            <${Icon} n="chevR" s=${16} /><${ProductThumb} p=${b} size=${36} /><b>${sw.n} × ${tl(b)}</b></div>
          <div class="chips">${sw.gains.slice(0, 2).map(g => html`<span class="chip good" key=${g.k}>${gainText(g)}</span>`)}
            ${d != null ? html`<span class=${"chip " + (d > 0.005 ? "warn" : "outline")}>${money(d)}</span>` : null}</div>
        </div>
        <button type="button" class="btn small ghost" onClick=${() => swap([sw])} aria-label=${t("hl_swap") + ": " + tl(a) + " → " + tl(b)}>${t("hl_swap")}</button>
      </div>`;
    })}</div>` : html`<${Empty} title=${t("hl_none")} />`}
    <p class="xs faint">${t("hl_note")}</p>
  </div><//>`;
}
