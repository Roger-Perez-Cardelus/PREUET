/* ===== screens_sheets.js ===== */
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
  else if (c.t === "price") body = html`<b class="num">${eur(c.price)}</b> · ${fmtQty(c.size, X.P.get(c.p).unit)} · ${X.C.get(c.c).name}`;
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
      <div class="ph stack-s">
        <span class="eyebrow">${tl(cat)} · ${p["ref_" + LANG]}</span>
        <h1>${tl(p)}</h1>
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
      <span class="small" style="overflow-wrap:anywhere">${o.name}</span></div>
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
          if (await contribute({ t: "price", p: p.id, c: cid, price: Math.round(pv * 100) / 100, size: sv }, t("price_sent"))) setPrice("");
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

/* ---------- recipe sheet ---------- */
function RecipeSheet({ id }) {
  const r = X.R.get(id);
  const [serv, setServ] = useState(r ? r.serv : 2);
  const [cid, setCid] = useState(S.user.recipeChain || "");
  const [have, setHave] = useState(() => new Set(r ? r.ing.map(([pid]) => pid).filter(pid => PANTRY.has(pid)) : []));
  if (!r) return null;
  const opt = OPT();
  const chains = activeChains();
  const best = recipeBest(r, chains, opt, serv);
  const rc = cid ? recipeAt(r, cid, opt, serv) : best;
  const st = stockMap();
  const diet = recipeDiet(r);
  const al = recipeAllergens(r);
  const packs = sum(rc.lines.map(l => { const at = l.pc ? (rc.cid || l.pc.cid) : null; if (!at || have.has(l.pid)) return 0; const p = X.P.get(l.pid); const it = itemAt(l.pid, Math.max(1, Math.ceil(l.q / p.ref - 0.05)), at, opt); return it ? it.cost : 0; }));
  const toAdd = r.ing.filter(([pid]) => !have.has(pid));
  const addAll = () => {
    const items = toAdd.map(([pid, q0]) => { const p = X.P.get(pid); const q = q0 * serv / r.serv; return { p: pid, n: Math.max(1, Math.ceil(q / p.ref - 0.05)) }; });
    mergeItems(items, false);
    toast(t("added_n", { n: items.length }));
    emit("recipe:add", { id, n: items.length, per: rc.per });
  };
  const foot = html`<button type="button" class="btn primary block" disabled=${!toAdd.length} onClick=${addAll}><${Icon} n="basket" />${t("add_ingredients")} (${toAdd.length})</button>`;
  return html`<${Sheet} title=${tl(r)} onClose=${closeSheet} foot=${foot} id=${id}>
    <div class="stack-l">
      <div class="ph stack-s"><h1>${tl(r)}</h1>
        <div class="chips"><span class="chip"><${Icon} n="clock" s=${13} />${t("minutes", { n: r.mins })}</span>
          ${diet.vg ? html`<span class="chip good">${t("tag_vg")}</span>` : diet.vt ? html`<span class="chip good">${t("tag_vt")}</span>` : null}
          ${diet.sg ? html`<span class="chip good">${t("tag_sg")}</span>` : null}
          ${al.map(a => html`<span key=${a} class=${"chip " + (S.user.avoid.includes(a) ? "bad" : "warn")}>${t("al_" + a)}</span>`)}</div></div>
      <div class="card raised row">
        <div class="grow stack-s"><span class="eyebrow">${t("used_cost")}</span><span class="small muted">${rc.cid ? t("best_at", { chain: X.C.get(rc.cid).name }) : t("mix_chains")}${rc.miss ? " · " + t("recipe_missing", { n: rc.miss }) : ""}</span>
          <span class="xs muted">${t("packs_cost")}: ${eur(packs)}</span></div>
        <span class="stack-s" style="align-items:flex-end"><${PriceTag} v=${rc.per} lg=${true} sub=${LANG === "es" ? "/ración" : "/ració"} /><span class="xs muted">${eur(rc.cost)} · ${t("servings", { n: serv })}</span></span>
      </div>
      <div class="row"><span class="grow small" style="font-weight:700">${t("servings", { n: serv })}</span><${Stepper} value=${serv} min=${1} onChange=${v => setServ(Math.max(1, v))} label=${t("servings", { n: serv })} /></div>
      <div class="field"><span class="lab">${t("buy_at")}</span>
        <div class="filters"><button type="button" class="filter" aria-pressed=${String(!cid)} onClick=${() => { setCid(""); updUser({ recipeChain: null }); }}>${t("best_option")}</button>
          ${chains.map(c => html`<button type="button" key=${c} class="filter" aria-pressed=${String(cid === c)} onClick=${() => { setCid(c); updUser({ recipeChain: c }); }}>${X.C.get(c).name}</button>`)}</div></div>
      <section><div class="section-h"><h2 class="grow">${t("ingredients")}</h2></div>
        <div class="list">${rc.lines.map(l => {
          const p = X.P.get(l.pid);
          const at = l.pc ? (rc.cid || l.pc.cid) : null;
          const s = at ? st.get(l.pid + "|" + at) : null;
          return html`<div class="li" key=${l.pid}>
            <label class="check" style="flex:none" title=${t("have_home")}><input type="checkbox" checked=${have.has(l.pid)} onChange=${e => { const n = new Set(have); if (e.currentTarget.checked) n.add(l.pid); else n.delete(l.pid); setHave(n); }} aria-label=${t("have_home") + ": " + tl(p)} /></label>
            <button type="button" class="grow" style="text-align:left;background:none;border:0;padding:0;min-width:0" onClick=${() => openSheet({ type: "product", id: l.pid })}>
              <div class="t" style=${have.has(l.pid) ? "text-decoration:line-through;color:var(--ink-3)" : ""}>${tl(p)}</div>
              <div class="s">${fmtQty(l.q, p.unit)}${l.pc && !rc.cid ? " · " + X.C.get(l.pc.cid).name : ""}${have.has(l.pid) ? " · " + t("have_home") : ""}</div>
              ${s && s.s === "no" ? html`<div class="xs" style="color:var(--bad);font-weight:700">${t("stock_warn", { chain: X.C.get(at).name, ago: ago(s.ts) })}</div>` : null}
            </button>
            <span class="num small">${l.pc ? eur(l.pc.cost) : "—"}</span>
          </div>`;
        })}</div></section>
      <section class="stack-s"><div class="section-h"><h2 class="grow">${t("steps")}</h2></div>
        <ol class="stack-s" style="margin:0;padding-left:1.3em">${(r["steps_" + LANG] || r.steps_ca).map((x, i) => html`<li key=${i}>${x}</li>`)}</ol></section>
      <${CommentsBlock} target=${"r:" + id} />
    </div>
  <//>`;
}

