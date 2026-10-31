/* ===== sheets_product.js ===== */
/* ---------- contributions ---------- */
async function contribute(item, okMsg) {
  try {
    await Store.addContribution(Object.assign({ town: S.user.town, nick: S.user.nick }, item));
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    toast(e && e.code === "quota_exceeded" ? t("quota_full") : t("write_failed"));
    set({});
    return false;
  }
}
function ContribGate({ children }) {
  if (!Store.canContribute()) {
    const msg = Store.mode === "claude" && !Store.me.id ? t("signin_needed") : t("readonly_note");
    return html`<p class="small muted">${msg}</p>`;
  }
  return html`<div class="stack">${children}
    ${Store.sandbox ? html`<p class="xs faint">${t("test_note")}</p>` : Store.mode === "local" ? html`<p class="xs faint">${t("local_note")}</p>` : null}</div>`;
}
function nameOf(c) {
  if (c.uid && Store.me.id && c.uid === Store.me.id) return t("you");
  const p = S.profiles[c.uid];
  return (p && p.name) || c.nick || t("someone");
}
function canDelete(c) { return (Store.me.id && c.uid === Store.me.id) || Store.me.isOwner || (Store.sandbox && Store.sandboxItems.some(x => x.id === c.id)) || Store.mode === "local"; }
function targetLabel(c) {
  const tg = c.target || "";
  if (c.p) return tl(X.P.get(c.p));
  if (tg.startsWith("p:")) { const p = X.P.get(tg.slice(2)); return p ? tl(p) : ""; }
  if (tg.startsWith("c:")) { const ch = X.C.get(tg.slice(2)); return ch ? ch.name : ""; }
  if (tg.startsWith("r:")) { const r = X.R.get(tg.slice(2)); return r ? tl(r) : ""; }
  if (tg === "app") return t("app_target");
  return "";
}
function openTarget(c) {
  const tg = c.target || "";
  if (c.p) return openSheet({ type: "product", id: c.p });
  if (tg.startsWith("p:")) return openSheet({ type: "product", id: tg.slice(2) });
  if (tg.startsWith("c:")) return openSheet({ type: "chain", id: tg.slice(2) });
  if (tg.startsWith("r:")) return openSheet({ type: "recipe", id: tg.slice(2) });
}
function FeedItem({ c, hideTarget }) {
  const p = S.profiles[c.uid];
  const [busy, setBusy] = useState(false);
  let body;
  if (c.t === "stock") body = html`<span class=${"chip " + (c.s === "si" ? "good" : c.s === "poc" ? "warn" : "bad")}>${t("stock_" + c.s)}</span> ${X.C.get(c.c).name}`;
  else if (c.t === "price") body = html`<b class="num">${eur(c.price)}</b> · ${fmtQty(c.size, X.P.get(c.p).unit)} · ${X.C.get(c.c).name}${commPriceCheck().get(c.id) === "doubt" ? html` <span class="chip warn" title=${t("price_doubt_note")}>${t("price_doubt")}</span>` : null}`;
  else if (c.t === "rating") body = html`<${Stars} value=${c.stars} label=${t("stars_n", { n: c.stars })} />`;
  else if (c.t === "origin") body = html`${t("c_origin", { o: c.txt })}${c.c ? " · " + X.C.get(c.c).name : ""}`;
  else body = html`<span style="white-space:pre-wrap;overflow-wrap:anywhere">${c.txt}</span>`;
  const tgt = hideTarget ? "" : targetLabel(c);
  return html`<div class="feed-item">
    ${p && p.avatarUrl ? html`<img class="avatar" src=${p.avatarUrl} alt="" />` : html`<span class="avatar" style="display:grid;place-items:center;color:var(--ink-3)"><${Icon} n="user" s=${16} /></span>`}
    <div class="grow stack-s" style="min-width:0;gap:3px">
      <div class="xs muted"><b style="color:var(--ink)">${nameOf(c)}</b> · ${ago(c.ts)}${c.town ? " · " + c.town : ""}</div>
      ${tgt ? html`<button type="button" class="link-btn" style="text-align:left;padding:0" onClick=${() => openTarget(c)}>${tgt}</button>` : null}
      <div class="small">${body}</div>
    </div>
    ${canDelete(c) ? html`<button type="button" class="icon-btn" style="width:32px;height:32px" disabled=${busy} aria-label=${t("del")} onClick=${async () => {
      setBusy(true);
      try { await Store.removeContribution(c.uid, c.id); toast(t("deleted")); } catch (e) { toast(t("write_failed")); }
      setBusy(false);
    }}><${Icon} n="trash" s=${16} /></button>` : null}
  </div>`;
}
function CommentsBlock({ target, title }) {
  const [txt, setTxt] = useState("");
  const list = S.community.filter(c => (c.t === "comment" || c.t === "suggest") && c.target === target).sort((a, b) => b.ts - a.ts);
  const crowd = crowdOf(target, S.community);
  const mine = S.community.filter(c => c.t === "rating" && c.target === target && c.uid === Store.me.id).sort((a, b) => b.ts - a.ts)[0];
  return html`<section class="card stack">
    <div class="row"><h3 class="grow">${title || t("comments")}</h3>${crowd.n ? html`<span class="xs muted">${t("avg_rating", { x: fmtNum(Math.round(crowd.avg * 10) / 10), n: crowd.n })}</span>` : null}</div>
    <${ContribGate}>
      <div class="row"><span class="small muted grow">${t("your_rating")}</span>
        <${Stars} value=${mine ? mine.stars : 0} label=${t("your_rating")} onChange=${v => contribute({ t: "rating", target, stars: v }, t("rating_sent"))} /></div>
      <form class="stack-s" onSubmit=${async e => { e.preventDefault(); if (!txt.trim()) return; if (await contribute({ t: "comment", target, txt: txt.trim() }, t("comment_sent"))) setTxt(""); }}>
        <div class="field"><label class="sr" for=${"cm-" + target}>${t("comments")}</label>
          <textarea id=${"cm-" + target} maxlength="280" placeholder=${t("comment_ph")} value=${txt} onInput=${e => setTxt(e.currentTarget.value)}></textarea></div>
        <button type="submit" class="btn small primary" style="align-self:flex-end" disabled=${!txt.trim()}>${t("send")}</button>
      </form>
    <//>
    ${list.length ? html`<div>${list.slice(0, 30).map(c => html`<${FeedItem} key=${c.id} c=${c} hideTarget=${true} />`)}</div>` : html`<p class="small muted">${t("comment_none")}</p>`}
  </section>`;
}

