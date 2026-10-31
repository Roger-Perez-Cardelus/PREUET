/* ===== screens_main.js ===== */
/* ---------- header & tabs ---------- */
function Header() {
  return html`<header class="topbar"><div class="wrap">
    <button type="button" class="logo" onClick=${() => go("inici")} aria-label=${"Preuet · " + t("tab_inici")}><${Logo} /><b>Preuet</b></button>
    <span class="grow"></span>
    <button type="button" class="pill-btn" onClick=${() => openSheet({ type: "town" })} aria-label=${t("town_pill") + ": " + S.user.town}><${Icon} n="pin" s=${16} /><span>${S.user.town}</span></button>
    <div class="lang" role="group" aria-label=${t("lang_label")}>
      ${LANGS.map(l => html`<button type="button" key=${l} aria-pressed=${String(LANG === l)} onClick=${() => updUser({ lang: l })}>${l.toUpperCase()}</button>`)}
    </div>
  </div></header>`;
}
const TABS = [["inici", "home"], ["cistella", "basket"], ["ofertes", "tag"], ["receptes", "pot"], ["mes", "grid"]];
function TabBar() {
  const n = S.user.basket.length;
  return html`<nav class="tabbar" aria-label="Preuet"><div class="wrap">
    ${TABS.map(([id, ic]) => html`<button type="button" key=${id} class="tab" aria-current=${S.tab === id ? "page" : null} onClick=${() => go(id)}>
      <${Icon} n=${ic} s=${24} />${t("tab_" + id)}${id === "cistella" && n ? html`<span class="badge" key=${"b" + n} aria-label=${t("n_products", { n })}>${n}</span>` : null}
    </button>`)}
  </div></nav>`;
}

/* ---------- product row (search, picker, category) ---------- */
function ProductRow({ p }) {
  const cat = X.CAT.get(p.cat);
  const mp = minPrice(p.id, OPT_ALL());
  const n = chainsWith(p.id);
  const qty = qtyOf(p.id);
  const avoid = (p.allergens || []).filter(a => S.user.avoid.includes(a));
  return html`<div class="li">
    <${ProductThumb} p=${p} size=${44} />
    <button type="button" class="grow" style="text-align:left;background:none;border:0;padding:0;min-width:0" onClick=${() => openSheet({ type: "product", id: p.id })}>
      <div class="t">${tl(p)}</div>
      <div class="s">${tl(cat)} · ${p["ref_" + LANG]}</div>
      <div class="meta">${mp ? t("from_price", { p: eur(mp.cost) }) + " · " + t("at_chains", { n }) : t("no_prices")}
        ${avoid.length ? html` · <span style="color:var(--bad);font-weight:700">${avoid.map(a => t("al_" + a)).join(", ")}</span>` : null}</div>
    </button>
    ${qty ? html`<${Stepper} value=${qty} onChange=${v => setQty(p.id, v)} label=${tl(p)} />`
      : html`<button type="button" class="icon-btn" aria-label=${t("add_to_basket") + ": " + tl(p)} onClick=${() => { addToBasket(p.id); toast(t("added_to_basket")); }}><${Icon} n="plus" /></button>`}
  </div>`;
}
function SearchResults({ res, q }) {
  const [sent, setSent] = useState(false);
  if (!res.length) return html`<${Empty} title=${t("no_results", { q })} sub=${t("no_results_hint")}>
    ${sent ? html`<p class="small">${t("suggest_sent")}</p>` : html`<button type="button" class="btn ghost small" onClick=${async () => {
      try { await Store.addContribution({ t: "suggest", txt: q.slice(0, 120), target: "app", town: S.user.town, nick: S.user.nick }); setSent(true); } catch (e) { toast(t("write_failed")); }
    }}>${t("suggest_product")}</button>`}
  <//>`;
  return html`<section><div class="section-h"><h2 class="grow">${t("results_for", { q })}</h2><span class="small muted">${res.length}</span></div>
    <div class="list">${res.slice(0, 40).map(p => html`<${ProductRow} key=${p.id} p=${p} />`)}</div></section>`;
}