/* ---------- supermarkets ---------- */
function statusChip(st) {
  const cls = st === "complet" ? "good" : st === "parcial" ? "plum" : st === "sense" ? "bad" : "warn";
  return html`<span class=${"chip " + cls}>${t("status_" + st)}</span>`;
}
function ChainsSheet() {
  const list = X.D.chains.slice().sort((a, b) => b.n_products - a.n_products);
  return html`<${Sheet} title=${t("supermarkets")} onClose=${closeSheet} id="chains">
    <div class="stack"><p class="small muted">${t("index_explain")}</p>
      <div class="list">${list.map(c => {
        const g = X.gidx.get(c.id);
        const cr = crowdOf("c:" + c.id, S.community);
        return html`<button type="button" class="li" key=${c.id} onClick=${() => openSheet({ type: "chain", id: c.id })}>
          <span class="grow stack-s" style="min-width:0"><${ChainBadge} cid=${c.id} strong=${true} />
            <span class="chips">${statusChip(c.status)}<span class="chip outline">${t("products_with_price", { n: c.n_products })}</span></span>
            <span class="xs muted">${g ? t("index_short", { x: Math.round(g.idx) }) : "—"} · ${c.ocu_note ? "OCU " + c.ocu_note : t("ocu_none")}${cr.n ? " · " + fmtNum(Math.round(cr.avg * 10) / 10) + "★ (" + cr.n + ")" : ""}</span></span>
          <span class="chev"><${Icon} n="chevR" /></span></button>`;
      })}</div></div><//>`;
}
function ChainSheet({ id }) {
  const c = X.C.get(id);
  if (!c) return null;
  const g = X.gidx.get(id);
  const today = isoToday();
  const offers = X.D.offers.filter(o => o.c === id && offerStatus(o, today) !== "ended");
  const st = S.community.filter(x => x.t === "stock" && x.c === id && Date.now() - x.ts < 72 * 3600 * 1000 && sameTown(x.town, S.user.town)).sort((a, b) => b.ts - a.ts);
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.name + " " + S.user.town);
  return html`<${Sheet} title=${c.name} onClose=${closeSheet} id=${id}>
    <div class="stack-l">
      <div class="stack-s"><${ChainBadge} cid=${id} strong=${true} /><div class="chips">${statusChip(c.status)}<span class="chip outline">${t("products_with_price", { n: c.n_products })}</span></div>
        <p class="small muted">${c["note_" + LANG] || c.note_ca}</p></div>
      <dl class="kv card">
        <dt>${t("index_global")}</dt><dd class="num">${g ? Math.round(g.idx) : "—"}</dd>
        <dt>${t("ocu_label")}</dt><dd>${c.ocu_note || t("ocu_none")}</dd>
        <dt>${t("community_rating")}</dt><dd>${(() => { const cr = crowdOf("c:" + id, S.community); return cr.n ? fmtNum(Math.round(cr.avg * 10) / 10) + " ★ (" + cr.n + ")" : t("crowd_none"); })()}</dd>
      </dl>
      <p class="xs faint">${t("index_explain")}${c.ocu != null ? html` <a href=${X.D.meta.ocu_survey} target="_blank" rel="noopener noreferrer">OCU ↗</a>` : null}</p>
      <div class="row wrap-ok">
        <a class="btn small ghost" href=${c.shop || c.site} target="_blank" rel="noopener noreferrer"><${Icon} n="store" s=${16} />${t("shop_online")} <${Icon} n="ext" s=${14} /></a>
        <a class="btn small ghost" href=${maps} target="_blank" rel="noopener noreferrer"><${Icon} n="pin" s=${16} />${t("directions")} <${Icon} n="ext" s=${14} /></a>
      </div>
      ${offers.length ? html`<section class="stack"><div class="section-h"><h2 class="grow">${t("chain_offers")}</h2><span class="small muted">${offers.length}</span></div>${offers.slice(0, 6).map((o, i) => html`<${OfferCard} key=${i} o=${o} />`)}</section>` : null}
      ${st.length ? html`<section class="card"><h3>${t("chain_stock")}</h3>${st.slice(0, 8).map(x => html`<${FeedItem} key=${x.id} c=${x} />`)}</section>` : null}
      <${CommentsBlock} target=${"c:" + id} title=${t("rate_chain")} />
    </div><//>`;
}