/* ---------- product sheet ---------- */
function ProductSheet({ id }) {
  const p = X.P.get(id);
  const nutRef = useRef(null), alRef = useRef(null);
  useEffect(() => { emit("product:open", { id }); }, [id]);
  useInView(nutRef, () => emit("product:nutrition", { id }), [id]);
  useInView(alRef, () => emit("product:allergens", { id }), [id]);
  if (!p) return null;
  const cat = X.CAT.get(p.cat);
  const opt = OPT_ALL();
  const rows = X.D.chains.map(c => ({ c, l: itemAt(p.id, 1, c.id, opt), all: eligible(p.id, c.id, opt) })).filter(r => r.l).sort((a, b) => a.l.cost - b.l.cost);
  const none = X.D.chains.filter(c => !rows.some(r => r.c.id === c.id));
  const qty = qtyOf(id);
  const avoid = (p.allergens || []).filter(a => S.user.avoid.includes(a));
  const foot = html`<div class="row">${qty ? html`<span class="grow small">${t("in_basket", { n: qty })}</span><${Stepper} value=${qty} onChange=${v => setQty(id, v)} label=${tl(p)} />`
    : html`<button type="button" class="btn primary block" onClick=${() => { addToBasket(id); toast(t("added_to_basket")); }}><${Icon} n="basket" />${t("add_to_basket")}</button>`}</div>`;
  return html`<${Sheet} title=${tl(p)} onClose=${closeSheet} foot=${foot} id=${id}>
    <div class="stack-l">
      <${ProductPhoto} p=${p} />
      <div class="ph stack-s">
        <span class="eyebrow">${tl(cat)} · ${p["ref_" + LANG]}</span>
        <h1>${tl(p)}</h1>
        <div class="row wrap-ok"><${WatchButton} pid=${p.id} /></div>
        <div class="chips">${(p.tags || []).map(tg => html`<span class=${"chip " + (DIET_TAGS.includes(tg) ? "good" : "plum")} key=${tg}>${t("tag_" + tg)}</span>`)}</div>
        ${avoid.length ? html`<div class="callout warn" role="alert">${t("allergen_warn", { a: avoid.map(a => t("al_" + a)).join(", ") })}</div>` : null}
        <p class="xs muted">${p.kind === "marca" ? t("brand_note") : t("equivalent_note")} ${t("ref_qty", { ref: p["ref_" + LANG] })}.</p>
      </div>
      <section class="stack-s">
        <div class="section-h"><h2 class="grow">${t("prices_by_chain")}</h2></div>
        ${rows.length ? html`<div class="list">${rows.map((r, i) => html`<${OfferRow} key=${r.c.id} r=${r} p=${p} best=${i === 0} />`)}</div>` : html`<${Empty} title=${t("no_prices")} />`}
        ${none.length ? html`<p class="xs faint">${t("no_price_here", { chain: none.map(c => c.name).join(", ") })}</p>` : null}
        <${PriceReport} p=${p} />
      </section>
      <${PriceHistory} p=${p} />
      <section class="card stack" ref=${nutRef}>
        <div class="row"><h3 class="grow">${t("nutrition")}</h3><span class="xs muted">${t("per100", { b: p.nut && p.nut.basis === "ml" ? "ml" : "g" })}</span></div>
        <${NutritionTable} p=${p} />
        <p class="xs faint">${t("nut_note")}</p>
      </section>
      <section class="card stack-s" ref=${alRef}>
        <h3>${t("allergens")}</h3>
        ${(p.allergens || []).length ? html`<div class="chips">${p.allergens.map(a => html`<span key=${a} class=${"chip " + (S.user.avoid.includes(a) ? "bad" : "warn")}><${Icon} n="shield" s=${13} />${t("al_" + a)}</span>`)}</div>` : html`<p class="small">${t("no_allergens")}</p>`}
        ${(p.traces || []).length ? html`<p class="small muted">${t("traces")}: ${p.traces.map(a => t("al_" + a)).join(", ")}</p>` : null}
        <p class="xs faint">${t("allergen_note")}</p>
      </section>
      <${OriginBlock} p=${p} />
      <${StockBlock} pid=${id} />
      <${CommentsBlock} target=${"p:" + id} />
    </div>
  <//>`;
}
function OfferRow({ r, p, best }) {
  const [open, setOpen] = useState(false);
  const o = r.l.o;
  const stale = daysBetween(o.date, X.D.meta.updated) > FRESH_DAYS;
  const extra = r.all.filter(x => x !== o);
  const meta = x => html`<span class="src">
    <span>${x.st === "comparador" ? t("src_comparador") : x.st === "fullet" ? t("src_fullet") : x.st === "comunitat" ? t("src_comunitat") : t("src_web")}</span>
    ${x.bk ? html`<span>${t("bk_" + x.bk)}</span>` : null}
    <span style=${daysBetween(x.date, X.D.meta.updated) > FRESH_DAYS ? "color:var(--warn);font-weight:700" : ""}>${daysBetween(x.date, X.D.meta.updated) > FRESH_DAYS ? t("old_price", { date: fmtDL(x.date) }) : t("captured", { date: fmtDL(x.date) })}</span>
    ${x.src ? html`<a href=${x.src} target="_blank" rel="noopener noreferrer">${t("source")} ↗</a>` : null}</span>`;
  return html`<div class=${"offer-row" + (best ? " best" : "")}>
    <div class="stack-s" style="min-width:0;gap:4px"><span class="row" style="gap:8px"><${ChainBadge} cid=${r.c.id} />${best ? html`<span class="chip good">${t("cheapest_here")}</span>` : null}${stale ? html`<span class="chip warn">!</span>` : null}</span>
      <span class="row" style="gap:8px;align-items:center"><${PackThumb} o=${o} /><span class="small" style="overflow-wrap:anywhere">${o.name}</span></span></div>
    <span class="stack-s" style="align-items:flex-end;gap:2px"><${PriceTag} v=${r.l.cost} sub=${eurU(o.up, p.unit)} plain=${!best} /></span>
    <span class="pkg">${r.l.loose ? fmtQty(p.ref, p.unit) + " × " + eurU(o.up, p.unit) : t("pack_of", { s: fmtQty(o.size, p.unit), p: eur(o.price) })}${o.promo && !/^origen/i.test(o.promo) ? html` · <span class="chip plum">${o.promo}</span>` : null}</span>
    ${meta(o)}
    ${extra.length ? html`<button type="button" class="link-btn" style="grid-column:1/-1;justify-self:start" aria-expanded=${String(open)} onClick=${() => setOpen(!open)}>${open ? t("show_less") : t("other_options", { n: extra.length })}</button>` : null}
    ${open ? extra.map((x, i) => html`<div key=${i} style="grid-column:1/-1;border-top:1px dashed var(--line);padding-top:8px" class="stack-s">
      <div class="row"><span class="small grow" style="overflow-wrap:anywhere">${x.name}</span><span class="num small">${eur(x.price)}</span></div>
      <span class="xs muted">${eurU(x.up, p.unit)}${x.promo ? " · " + x.promo : ""}</span>${meta(x)}</div>`) : null}
  </div>`;
}
function NutritionTable({ p }) {
  const n = p.nut;
  if (!n) return html`<p class="small muted">${t("origin_none")}</p>`;
  const L = lights(n);
  const rowsN = [["kcal", n.kcal != null ? Math.round(n.kcal) + " kcal" : "—"], ["fat", n.fat], ["sat", n.sat], ["carb", n.carb], ["sug", n.sug], ["fib", n.fib], ["prot", n.prot], ["salt", n.salt]];
  return html`<div class="stack">
    <div class="light" role="list" aria-label=${t("light_title")}>${["fat", "sat", "sug", "salt"].map(k => L[k] ? html`<div role="listitem" key=${k} class=${L[k]}>${t(k === "sat" ? "sat_s" : k === "sug" ? "sug_s" : k)}<b>${t("l_" + L[k])}</b></div>` : null)}</div>
    <table class="nut"><tbody>${rowsN.filter(([, v]) => v != null).map(([k, v]) => html`<tr key=${k}><td style=${k === "sat" || k === "sug" ? "padding-left:14px;color:var(--ink-2)" : ""}>${t(k)}</td><td>${typeof v === "number" ? fmtNum(v) + " g" : v}</td></tr>`)}</tbody></table>
    <p class="xs faint">${t("light_note")}</p>
  </div>`;
}
function OriginBlock({ p }) {
  const [txt, setTxt] = useState("");
  const [cid, setCid] = useState("");
  const hints = originHints(p.id);
  const comm = S.community.filter(c => c.t === "origin" && c.p === p.id).sort((a, b) => b.ts - a.ts);
  const known = p["origin_" + LANG] || p.origin_ca;
  return html`<section class="card stack">
    <h3>${t("origin")}</h3>
    ${known ? html`<div class="row"><${Icon} n="globe" /><span class="grow"><b>${t("origin_known")}:</b> ${known}</span></div>` : null}
    ${hints.length ? html`<div class="stack-s"><span class="xs muted">${t("origin_hints")}</span>
      <div class="chips">${hints.map((h, i) => html`<span class="chip outline" key=${i} title=${h.name}>${X.C.get(h.c).name}: ${h.label}</span>`)}</div></div>` : null}
    <p class="small muted">${originRule(p)}</p>
    ${comm.length ? html`<div><span class="xs muted">${t("origin_community")}</span>${comm.slice(0, 8).map(c => html`<${FeedItem} key=${c.id} c=${c} hideTarget=${true} />`)}</div>` : (!known && !hints.length ? html`<p class="small">${t("origin_none")}</p>` : null)}
    <${ContribGate}>
      <form class="stack-s" onSubmit=${async e => { e.preventDefault(); if (!txt.trim()) return; if (await contribute({ t: "origin", p: p.id, c: cid || undefined, txt: txt.trim() }, t("origin_sent"))) setTxt(""); }}>
        <span class="small" style="font-weight:700">${t("origin_add")}</span>
        <div class="row wrap-ok">
          <input type="text" class="grow" style="border:1.5px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--card);min-width:150px" maxlength="80" placeholder=${t("origin_ph")} value=${txt} onInput=${e => setTxt(e.currentTarget.value)} aria-label=${t("origin_add")} />
          <select style="border:1.5px solid var(--line);border-radius:10px;padding:9px;background:var(--card)" value=${cid} onChange=${e => setCid(e.currentTarget.value)} aria-label=${t("stock_chain")}>
            <option value="">${t("stock_chain")}…</option>${X.D.chains.map(c => html`<option value=${c.id} key=${c.id}>${c.name}</option>`)}</select>
          <button type="submit" class="btn small primary" disabled=${!txt.trim()}>${t("send")}</button>
        </div>
      </form>
    <//>
  </section>`;
}
function StockBlock({ pid }) {
  const st = stockMap();
  const chains = activeChains();
  const [cid, setCid] = useState(S.user.selChain && X.C.has(S.user.selChain) ? S.user.selChain : chains[0] || "mercadona");
  const [notice, setNotice] = useState(null);
  const reported = X.D.chains.map(c => ({ c: c.id, s: st.get(pid + "|" + c.id) })).filter(x => x.s).sort((a, b) => b.s.ts - a.s.ts);
  return html`<section class="card stack">
    <div><h3>${t("stock")}</h3><p class="small muted">${t("stock_sub", { town: S.user.town })}</p></div>
    ${reported.length ? html`<div class="stack-s">${reported.map(({ c, s }) => html`<div class="row" key=${c}><${ChainBadge} cid=${c} /><span class="grow"></span>
      <span class=${"chip " + (s.s === "si" ? "good" : s.s === "poc" ? "warn" : "bad")}>${t("stock_" + s.s)}</span><span class="xs faint">${ago(s.ts)} · ${t("stock_n", { n: s.n })}</span></div>`)}</div>`
      : html`<p class="small">${t("stock_none", { town: S.user.town })}</p>`}
    <${ContribGate}>
      <div class="field"><label for=${"stk-" + pid}>${t("stock_ask")}</label>
        <select id=${"stk-" + pid} value=${cid} onChange=${e => setCid(e.currentTarget.value)}>${X.D.chains.map(c => html`<option value=${c.id} key=${c.id}>${c.name}</option>`)}</select></div>
      <div class="row wrap-ok">${["si", "poc", "no"].map(s => html`<button type="button" key=${s} class="btn small ghost" onClick=${async () => {
        if (await contribute({ t: "stock", p: pid, c: cid, s }, t("stock_thanks", { town: S.user.town }))) { emit("stock:report", { pid, cid, s }); setNotice(s === "no" ? { cid } : null); }
      }}><span class=${"chip " + (s === "si" ? "good" : s === "poc" ? "warn" : "bad")} style="padding:0 6px">●</span>${t("stock_" + s)}</button>`)}</div>
      ${notice ? html`<${NotifyChain} pid=${pid} cid=${notice.cid} />` : null}
    <//>
  </section>`;
}
function NotifyChain({ pid, cid }) {
  const ch = X.C.get(cid), p = X.P.get(pid);
  const msg = t("notify_msg", { town: S.user.town, product: tl(p).toLowerCase(), date: fmtDL(isoToday()) });
  return html`<div class="callout stack-s"><b>${t("notify_chain")}</b><p class="small">${t("notify_hint")}</p>
    <p class="small" style="background:var(--card);border-radius:8px;padding:8px 10px;user-select:all">${msg}</p>
    <div class="row wrap-ok"><button type="button" class="btn small primary" onClick=${() => copyText(msg)}><${Icon} n="copy" s=${16} />${t("copy")}</button>
      <a class="btn small ghost" href=${ch.site} target="_blank" rel="noopener noreferrer">${t("open_web", { chain: ch.name })} <${Icon} n="ext" s=${14} /></a></div></div>`;
}
function PriceReport({ p }) {
  const [cid, setCid] = useState(X.D.chains.find(c => c.status === "sense").id);
  const [price, setPrice] = useState("");
  const [size, setSize] = useState(String(p.ref).replace(".", ","));
  const pv = Number(String(price).replace(",", ".")), sv = Number(String(size).replace(",", "."));
  return html`<details class="card">
    <summary class="row" style="cursor:pointer;list-style:none"><${Icon} n="plus" /><b class="grow">${t("report_price")}</b><${Icon} n="chevD" /></summary>
    <div class="stack" style="margin-top:12px"><p class="xs muted">${t("report_price_sub")}</p>
      <${ContribGate}>
        <form class="stack" onSubmit=${async e => {
          e.preventDefault();
          if (!(pv > 0 && pv < 500 && sv > 0 && sv < 100)) { toast(t("price_invalid")); return; }
          const ref = officialRef(p.id), up = pv / sv;
          const odd = ref != null && (up < ref * 0.4 || up > ref * 1.6);
          if (await contribute({ t: "price", p: p.id, c: cid, price: Math.round(pv * 100) / 100, size: sv }, odd ? t("price_doubt_note") : t("price_sent"))) setPrice("");
        }}>
          <div class="field"><label for=${"pr-c-" + p.id}>${t("stock_chain")}</label><select id=${"pr-c-" + p.id} value=${cid} onChange=${e => setCid(e.currentTarget.value)}>${X.D.chains.map(c => html`<option value=${c.id} key=${c.id}>${c.name}</option>`)}</select></div>
          <div class="row"><div class="field grow"><label for=${"pr-p-" + p.id}>${t("price_eur")}</label><input id=${"pr-p-" + p.id} type="text" inputmode="decimal" value=${price} onInput=${e => setPrice(e.currentTarget.value)} placeholder="1,25" /></div>
            <div class="field grow"><label for=${"pr-s-" + p.id}>${t("pack_size", { u: t("u_" + p.unit) })}</label><input id=${"pr-s-" + p.id} type="text" inputmode="decimal" value=${size} onInput=${e => setSize(e.currentTarget.value)} /></div></div>
          <button type="submit" class="btn small primary" style="align-self:flex-start">${t("send")}</button>
        </form>
      <//>
    </div>
  </details>`;
}