/* ---------- home ---------- */
function Home() {
  const q = S.q;
  const res = q.trim() ? searchProducts(q) : null;
  return html`<div class="stack-l">
    <section class="hero">
      <h1>${t("hero_a")}<em>${t("hero_em")}</em>${t("hero_b")}</h1>
      <p>${t("hero_sub", { n: nChainsWithData(), date: fmtDL(X.D.meta.updated) })}</p>
      <div class="search" role="search"><${Icon} n="search" />
        <input type="search" value=${q} placeholder=${t("search_ph")} aria-label=${t("search_label")} onInput=${e => set({ q: e.currentTarget.value })} />
        <button type="button" class="scan-btn" aria-label=${t("scan_title")} onClick=${() => openSheet({ type: "scan" })}><${Icon} n="barcode" s=${22} /></button>
      </div>
    </section>
    ${res ? html`<${SearchResults} res=${res} q=${q} />` : html`
      <${StaleBanner} />
      <${DueSchedules} />
      ${S.user.basket.length ? html`<${BasketTeaser} />` : null}
      <${WatchedOffers} />
      <${Templates} />
      <${Categories} />
      <${OffersTeaser} />
      ${S.user.basket.length ? null : html`<${HowItWorks} />`}
      <${CommunityTeaser} />`}
  </div>`;
}
function StaleBanner({ compact }) {
  const d = daysBetween(X.D.meta.updated, isoToday());
  if (d <= STALE_DAYS) return null;
  if (compact) return html`<p class="stale-line" role="status"><${Icon} n="clock" s=${15} />${t("stale_short", { date: fmtD(X.D.meta.updated), n: d })}</p>`;
  return html`<div class="callout warn row" role="status"><${Icon} n="alert" /><span class="grow">${t("stale_banner", { n: d, date: fmtDL(X.D.meta.updated) })}</span></div>`;
}
/* the answer first: where the basket is cheapest, always in view while you edit it */
function BasketSummary({ cmp }) {
  const b = cmp && cmp.best;
  if (!b) return null;
  const worst = cmp.ranked.length > 1 ? cmp.ranked[cmp.ranked.length - 1] : null;
  const save = worst ? cmp.key(worst) - cmp.key(b) : 0;
  const jump = () => { const el = document.getElementById("results"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return html`<button type="button" class="sum-bar" onClick=${jump} aria-label=${t("home_best") + ": " + X.C.get(b.cid).name + " " + eur(cmp.key(b))}>
    <span class="grow stack-s" style="gap:2px;min-width:0"><span class="eyebrow">${t("home_best")}</span>
      <span class="row" style="gap:8px"><${ChainBadge} cid=${b.cid} strong=${true} />${save > 0.05 ? html`<span class="chip good">−${eur(save)}</span>` : null}</span></span>
    <${PriceTag} v=${cmp.key(b)} /><${Icon} n="chevD" s=${18} />
  </button>`;
}
function DueSchedules() {
  const due = S.user.schedules.map(s => ({ s, d: dueOf(s) })).filter(x => x.d.due);
  if (!due.length) return null;
  return html`<div class="stack-s">${due.map(({ s }) => html`<div class="callout good row" key=${s.id}>
    <${Icon} n="calendar" /><span class="grow"><b>${t("due_title", { name: s.name })}</b></span>
    <button type="button" class="btn small primary" onClick=${() => prepareSchedule(s)}>${t("prepare")}</button></div>`)}</div>`;
}
function BasketTeaser() {
  const cmp = basketCompare();
  const b = cmp && cmp.best;
  return html`<button type="button" class="card raised" style="text-align:left;width:100%" onClick=${() => go("cistella")}>
    <div class="row"><div class="grow stack-s">
      <span class="eyebrow">${t("your_basket")} · ${t("n_products", { n: S.user.basket.length })}</span>
      ${b ? html`<span>${t("home_best")}: <b>${X.C.get(b.cid).name}</b></span>` : null}
    </div>${b ? html`<${PriceTag} v=${cmp.key(b)} lg=${false} />` : null}<${Icon} n="chevR" /></div>
  </button>`;
}
function Templates() {
  const opt = OPT();
  const chains = activeChains();
  return html`<section>
    <div class="section-h"><div class="grow"><h2>${t("quick_baskets")}</h2><p class="small muted">${t("quick_baskets_sub")}</p></div></div>
    <div class="hscroll">${X.T.map(tp => {
      const items = tp.items.map(([p, n]) => ({ p, n }));
      const cmp = memo("tpl:" + tp.id, [S.user.chains, S.user.brand, S.user.fresh, S.user.estimate, S.community], () => compareBasket(items, chains, opt));
      const b = cmp.best;
      const pics = items.map(x => X.P.get(x.p)).filter(p => p && p.img && p.img.t).slice(0, 4);
      return html`<button type="button" class="tpl" key=${tp.id} onClick=${() => loadTemplate(tp.id)}>
        ${pics.length >= 3 ? html`<span class="tpl-pics" aria-hidden="true">${pics.map(p => html`<img key=${p.id} src=${p.img.t} alt="" loading="lazy" width="48" height="48" />`)}</span>` : null}
        <span class="chip plum seg">${t("seg_" + tp.seg)}</span>
        <b>${tl(tp)}</b>
        <span class="small muted">${t("n_products", { n: items.length })}</span>
        ${b ? html`<span class="row" style="margin-top:auto"><span class="small grow">${X.C.get(b.cid).name}</span><${PriceTag} v=${cmp.key(b)} /></span>` : null}
      </button>`;
    })}</div>
  </section>`;
}
function Categories() {
  return html`<section><div class="section-h"><h2 class="grow">${t("categories")}</h2></div>
    <div class="grid-cats">${X.D.categories.map(c => html`<button type="button" class="cat-btn" key=${c.id} onClick=${() => openSheet({ type: "category", id: c.id })}>
      <span class="ico" style="color:var(--plum)"><${Icon} n=${"cat_" + c.id} s=${28} /></span>${tl(c)}</button>`)}</div></section>`;
}
function OffersTeaser() {
  const today = isoToday();
  const st = X.D.offers.map(o => offerStatus(o, today));
  const now = st.filter(s => s === "now").length, nx = st.filter(s => s === "next").length;
  return html`<button type="button" class="card row" style="width:100%;text-align:left" onClick=${() => go("ofertes")}>
    <span style="color:var(--plum)"><${Icon} n="tag" s=${26} /></span>
    <span class="grow stack-s"><b>${t("offers_teaser", { n: now })}</b>${nx ? html`<span class="small muted">${t("offers_teaser_next", { n: nx })}</span>` : null}</span>
    <${Icon} n="chevR" />
  </button>`;
}
function HowItWorks() {
  return html`<section class="card stack"><h3>${t("home_how")}</h3>
    ${[["basket", "how_1"], ["receipt", "how_2"], ["users", "how_3"]].map(([ic, k], i) => html`<div class="row" key=${k}>
      <span class="chip plum" style="width:28px;height:28px;justify-content:center;padding:0">${i + 1}</span><span class="grow">${t(k)}</span><span class="faint"><${Icon} n=${ic} /></span></div>`)}
  </section>`;
}
function CommunityTeaser() {
  const items = S.community.filter(c => c.t === "stock" || c.t === "price").sort((a, b) => b.ts - a.ts).slice(0, 3);
  if (!items.length) return null;
  return html`<section><div class="section-h"><h2 class="grow">${t("community_home")}</h2><button type="button" class="link-btn" onClick=${() => openSheet({ type: "community" })}>${t("see_all")}</button></div>
    <div class="card">${items.map(c => html`<${FeedItem} key=${c.id} c=${c} />`)}</div></section>`;
}

/* ---------- basket ---------- */
function Basket() {
  const u = S.user;
  const [confirm, setConfirm] = useState(false);
  if (!u.basket.length) return html`<div class="stack-l">
    <div class="section-h"><h2 class="grow">${t("basket_title")}</h2></div>
    <${Empty} title=${t("basket_empty_t")} sub=${t("basket_empty_s")}>
      <button type="button" class="btn primary" onClick=${() => openSheet({ type: "picker" })}><${Icon} n="plus" />${t("add_products")}</button>
    <//>
    <${Templates} />
  </div>`;
  const cmp = basketCompare();
  const chains = activeChains();
  return html`<div class="stack-l">
    <${BasketSummary} cmp=${cmp} />
    <section>
      <div class="section-h"><h2 class="grow">${t("basket_title")} <span class="muted small">· ${t("n_products", { n: u.basket.length })}</span></h2>
        <button type="button" class="btn small primary" onClick=${() => openSheet({ type: "picker" })}><${Icon} n="plus" s=${18} />${t("add")}</button></div>
      <div class="list">${u.basket.map(it => {
        const p = X.P.get(it.p);
        const mp = minPrice(it.p, OPT());
        return html`<div class="li" key=${it.p}>
          <${ProductThumb} p=${p} size=${40} />
          <button type="button" class="grow" style="text-align:left;background:none;border:0;padding:0;min-width:0" onClick=${() => openSheet({ type: "product", id: it.p })}>
            <div class="t">${tl(p)}</div><div class="s">${it.n} × ${p["ref_" + LANG]}${mp ? " · " + t("from_price", { p: eur(mp.cost) }) : ""}</div>
          </button>
          <${Stepper} value=${it.n} onChange=${v => setQty(it.p, v)} label=${tl(p)} />
        </div>`;
      })}</div>
      <div class="row" style="margin-top:8px">${confirm
        ? html`<div class="grow"><${ConfirmInline} text=${t("confirm_clear", { n: u.basket.length })} yes=${t("confirm_clear_yes")} onYes=${() => { updUser({ basket: [] }); setConfirm(false); }} onNo=${() => setConfirm(false)} /></div>`
        : html`<button type="button" class="link-btn" style="color:var(--ink-2)" onClick=${() => setConfirm(true)}>${t("clear_basket")}</button>`}</div>
    </section>
    <${StaleBanner} compact=${true} />
    <${CompareOptions} />
    ${chains.length ? html`<${CompareResults} cmp=${cmp} />` : html`<div class="callout warn">${t("chains_none")}</div>`}
    <${QPCard} cmp=${cmp} />
  </div>`;
}
function CompareOptions() {
  const u = S.user;
  const chains = activeChains();
  return html`<details class="card">
    <summary class="row" style="cursor:pointer;list-style:none"><${Icon} n="sliders" /><b class="grow">${t("options")}</b>
      <span class="small muted" style="text-align:right">${t("brand_" + u.brand)} · ${t("n_chains", { n: chains.length })}</span><${Icon} n="chevD" /></summary>
    <div class="stack" style="margin-top:14px">
      <div class="field"><span class="lab">${t("brand_label")}</span>
        <${Seg} label=${t("brand_label")} value=${u.brand} onChange=${v => updUser({ brand: v })} options=${[{ v: "any", l: t("brand_any") }, { v: "mb", l: t("brand_mb") }, { v: "fab", l: t("brand_fab") }]} /></div>
      <${Toggle} checked=${u.fresh} onChange=${v => updUser({ fresh: v })} label=${t("fresh_label")} />
      <${Toggle} checked=${u.estimate} onChange=${v => updUser({ estimate: v })} label=${t("est_label")} />
      <${DistanceOptions} />
      <${ChainPicker} />
    </div>
  </details>`;
}
function ChainPicker() {
  const sel = activeChains();
  const toggle = id => {
    const cur = activeChains();
    const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.concat([id]);
    updUser({ chains: next.length ? next : [] });
  };
  return html`<div class="field"><span class="lab">${t("chains_label")}</span>
    <div class="chips">${X.D.chains.map(c => html`<button type="button" key=${c.id} class="filter" aria-pressed=${String(sel.includes(c.id))} onClick=${() => toggle(c.id)}>${c.name}${c.n_products ? "" : " *"}</button>`)}</div>
    <p class="xs faint">* ${t("status_sense")} / ${t("status_ofertes")}</p></div>`;
}
function CompareResults({ cmp }) {
  const u = S.user;
  const ref = useRef(null);
  useInView(ref, () => emit("basket:results", { n: u.basket.length }), [u.basket.length]);
  const [view, setView] = useState("bars");
  if (!cmp || !cmp.best) return html`<div class="callout warn" ref=${ref}>${t("no_prices")}</div>`;
  const best = cmp.best;
  const selId = u.selChain && cmp.rows.find(r => r.cid === u.selChain && r.k > 0) ? u.selChain : best.cid;
  const sel = cmp.rows.find(r => r.cid === selId);
  const worst = cmp.ranked.length > 1 ? cmp.ranked[cmp.ranked.length - 1] : null;
  const save = worst ? cmp.key(worst) - cmp.key(best) : 0;
  return html`<section class="stack" ref=${ref} id="results" style="scroll-margin-top:72px">
    <div class="section-h"><h2 class="grow">${t("where_cheapest")}</h2></div>
    <div class="card raised stack">
      <span class="eyebrow">${t("best_single")}</span>
      <div class="row"><div class="grow stack-s">
        <${ChainBadge} cid=${best.cid} strong=${true} />
        <span class="small muted">${t("covers", { k: best.k, n: best.n })}${best.ne && u.estimate ? " · " + t("est_n", { n: best.ne }) : ""}</span>
        ${nearestOf(best.cid) ? html`<span class="xs muted"><${Icon} n="pin" s=${12} /> ${t("near_at", { km: fmtNum(nearestOf(best.cid).km), name: nearestOf(best.cid).name })}</span>` : null}
        ${save > 0.05 ? html`<span class="chip good" style="align-self:flex-start">${t("savings_vs", { x: eur(save), chain: X.C.get(worst.cid).name })}</span>` : null}
      </div><${PriceTag} v=${cmp.key(best)} lg=${true} /></div>
      <div class="row"><span class="small muted grow">${t("tap_bar")}</span>
        <${Seg} label=${t("chart_title")} value=${view} onChange=${setView} options=${[{ v: "bars", l: t("chart_bars") }, { v: "table", l: t("chart_table") }]} /></div>
      ${view === "bars" ? html`<${BasketBars} cmp=${cmp} selId=${selId} />` : html`<${BasketTable} cmp=${cmp} selId=${selId} />`}
      ${cmp.low.length ? html`<p class="xs faint">${t("insufficient", { list: cmp.low.map(r => X.C.get(r.cid).name + " (" + r.k + "/" + r.n + ")").join(", ") })}</p>` : null}
      ${cmp.minTotal ? html`<p class="xs muted">${t("theoretical", { x: eur(cmp.minTotal) })}</p>` : null}
      <p class="xs muted">${t("how_calc", { k: best.k, n: best.n })}${best.ne && u.estimate ? " " + t("how_calc_est", { n: best.ne, idx: best.idx ? Math.round(best.idx) : "—" }) : ""} <button type="button" class="link-btn xs" style="padding:0" onClick=${() => openSheet({ type: "method" })}>${t("how_more")}</button></p>
    </div>
    <${PairCard} cmp=${cmp} />
    ${sel ? html`<${Receipt} row=${sel} cmp=${cmp} />` : null}
    ${sel ? html`<div class="act-main">
      <button type="button" class="btn primary" onClick=${() => openSheet({ type: "shoplist", cid: sel.cid })}><${Icon} n="check" s=${18} />${t("shop_open", { chain: X.C.get(sel.cid).name })}</button>
      <button type="button" class="btn ghost" onClick=${() => openSheet({ type: "purchase", cid: sel.cid })}><${Icon} n="receipt" s=${18} />${t("buy_done")}</button>
    </div>` : null}
    <div class="act-row" role="group" aria-label=${t("more_actions")}>
      <button type="button" onClick=${() => shareBasket(u.basket)}><${Icon} n="share" s=${20} /><span>${t("share_basket")}</span></button>
      <button type="button" onClick=${() => copyText(basketText(sel, u.basket))}><${Icon} n="copy" s=${20} /><span>${t("act_copy")}</span></button>
      ${canDownload() ? html`<button type="button" onClick=${() => download("llista-preuet-" + isoToday() + ".txt", basketText(sel, u.basket))}><${Icon} n="download" s=${20} /><span>${t("act_download")}</span></button>` : null}
      <button type="button" onClick=${() => openSheet({ type: "schedNew" })}><${Icon} n="calendar" s=${20} /><span>${t("act_periodic")}</span></button>
    </div>
  </section>`;
}
function BasketBars({ cmp, selId }) {
  const u = S.user;
  const rows = cmp.ranked;
  const max = Math.max(...rows.map(r => (u.estimate ? r.estTotal : r.total)), 0.01);
  const [tip, setTip] = useState(null);
  const anyEst = u.estimate && rows.some(r => r.ne > 0);
  return html`<div style="position:relative">
    <div class="bars" role="group" aria-label=${t("chart_title")}>
      ${rows.map(r => {
        const real = r.total / max * 100, est = u.estimate ? r.est / max * 100 : 0;
        const isBest = r === cmp.best;
        const tipText = X.C.get(r.cid).name + " · " + eur(r.total) + " (" + t("covers", { k: r.k, n: r.n }) + ")" + (u.estimate && r.ne ? " + ~" + eur(r.est) : "") + (r.idx ? " · " + t("index_short", { x: Math.round(r.idx) }) : "");
        return html`<button type="button" key=${r.cid} class=${"bar" + (isBest ? " best" : "")} aria-pressed=${String(r.cid === selId)} aria-label=${tipText}
          onClick=${() => { updUser({ selChain: r.cid }); emit("basket:chain", { cid: r.cid }); }}
          onMouseEnter=${e => setTip({ text: tipText, y: e.currentTarget.offsetTop })} onMouseLeave=${() => setTip(null)} onFocus=${e => setTip({ text: tipText, y: e.currentTarget.offsetTop })} onBlur=${() => setTip(null)}>
          <span class="lab"><${ChainBadge} cid=${r.cid} short=${true} /></span>
          <span class="track" style="display:flex;gap:2px">
            <span class="fill" style=${{ width: real + "%", borderRadius: est > 0 ? "0" : "0 4px 4px 0" }}></span>
            ${est > 0 ? html`<span class="fill est" style=${{ width: est + "%", opacity: 1, background: "repeating-linear-gradient(135deg, var(--ink-3) 0 2px, transparent 2px 5px)", borderRadius: "0 4px 4px 0" }}></span>` : null}
          </span>
          <span class="val">${eur(u.estimate ? r.estTotal : r.total)}<small>${r.k}/${r.n}${u.estimate && r.ne ? " · ~" + r.ne : ""}</small></span>
        </button>`;
      })}
    </div>
    ${tip ? html`<div class="card" role="tooltip" style=${{ position: "absolute", left: "0", right: "0", top: Math.max(0, tip.y - 44) + "px", padding: "6px 10px", fontSize: "var(--t-xs)", boxShadow: "var(--shadow)", pointerEvents: "none" }}>${tip.text}</div>` : null}
    ${anyEst ? html`<div class="row xs muted" style="margin-top:8px;gap:14px"><span class="row" style="gap:6px"><i style="width:14px;height:8px;background:var(--ink-3);opacity:.55;border-radius:2px;display:inline-block"></i>${t("chart_key_real")}</span>
      <span class="row" style="gap:6px"><i style="width:14px;height:8px;background:repeating-linear-gradient(135deg, var(--ink-3) 0 2px, transparent 2px 5px);border-radius:2px;display:inline-block"></i>${t("chart_key_est")}</span></div>` : null}
  </div>`;
}
function BasketTable({ cmp, selId }) {
  const u = S.user;
  return html`<div class="tbl-wrap"><table class="tbl" style="min-width:0">
    <thead><tr><th>${t("tbl_chain")}</th><th style="text-align:right">${t("tbl_total")}</th><th style="text-align:right">${t("tbl_cov")}</th><th style="text-align:right">${t("tbl_index")}</th></tr></thead>
    <tbody>${cmp.ranked.concat(cmp.low).map(r => html`<tr key=${r.cid} style=${r.cid === selId ? "background:var(--plum-soft)" : ""} onClick=${() => updUser({ selChain: r.cid })}>
      <td>${X.C.get(r.cid).name}</td><td class="n">${eur(u.estimate && cmp.ranked.includes(r) ? r.estTotal : r.total)}</td><td class="n">${r.k}/${r.n}</td><td class="n">${r.idx ? Math.round(r.idx) : "—"}</td></tr>`)}</tbody>
  </table></div>`;
}
function PairCard({ cmp }) {
  const pr = cmp.pair, best = cmp.best;
  const [open, setOpen] = useState(false);
  if (!pr || !best || pr.k < best.k) return null;
  const worth = pr.save >= 1 || pr.extra > 0;
  const A = X.C.get(pr.a.cid), B = X.C.get(pr.b.cid);
  return html`<div class="card stack-s">
    <span class="eyebrow">${t("pair_title")}</span>
    ${worth ? html`
      <div class="row"><span class="grow">${t("pair_body", { a: A.name, b: B.name, total: eur(pr.total) })}</span></div>
      ${pr.save >= 0.05 ? html`<span class="chip good" style="align-self:flex-start">${t("pair_save", { save: eur(pr.save) })}</span>` : null}
      ${pr.extra ? html`<span class="small muted">${t("pair_more", { n: pr.extra })}</span>` : null}
      <button type="button" class="link-btn" style="align-self:flex-start" aria-expanded=${String(open)} onClick=${() => setOpen(!open)}>${t("pair_split")} ${open ? "▴" : "▾"}</button>
      ${open ? html`<div class="stack-s">${[["a", pr.a.cid], ["b", pr.b.cid]].map(([w, cid]) => html`<div key=${w}><${ChainBadge} cid=${cid} />
        <ul class="small" style="margin:6px 0 0;padding-left:1.2em">${S.user.basket.map((it, i) => pr.pick[i] === w ? html`<li key=${it.p}>${it.n} × ${tl(X.P.get(it.p))} · ${eur((w === "a" ? pr.a : pr.b).lines[i].cost)}</li>` : null)}</ul></div>`)}</div>` : null}`
    : html`<span class="small">${t("pair_not_worth", { save: eur(Math.max(0, pr.save)) })}</span>`}
  </div>`;
}
function Receipt({ row, cmp }) {
  const u = S.user;
  const ch = X.C.get(row.cid);
  return html`<div>
    <div class="receipt" aria-label=${t("receipt_at") + " " + ch.name}>
      <div class="rhead"><span class="eyebrow">${t("receipt_at")}</span><b>${ch.name}</b><span class="xs faint">${fmtDL(X.D.meta.updated)} · ${S.user.town}</span></div>
      ${u.basket.map((it, i) => {
        const p = X.P.get(it.p);
        const l = row.lines[i];
        if (l) return html`<div class="rline" key=${it.p}><span class="n">${it.n} × ${tl(p)}</span><span>${eur(l.cost)}</span>
          <span class="d">${l.o.name} · ${packText(l, p)}${l.o.promo && !/^origen/i.test(l.o.promo) ? " · " + l.o.promo : ""}${l.o.st === "comunitat" ? " · " + t("src_comunitat") : ""}</span></div>`;
        const m = cmp.mins[i];
        const est = row.estLines[i];
        return html`<div class="rline" key=${it.p} style="color:var(--ink-3)"><span class="n">${it.n} × ${tl(p)}</span><span>${u.estimate && est != null ? "~" + eur(est) : "—"}</span>
          <span class="d">${t("no_price_here", { chain: ch.name })}${m.cost != null ? " · " + t("cheaper_at", { chain: X.C.get(m.cid).name, p: eur(m.cost) }) : " · " + t("no_price_anywhere")}</span></div>`;
      })}
      <div class="rtotal"><span>${t("receipt_total_real")}</span><span>${eur(row.total)}</span></div>
      ${u.estimate && row.ne ? html`<div class="rline" style="font-weight:500"><span class="n">${t("receipt_total_est")}</span><span>~${eur(row.estTotal)}</span></div>` : null}
    </div><div class="receipt-gap"></div>
    <p class="xs faint">${t("receipt_note")}</p>
  </div>`;
}
function QPCard({ cmp }) {
  const u = S.user;
  const rows = qpRows(cmp, activeChains(), u.w, S.community);
  const [pick, setPick] = useState(null);
  const p = Math.round(u.w * 100);
  return html`<section class="card stack">
    <div><h3>${t("qp_title")}</h3><p class="small muted">${t("qp_sub")}</p></div>
    <div class="stack-s">
      <div class="row small"><b>${t("qp_quality")}</b><span class="grow"></span><b>${t("qp_price")}</b></div>
      <input type="range" class="slider" min="0" max="100" step="10" value=${p} aria-label=${t("qp_weight", { p, q: 100 - p })}
        onInput=${e => { updUser({ w: Number(e.currentTarget.value) / 100 }); emit("qp:change", {}); }} />
      <span class="small muted" style="text-align:center">${t("qp_weight", { p, q: 100 - p })}</span>
    </div>
    <div>${rows.map((r, i) => html`<button type="button" class="qp" key=${r.cid} style="width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left"
        aria-pressed=${String(pick === r.cid)} onClick=${() => { setPick(r.cid); updUser({ selChain: r.cid }); emit("qp:pick", { cid: r.cid }); }}>
      <span class="row" style="min-width:0"><span class="faint num" style="width:18px">${i + 1}</span><${ChainBadge} cid=${r.cid} />${pick === r.cid ? html`<span class="chip plum">${t("qp_pick")}</span>` : null}</span>
      <span class="score">${r.score == null ? "—" : Math.round(r.score)}</span>
      <span class="meter"><span style=${{ width: (r.score == null ? 0 : r.score) + "%" }}></span></span>
      <span class="xs muted" style="grid-column:1/-1">${t("index_short", { x: Math.round(r.idx) })} · ${r.quality == null ? t("qp_noquality") : t("qp_quality") + " " + Math.round(r.quality) + (X.C.get(r.cid).ocu != null ? " (OCU" + (r.crowd.n ? " + " + r.crowd.n + "★" : "") + ")" : " (" + r.crowd.n + "★)")}</span>
    </button>`)}</div>
    <p class="xs faint">${t("qp_explain")}</p>
  </section>`;
}

/* ---------- offers ---------- */
function Offers() {
  const today = isoToday();
  const [mode, setMode] = useState("now");
  const [ch, setCh] = useState(null);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [shown, setShown] = useState(30);
  const inBasket = new Set(S.user.basket.map(x => x.p).concat(S.user.watch || []));
  const all = X.D.offers.map(o => Object.assign({ _s: offerStatus(o, today) }, o)).filter(o => o._s !== "ended");
  const nNow = all.filter(o => o._s === "now").length, nNext = all.filter(o => o._s === "next").length;
  const chainsHere = [...new Set(all.filter(o => o._s === mode).map(o => o.c))];
  const words = norm(q).split(" ").filter(Boolean);
  let list = all.filter(o => o._s === mode && (!ch || o.c === ch) && (!mine || (o.p && inBasket.has(o.p)))
    && words.every(w => norm(o.title + " " + (o.p && X.P.has(o.p) ? tl(X.P.get(o.p)) : "")).includes(w)));
  const disc = o => (o.was && o.price ? 1 - o.price / o.was : 0);
  list.sort((a, b) => mode === "next" ? (a.frm < b.frm ? -1 : a.frm > b.frm ? 1 : disc(b) - disc(a)) : disc(b) - disc(a) || (a.c < b.c ? -1 : 1));
  const reset = () => setShown(30);
  return html`<div class="stack-l">
    <div><h2 style="font-size:var(--t-xl)">${t("offers_title")}</h2><p class="small muted">${t("offers_sub", { date: fmtDL(X.D.meta.updated) })}</p></div>
    <${Seg} label=${t("offers_title")} value=${mode} onChange=${v => { setMode(v); setCh(null); reset(); }} options=${[{ v: "now", l: t("offers_now") + " · " + nNow }, { v: "next", l: t("offers_next") + " · " + nNext }]} />
    <div class="search" role="search" style="margin-top:0"><${Icon} n="search" /><input type="search" value=${q} placeholder=${t("offers_search")} aria-label=${t("offers_search")} onInput=${e => { setQ(e.currentTarget.value); reset(); }} /></div>
    <div class="filters">
      <button type="button" class="filter" aria-pressed=${String(mine)} onClick=${() => { setMine(!mine); reset(); }}><${Icon} n="basket" s=${15} /> ${t("offers_mine")}</button>
      <button type="button" class="filter" aria-pressed=${String(!ch)} onClick=${() => { setCh(null); reset(); }}>${t("all_f")}</button>
      ${chainsHere.map(c => html`<button type="button" key=${c} class="filter" aria-pressed=${String(ch === c)} onClick=${() => { setCh(c); reset(); }}>${X.C.get(c).name}</button>`)}
    </div>
    <p class="xs muted" aria-live="polite">${t("offers_count", { n: list.length })}</p>
    ${list.length ? html`<div class="offer-grid">${list.slice(0, shown).map((o, i) => html`<${OfferCard} key=${o.c + i + o.title} o=${o} />`)}</div>
      ${list.length > shown ? html`<button type="button" class="btn ghost" onClick=${() => setShown(shown + 30)}>${t("show_more_n", { n: Math.min(30, list.length - shown) })}</button>` : null}`
      : html`<${Empty} title=${mine ? t("offers_mine_none") : t("no_offers")} />`}
    <p class="xs faint">${t("offers_note_merc")}</p>
  </div>`;
}
function OfferCard({ o }) {
  const d = o.was && o.price ? Math.round((1 - o.price / o.was) * 100) : null;
  const dates = o.to ? (o.frm && o.frm > isoToday() ? t("from_to", { a: fmtD(o.frm), b: fmtD(o.to) }) : t("until", { d: fmtD(o.to) })) : (o.frm > isoToday() ? t("starts", { d: fmtD(o.frm) }) : null);
  const p = o.p ? X.P.get(o.p) : null;
  const open = p ? () => openSheet({ type: "product", id: p.id }) : null;
  const inB = p && qtyOf(p.id) > 0;
  return html`<article class="offer-card">
    ${p ? html`<${ProductThumb} p=${p} size=${56} />` : html`<span class="offer-ic" aria-hidden="true"><${Icon} n="tag" s=${24} /></span>`}
    <div class="grow stack-s" style="min-width:0;gap:4px">
      <div class="row" style="gap:6px;flex-wrap:wrap"><${ChainBadge} cid=${o.c} />${dates ? html`<span class="xs muted"><${Icon} n="clock" s=${12} /> ${dates}</span>` : null}</div>
      ${open ? html`<button type="button" class="offer-title" onClick=${open}>${o.title}</button>` : html`<b class="offer-title">${o.title}</b>`}
      <div class="chips">${d && d > 0 ? html`<span class="chip good">−${d} %</span>` : null}${o.mech ? html`<span class="chip plum">${o.mech}</span>` : null}${inB ? html`<span class="chip">${t("in_your_basket")}</span>` : null}</div>
      ${o.src ? html`<a class="xs" href=${o.src} target="_blank" rel="noopener noreferrer">${t("see_source")} ↗</a>` : null}
    </div>
    ${o.price != null ? html`<span class="stack-s" style="align-items:flex-end;gap:2px"><${PriceTag} v=${o.price} />${o.was ? html`<span class="was">${eur(o.was)}</span>` : null}</span>` : html`<span class="chip">${t("promo_card")}</span>`}
  </article>`;
}

/* ---------- recipes ---------- */
function Recipes() {
  const [f, setF] = useState({});
  const opt = OPT();
  const chains = activeChains();
  const diets = S.user.diets;
  let rows = X.D.recipes.map(r => {
    const b = memo("rb:" + r.id, [S.user.chains, S.user.brand, S.user.fresh, S.community], () => recipeBest(r, chains, opt));
    return { r, b, diet: recipeDiet(r) };
  });
  rows = rows.filter(x => (!f.quick || x.r.mins <= 20) && (!f.under2 || (x.b && x.b.per < 2)) && (!f.veg || x.diet.vt) && (!f.sg || x.diet.sg)
    && (!f.mine || diets.every(d => x.diet[d])));
  rows.sort((a, b) => (a.b ? a.b.per : 99) - (b.b ? b.b.per : 99));
  const chip = (k, l) => html`<button type="button" class="filter" key=${k} aria-pressed=${String(!!f[k])} onClick=${() => setF(Object.assign({}, f, { [k]: !f[k] }))}>${l}</button>`;
  return html`<div class="stack-l">
    <div><h2 style="font-size:var(--t-xl)">${t("recipes_title")}</h2><p class="small muted">${t("recipes_sub")}</p></div>
    <div class="filters">${chip("under2", t("filter_under2"))}${chip("quick", t("filter_quick"))}${chip("veg", t("filter_veg"))}${chip("sg", t("filter_sg"))}${diets.length ? chip("mine", t("filter_mydiet")) : null}</div>
    ${rows.length ? html`<div class="list">${rows.map(({ r, b, diet }) => {
      const st = stockMap();
      const out = b && b.cid ? r.ing.filter(([pid]) => { const s = st.get(pid + "|" + b.cid); return s && s.s === "no"; }).length : 0;
      return html`<button type="button" class="li" key=${r.id} onClick=${() => openSheet({ type: "recipe", id: r.id })}>
        <span class="grow stack-s" style="min-width:0"><span class="t">${tl(r)}</span>
          <span class="s">${t("minutes", { n: r.mins })} · ${t("servings", { n: r.serv })}${b ? " · " + (b.cid ? t("best_at", { chain: X.C.get(b.cid).name }) : t("mix_chains")) : ""}</span>
          <span class="chips">${diet.vg ? html`<span class="chip good">${t("tag_vg")}</span>` : diet.vt ? html`<span class="chip good">${t("tag_vt")}</span>` : null}${diet.sg ? html`<span class="chip">${t("tag_sg")}</span>` : null}
            ${b && b.miss ? html`<span class="chip warn">${t("recipe_missing", { n: b.miss })}</span>` : null}${out ? html`<span class="chip bad">${t("stock_no")}: ${out}</span>` : null}</span></span>
        ${b ? html`<${PriceTag} v=${b.per} sub=${LANG === "es" ? "/ración" : "/ració"} />` : null}
      </button>`;
    })}</div>` : html`<${Empty} title=${t("no_recipes")} />`}
    <p class="xs faint">${t("recipe_unit_note")}</p>
  </div>`;
}

/* ---------- more ---------- */
function More() {
  const items = [
    ["calendar", "periodic", "periodic_sub", "schedules"], ["receipt", "sav_title", "sav_sub", "savings"], ["store", "supermarkets", "supermarkets_sub", "chains"],
    ["users", "community", "community_sub_short", "community"], ["user", "profile", "profile_sub", "profile"],
    ["scale", "method", "method_sub", "method"], ["flask", "test_mode", "test_mode_sub", "test"],
    ["msg", "feedback", "feedback_sub", "feedback"], ["info", "about", "about_sub", "about"],
  ];
  return html`<div class="stack-l">
    <h2 style="font-size:var(--t-xl)">${t("more_title")}</h2>
    <div class="list">${items.map(([ic, k, sub, type]) => html`<button type="button" class="li" key=${type} onClick=${() => openSheet({ type })}>
      <span style="color:var(--plum)"><${Icon} n=${ic} s=${22} /></span>
      <span class="grow"><span class="t" style="display:block">${t(k)}</span><span class="s">${t(sub)}</span></span>
      ${type === "schedules" && S.user.schedules.length ? html`<span class="chip">${S.user.schedules.length}</span>` : null}
      <span class="chev"><${Icon} n="chevR" /></span></button>`)}</div>
  </div>`;
}