/* ---------- schedules ---------- */
function prepareSchedule(s) {
  const after = () => updUser(u => ({ schedules: u.schedules.map(x => x.id === s.id ? Object.assign({}, x, { lastDone: isoToday() }) : x) }));
  if (S.user.basket.length) { openSheet({ type: "merge", items: s.items, name: s.name, after }); return; }
  mergeItems(s.items, true); after();
  toast(t("sched_prepared")); go("cistella");
}
function freqText(s) {
  if (s.freq === "m") return t("f_m") + " · " + s.dom;
  return t(s.freq === "2w" ? "f_2w" : "f_w") + " · " + t("d" + s.dow).toLowerCase();
}
function SchedulesSheet() {
  const list = S.user.schedules;
  const opt = OPT();
  return html`<${Sheet} title=${t("periodic")} onClose=${closeSheet} id="schedules">
    <div class="stack"><p class="small muted">${t("periodic_sub")} ${t("reminder_note")}</p>
      ${list.length ? list.map(s => {
        const d = dueOf(s);
        const cmp = compareBasket(s.items, s.chain ? [s.chain] : activeChains(), opt);
        const b = cmp.best;
        return html`<article class="card stack-s" key=${s.id}>
          <div class="row"><b class="grow">${s.name}</b>${d.due ? html`<span class="chip good">${t("due_today")}</span>` : html`<span class="chip outline">${t("next_on", { d: fmtDay(d.next) })}</span>`}</div>
          <span class="small muted">${freqText(s)} · ${b ? t("sched_items", { n: s.items.length, p: eur(cmp.key(b)), chain: X.C.get(b.cid).name }) : t("n_products", { n: s.items.length })}</span>
          <div class="row wrap-ok">
            <button type="button" class="btn small primary" onClick=${() => { closeSheet(); prepareSchedule(s); }}>${t("prepare_basket")}</button>
            <button type="button" class="btn small ghost" onClick=${() => copyText(basketText(b, s.items))}><${Icon} n="copy" s=${16} />${t("list_copy")}</button>
            <button type="button" class="icon-btn" aria-label=${t("del")} onClick=${() => { updUser(u => ({ schedules: u.schedules.filter(x => x.id !== s.id) })); toast(t("sched_deleted")); }}><${Icon} n="trash" s=${18} /></button>
          </div></article>`;
      }) : html`<${Empty} title=${t("sched_empty")} />`}
      <button type="button" class="btn primary" onClick=${() => openSheet({ type: "schedNew" })}><${Icon} n="plus" />${t("new_schedule")}</button>
    </div><//>`;
}
function SchedNewSheet() {
  const b = S.user.basket;
  const d = new Date();
  const [name, setName] = useState(t("sched_name_ph"));
  const [freq, setFreq] = useState("w");
  const [dow, setDow] = useState((d.getDay() + 1) % 7);
  const [dom, setDom] = useState(1);
  const [chain, setChain] = useState("");
  const save = () => {
    if (!b.length) return;
    const s = { id: uid(), name: name.trim() || t("sched_name_ph"), items: b.map(x => ({ p: x.p, n: x.n })), freq, dow: Number(dow), dom: Number(dom), start: isoToday(), chain: chain || null, created: Date.now(), lastDone: isoToday() };
    updUser(u => ({ schedules: u.schedules.concat([s]) }));
    emit("schedule:create", { id: s.id });
    toast(t("sched_saved"));
    const prev = S.sheets[S.sheets.length - 2];
    if (prev && prev.type === "schedules") closeSheet(); else replaceSheet({ type: "schedules" });
  };
  return html`<${Sheet} title=${t("new_schedule")} onClose=${closeSheet} id="schedNew"
    foot=${html`<button type="button" class="btn primary block" disabled=${!b.length} onClick=${save}><${Icon} n="calendar" />${t("sched_create")}</button>`}>
    <div class="stack">
      ${b.length ? html`<p class="small muted">${t("sched_from_basket", { n: b.length })}</p>` : html`<div class="callout warn">${t("sched_need_basket")}</div>`}
      <div class="field"><label for="sc-name">${t("sched_name")}</label><input id="sc-name" type="text" maxlength="40" value=${name} onInput=${e => setName(e.currentTarget.value)} /></div>
      <div class="field"><span class="lab">${t("freq")}</span><${Seg} label=${t("freq")} value=${freq} onChange=${setFreq} options=${[{ v: "w", l: t("f_w") }, { v: "2w", l: t("f_2w") }, { v: "m", l: t("f_m") }]} /></div>
      ${freq === "m" ? html`<div class="field"><label for="sc-dom">${t("dom")}</label><select id="sc-dom" value=${dom} onChange=${e => setDom(e.currentTarget.value)}>${Array.from({ length: 28 }, (_, i) => html`<option value=${i + 1} key=${i}>${i + 1}</option>`)}</select></div>`
        : html`<div class="field"><span class="lab">${t("dow")}</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(i => html`<button type="button" key=${i} class="filter" aria-pressed=${String(Number(dow) === i)} onClick=${() => setDow(i)}>${t("d" + i)}</button>`)}</div></div>`}
      <div class="field"><label for="sc-ch">${t("sched_chain")}</label><select id="sc-ch" value=${chain} onChange=${e => setChain(e.currentTarget.value)}>
        <option value="">${t("sched_any")}</option>${activeChains().map(c => html`<option value=${c} key=${c}>${X.C.get(c).name}</option>`)}</select></div>
      <p class="xs faint">${t("reminder_note")}</p>
    </div><//>`;
}