/* ---------- category, picker, merge ---------- */
function CategorySheet({ id }) {
  const c = X.CAT.get(id);
  const list = X.D.products.filter(p => p.cat === id).sort((a, b) => tl(a).localeCompare(tl(b)));
  return html`<${Sheet} title=${tl(c)} onClose=${closeSheet} id=${id}><div class="list">${list.map(p => html`<${ProductRow} key=${p.id} p=${p} />`)}</div><//>`;
}
function PickerSheet() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const res = q.trim() ? searchProducts(q) : X.D.products.filter(p => !cat || p.cat === cat).sort((a, b) => chainsWith(b.id) - chainsWith(a.id));
  const foot = html`<button type="button" class="btn primary block" onClick=${() => { closeSheet(); if (S.tab !== "cistella") go("cistella"); }}>${t("done")} · ${t("n_products", { n: S.user.basket.length })}</button>`;
  return html`<${Sheet} title=${t("add_products")} onClose=${closeSheet} foot=${foot} id="picker">
    <div class="stack">
      <div class="search" role="search" style="margin-top:0"><${Icon} n="search" /><input type="search" value=${q} placeholder=${t("search_ph")} aria-label=${t("search_label")} onInput=${e => setQ(e.currentTarget.value)} /></div>
      ${q.trim() ? null : html`<div class="filters"><button type="button" class="filter" aria-pressed=${String(!cat)} onClick=${() => setCat(null)}>${t("all")}</button>
        ${X.D.categories.map(c => html`<button type="button" key=${c.id} class="filter" aria-pressed=${String(cat === c.id)} onClick=${() => setCat(c.id)}>${tl(c)}</button>`)}</div>`}
      ${res.length ? html`<div class="list">${res.slice(0, 60).map(p => html`<${ProductRow} key=${p.id} p=${p} />`)}</div>` : html`<${SearchResults} res=${[]} q=${q} />`}
    </div>
  <//>`;
}
function MergeSheet({ s }) {
  return html`<${Sheet} title=${s.name || t("basket_title")} onClose=${closeSheet} id="merge">
    <div class="stack"><p>${t("template_replace")}</p>
      <button type="button" class="btn primary" onClick=${() => { mergeItems(s.items, true); if (s.after) s.after(); closeSheet(); toast(t("template_loaded", { name: s.name })); go("cistella"); }}>${t("replace")}</button>
      <button type="button" class="btn ghost" onClick=${() => { mergeItems(s.items, false); if (s.after) s.after(); closeSheet(); toast(t("template_loaded", { name: s.name })); go("cistella"); }}>${t("merge")}</button>
    </div><//>`;
}