/* ---------- community ---------- */
function CommunitySheet() {
  const [f, setF] = useState("all");
  const types = { stock: ["stock"], price: ["price"], comment: ["comment", "suggest"], rating: ["rating"], origin: ["origin"] };
  const list = S.community.filter(c => f === "all" || types[f].includes(c.t)).sort((a, b) => b.ts - a.ts);
  return html`<${Sheet} title=${t("community")} onClose=${closeSheet} id="community">
    <div class="stack"><p class="small muted">${t("community_sub")}</p>
      ${Store.me.isOwner ? html`<p class="xs faint">${t("moderate_note")}</p>` : null}
      ${Store.mode === "local" ? html`<p class="xs faint">${t("local_note")}</p>` : null}
      <div class="filters">${[["all", t("all")], ["stock", t("f_stock")], ["price", t("f_price")], ["comment", t("f_comment")], ["rating", t("f_rating")], ["origin", t("f_origin")]].map(([k, l]) => html`<button type="button" key=${k} class="filter" aria-pressed=${String(f === k)} onClick=${() => setF(k)}>${l}</button>`)}</div>
      ${list.length ? html`<div class="card">${list.slice(0, 150).map(c => html`<${FeedItem} key=${c.id} c=${c} />`)}</div>` : html`<${Empty} title=${t("community_empty")} />`}
    </div><//>`;
}
function FeedbackSheet() {
  return html`<${Sheet} title=${t("feedback")} onClose=${closeSheet} id="feedback"><div class="stack"><p class="small muted">${t("feedback_sub")}</p><${CommentsBlock} target="app" title=${t("feedback")} /></div><//>`;
}

/* ---------- profile, town ---------- */
function ProfileSheet() {
  const u = S.user;
  const [conf, setConf] = useState(false);
  const toggle = (k, v) => updUser({ [k]: u[k].includes(v) ? u[k].filter(x => x !== v) : u[k].concat([v]) });
  return html`<${Sheet} title=${t("profile")} onClose=${closeSheet} id="profile">
    <div class="stack-l">
      <div class="field"><span class="lab">${t("who")}</span><${SegmentPick} /></div>
      <div class="field"><span class="lab">${t("diets")}</span><div class="chips">${DIET_TAGS.map(d => html`<button type="button" key=${d} class="filter" aria-pressed=${String(u.diets.includes(d))} onClick=${() => toggle("diets", d)}>${t("tag_" + d)}</button>`)}</div></div>
      <div class="field"><span class="lab">${t("avoid")}</span><div class="chips">${ALLERGENS.map(a => html`<button type="button" key=${a} class="filter" aria-pressed=${String(u.avoid.includes(a))} onClick=${() => toggle("avoid", a)}>${t("al_" + a)}</button>`)}</div></div>
      <${TownField} />
      <div class="field"><span class="lab">${t("my_chains")}</span><p class="xs muted">${t("my_chains_sub")}</p><${ChainPicker} /></div>
      <div class="field"><span class="lab">${t("lang_label")}</span><${Seg} label=${t("lang_label")} value=${u.lang} onChange=${v => updUser({ lang: v })} options=${[{ v: "ca", l: "Català" }, { v: "es", l: "Castellano" }]} /></div>
      ${Store.mode !== "claude" ? html`<div class="field"><label for="pf-nick">${t("nickname")}</label><input id="pf-nick" type="text" maxlength="30" value=${u.nick} placeholder=${t("nickname_ph")} onInput=${e => updUser({ nick: e.currentTarget.value })} /><span class="xs muted">${t("nickname_note")}</span></div>` : null}
      <p class="small muted">${Store.mode === "claude" && Store.me.id ? t("data_where_claude") : Store.mode === "supabase" ? t("data_where_supa") : t("data_where_local")}</p>
      ${conf ? html`<${ConfirmInline} text=${t("reset_confirm")} yes=${t("reset_all")} onYes=${async () => { await Store.clearUser(); S.user = Object.assign(defaultUser(), { lang: u.lang, onboarded: true }); set({}); setConf(false); toast(t("reset_done")); }} onNo=${() => setConf(false)} />`
        : html`<button type="button" class="btn ghost" onClick=${() => setConf(true)}><${Icon} n="trash" />${t("reset_all")}</button>`}
    </div><//>`;
}
function SegmentPick() {
  const u = S.user;
  return html`<div class="stack-s">${["A", "B", "C"].map(sg => html`<button type="button" key=${sg} class="persona" aria-pressed=${String(u.seg === sg)} onClick=${() => updUser({ seg: sg })}>
    <span class="ico" style="color:var(--plum)"><${Icon} n=${sg === "A" ? "user" : sg === "B" ? "users" : "leaf"} s=${26} /></span>
    <span class="stack-s" style="gap:2px"><b>${t("seg_" + sg)}</b><span class="small muted">${t("seg_" + sg + "_d")}</span></span></button>`)}</div>`;
}
function TownField() {
  return html`<div class="field"><label for="town-in">${t("town")}</label>
    <input id="town-in" type="text" list="amb-towns" value=${S.user.town} maxlength="60" onChange=${e => updUser({ town: e.currentTarget.value.trim() || "Castelldefels" })} />
    <datalist id="amb-towns">${AMB_TOWNS.map(x => html`<option value=${x} key=${x}></option>`)}</datalist></div>`;
}
function TownSheet() {
  return html`<${Sheet} title=${t("town")} onClose=${closeSheet} id="town"><div class="stack-l"><${TownField} />
    <div class="chips">${["Castelldefels", "Gavà", "Viladecans", "Barcelona", "l'Hospitalet de Llobregat", "el Prat de Llobregat", "Sant Boi de Llobregat", "Badalona"].map(x => html`<button type="button" key=${x} class="filter" aria-pressed=${String(S.user.town === x)} onClick=${() => updUser({ town: x })}>${x}</button>`)}</div>
    <div class="field"><span class="lab">${t("my_chains")}</span><${ChainPicker} /></div>
    <button type="button" class="btn primary" onClick=${closeSheet}>${t("done")}</button></div><//>`;
}

/* ---------- method & about ---------- */
const METHOD = {
  ca: [
    ["D'on surten els preus", ["Els preus es recullen de les botigues en línia oficials (Bonpreu, Ametller Origen, Dia, Carrefour, Consum, bonÀrea), de comparadors públics que segueixen preus de supermercats (supersupers.com i radarsuper.com, per a Mercadona i Lidl), del fullet en PDF de Lidl i de la pàgina de promocions de Caprabo.", "Cada preu guarda la data, la font i l'enllaç. Condis, Sorli, Spar i Suma no publiquen preus en línia llegibles: s'omplen amb preus aportats per la comunitat.", "Els preus de la web poden diferir dels de la botiga física. El preu vàlid és sempre el de la botiga."]],
    ["Com comparem una cistella", ["Cada producte de Preuet és una classe de productes equivalents (per exemple, «llet semidesnatada 1 L» de qualsevol marca). Per a cada supermercat agafem l'opció més barata que compleix el filtre de marca (la més barata, marca blanca o marca de fabricant).", "El total és el que pagues a caixa: paquets sencers. Si necessites 2 L i el paquet és d'1 L, en compres 2; si només hi ha ampolles d'1,5 L, pagues l'ampolla sencera. Quan surt més a compte, combinem dos formats (per exemple, un pack de 6 i una ampolla). La fruita i la verdura a granel es paguen al pes; les safates, bosses i malles, per paquet.", "Si un supermercat no té preu d'un producte, pots estimar-lo: preu mínim d'aquell producte entre supermercats × índex de preus del supermercat. Les estimacions es marquen sempre i només es fan servir si el supermercat té preu almenys del 60 % de la cistella."]],
    ["Índex de preus i qualitat-preu", ["Índex de la cistella = 100 × (cost de la cistella al supermercat) / (cost mínim dels mateixos productes). L'índex general compara marca blanca i producte fresc: és la mitjana geomètrica de la ràtio de cada producte (limitada a 2) per a tots els productes amb preu a dues cadenes o més.", "Puntuació de preu = 100 × 100 / índex. Qualitat = satisfacció de l'enquesta OCU de 2026 (0–100), barrejada amb les valoracions de la comunitat (fins a un 30 % de pes, segons el nombre de valoracions).", "Qualitat-preu = pes × preu + (1 − pes) × qualitat. El pes el tries tu amb el control."]],
    ["Semàfor nutricional i al·lèrgens", ["Els valors nutricionals són de referència per a un producte típic de cada classe. El semàfor fa servir els llindars de l'Agència d'Estàndards Alimentaris del Regne Unit (FSA) per 100 g (begudes, per 100 ml).", "Els al·lèrgens segueixen els 14 de declaració obligatòria a la UE. Comprova sempre l'etiqueta de la marca concreta."]],
    ["Límits", ["Lidl va deixar de publicar preus en línia el juny de 2026 i d'Aldi només hi ha el fullet en imatge: tenim pocs productes seus i alguns són antics (es marquen).", "Les cadenes amb poques dades no entren al rànquing de la cistella si no arriben al 60 % dels productes.", "L'estoc depèn dels avisos dels usuaris: no és un inventari de la botiga."]],
  ],
  es: [
    ["De dónde salen los precios", ["Los precios se recogen de las tiendas online oficiales (Bonpreu, Ametller Origen, Dia, Carrefour, Consum, bonÀrea), de comparadores públicos que siguen precios de supermercados (supersupers.com y radarsuper.com, para Mercadona y Lidl), del folleto en PDF de Lidl y de la página de promociones de Caprabo.", "Cada precio guarda la fecha, la fuente y el enlace. Condis, Sorli, Spar y Suma no publican precios online legibles: se rellenan con precios aportados por la comunidad.", "Los precios de la web pueden diferir de los de la tienda física. El precio válido es siempre el de la tienda."]],
    ["Cómo comparamos una cesta", ["Cada producto de Preuet es una clase de productos equivalentes (por ejemplo, «leche semidesnatada 1 L» de cualquier marca). Para cada supermercado tomamos la opción más barata que cumple el filtro de marca (la más barata, marca blanca o marca de fabricante).", "El total es lo que pagas en caja: paquetes enteros. Si necesitas 2 L y el paquete es de 1 L, compras 2; si solo hay botellas de 1,5 L, pagas la botella entera. Cuando sale más a cuenta, combinamos dos formatos (por ejemplo, un pack de 6 y una botella). La fruta y la verdura a granel se pagan al peso; las bandejas, bolsas y mallas, por paquete.", "Si un supermercado no tiene precio de un producto, puedes estimarlo: precio mínimo de ese producto entre supermercados × índice de precios del supermercado. Las estimaciones se marcan siempre y solo se usan si el supermercado tiene precio de al menos el 60 % de la cesta."]],
    ["Índice de precios y calidad-precio", ["Índice de la cesta = 100 × (coste de la cesta en el supermercado) / (coste mínimo de los mismos productos). El índice general compara marca blanca y producto fresco: es la media geométrica de la ratio de cada producto (limitada a 2) para todos los productos con precio en dos cadenas o más.", "Puntuación de precio = 100 × 100 / índice. Calidad = satisfacción de la encuesta OCU de 2026 (0–100), mezclada con las valoraciones de la comunidad (hasta un 30 % de peso, según el número de valoraciones).", "Calidad-precio = peso × precio + (1 − peso) × calidad. El peso lo eliges tú con el control."]],
    ["Semáforo nutricional y alérgenos", ["Los valores nutricionales son de referencia para un producto típico de cada clase. El semáforo usa los umbrales de la Agencia de Normas Alimentarias del Reino Unido (FSA) por 100 g (bebidas, por 100 ml).", "Los alérgenos siguen los 14 de declaración obligatoria en la UE. Comprueba siempre la etiqueta de la marca concreta."]],
    ["Límites", ["Lidl dejó de publicar precios online en junio de 2026 y de Aldi solo hay el folleto en imagen: tenemos pocos productos suyos y algunos son antiguos (se marcan).", "Las cadenas con pocos datos no entran en el ranking de la cesta si no llegan al 60 % de los productos.", "El stock depende de los avisos de los usuarios: no es un inventario de la tienda."]],
  ],
};
function MethodSheet() {
  const by = new Map();
  for (const s of X.D.sources) { if (!by.has(s.c)) by.set(s.c, []); by.get(s.c).push(s); }
  return html`<${Sheet} title=${t("method")} onClose=${closeSheet} id="method">
    <div class="prose">
      ${METHOD[LANG].map(([h, ps]) => html`<section class="stack-s" key=${h}><h3>${h}</h3>${ps.map((p, i) => html`<p class="small" key=${i}>${p}</p>`)}</section>`)}
      <section class="stack-s"><h3>${t("sources")}</h3>
        <p class="small"><a href=${X.D.meta.ocu_survey} target="_blank" rel="noopener noreferrer">OCU · Enquesta de satisfacció amb els supermercats 2026 ↗</a></p>
        ${[...by.entries()].map(([c, list]) => html`<details key=${c}><summary class="small" style="cursor:pointer"><b>${X.C.get(c).name}</b> · ${list.length}</summary>
          <ul class="xs" style="overflow-wrap:anywhere">${list.map((s, i) => html`<li key=${i}><a href=${s.url} target="_blank" rel="noopener noreferrer">${s.url.replace(/^https?:\/\//, "").slice(0, 90)}</a></li>`)}</ul></details>`)}
      </section>
    </div><//>`;
}
function AboutSheet() {
  return html`<${Sheet} title=${t("about")} onClose=${closeSheet} id="about">
    <div class="prose">
      <div class="row"><span style="width:44px;height:44px;color:var(--ink)"><${Logo} /></span><div><b style="font-family:var(--f-display);font-size:var(--t-lg)">Preuet</b><p class="small muted">${t("app_tagline")}</p></div></div>
      <p>${t("about_body")}</p>
      <p class="small muted">${t("about_version", { v: "V1", d: fmtDL(X.D.meta.updated) })} · ${X.D.meta.n_prices} preus · ${X.D.meta.n_products} productes</p>
      <p class="small">${t("ai_note")}</p>
      <p class="small">${t("disclaimer")}</p>
      <dl class="kv"><dt>${t("storage_mode")}</dt><dd>${t("mode_" + Store.mode)}</dd></dl>
    </div><//>`;
}

/* ---------- onboarding ---------- */
function Onboarding() {
  const [step, setStep] = useState(0);
  const u = S.user;
  const finish = tid => {
    updUser({ onboarded: true });
    if (S.test && S.test.phase === "onb") testOnboardingDone();
    if (tid) { const tp = X.T.find(x => x.id === tid); mergeItems(tp.items.map(([p, n]) => ({ p, n })), true); go("cistella"); }
  };
  const suggested = u.seg === "B" ? "familia" : u.seg === "C" ? (u.diets.includes("sg") ? "sensegluten" : "saludable") : "estudiant";
  const tp = X.T.find(x => x.id === suggested);
  return html`<div class="onb" role="dialog" aria-modal="true" aria-label=${t("onb1_t")}><div class="wrap stack-l" style="max-width:520px">
    <div class="row"><span class="dots" aria-label=${t("onb_step", { a: step + 1, b: 3 })}>${[0, 1, 2].map(i => html`<i key=${i} class=${i === step ? "on" : ""}></i>`)}</span><span class="grow"></span>
      <button type="button" class="link-btn" onClick=${() => finish(null)}>${t("onb_skip")}</button></div>
    ${step === 0 ? html`<div class="stack-l">
      <span style="width:64px;height:64px;color:var(--ink)"><${Logo} /></span>
      <h1 style="font-size:var(--t-2xl);font-weight:800;line-height:1.05">${t("onb1_t")}</h1>
      <p class="muted">${t("onb1_s")}</p>
      <div class="stack">${[["receipt", "onb_p1"], ["shield", "onb_p2"], ["users", "onb_p3"]].map(([ic, k]) => html`<div class="row" key=${k}><span class="chip plum" style="width:36px;height:36px;justify-content:center;padding:0"><${Icon} n=${ic} s=${18} /></span><span>${t(k)}</span></div>`)}</div>
      <${Seg} label=${t("lang_label")} value=${u.lang} onChange=${v => updUser({ lang: v })} options=${[{ v: "ca", l: "Català" }, { v: "es", l: "Castellano" }]} />
      <button type="button" class="btn primary" onClick=${() => setStep(1)}>${t("next")}</button></div>` : null}
    ${step === 1 ? html`<div class="stack-l"><h1 style="font-size:var(--t-xl);font-weight:800">${t("who")}</h1><${SegmentPick} />
      <div class="field"><span class="lab">${t("diets")}</span><div class="chips">${DIET_TAGS.map(d => html`<button type="button" key=${d} class="filter" aria-pressed=${String(u.diets.includes(d))} onClick=${() => updUser({ diets: u.diets.includes(d) ? u.diets.filter(x => x !== d) : u.diets.concat([d]) })}>${t("tag_" + d)}</button>`)}</div></div>
      <div class="row"><button type="button" class="btn ghost" onClick=${() => setStep(0)}>${t("back")}</button><button type="button" class="btn primary grow" onClick=${() => setStep(2)}>${t("next")}</button></div></div>` : null}
    ${step === 2 ? html`<div class="stack-l"><h1 style="font-size:var(--t-xl);font-weight:800">${t("onb3_t")}</h1><${TownField} />
      <div class="field"><span class="lab">${t("my_chains")}</span><${ChainPicker} /></div>
      <button type="button" class="btn primary" onClick=${() => finish(suggested)}>${t("onb_start", { name: tl(tp) })}</button>
      <button type="button" class="btn ghost" onClick=${() => finish(null)}>${t("onb_empty")}</button>
      <button type="button" class="link-btn" onClick=${() => setStep(1)}>${t("back")}</button></div>` : null}
  </div></div>`;
}

/* ---------- router ---------- */
function SheetRouter({ s }) {
  switch (s.type) {
    case "product": return html`<${ProductSheet} id=${s.id} />`;
    case "category": return html`<${CategorySheet} id=${s.id} />`;
    case "picker": return html`<${PickerSheet} />`;
    case "merge": return html`<${MergeSheet} s=${s} />`;
    case "recipe": return html`<${RecipeSheet} id=${s.id} />`;
    case "chains": return html`<${ChainsSheet} />`;
    case "chain": return html`<${ChainSheet} id=${s.id} />`;
    case "schedules": return html`<${SchedulesSheet} />`;
    case "schedNew": return html`<${SchedNewSheet} />`;
    case "community": return html`<${CommunitySheet} />`;
    case "feedback": return html`<${FeedbackSheet} />`;
    case "profile": return html`<${ProfileSheet} />`;
    case "town": return html`<${TownSheet} />`;
    case "method": return html`<${MethodSheet} />`;
    case "about": return html`<${AboutSheet} />`;
    case "test": return html`<${TestSetupSheet} />`;
    case "testAfter": return html`<${TestAfterSheet} />`;
    case "testSummary": return html`<${TestSummarySheet} code=${s.code} />`;
    default: return null;
  }
}
