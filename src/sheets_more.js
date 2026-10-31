/* ===== sheets_more.js ===== */
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
      <${NearbyStores} cid=${id} />
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
      <div class="field"><span class="lab">${t("theme_label")}</span><${Seg} label=${t("theme_label")} value=${u.theme || "auto"} onChange=${v => updUser({ theme: v })} options=${[{ v: "auto", l: t("theme_auto") }, { v: "light", l: t("theme_light") }, { v: "dark", l: t("theme_dark") }]} /></div>
      ${Store.mode !== "claude" ? html`<div class="field"><label for="pf-nick">${t("nickname")}</label><input id="pf-nick" type="text" maxlength="30" value=${u.nick} placeholder=${t("nickname_ph")} onInput=${e => updUser({ nick: e.currentTarget.value })} /><span class="xs muted">${t("nickname_note")}</span></div>` : null}
      <${BackupBlock} />
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
    <datalist id="amb-towns">${AMB_TOWNS.map(x => html`<option value=${x} key=${x}></option>`)}</datalist>
    <div style="margin-top:8px"><${LocateButton} small=${true} /></div></div>`;
}
function TownSheet() {
  return html`<${Sheet} title=${t("town")} onClose=${closeSheet} id="town"><div class="stack-l"><${TownField} />
    <div class="chips">${["Castelldefels", "Gavà", "Viladecans", "Barcelona", "l'Hospitalet de Llobregat", "el Prat de Llobregat", "Sant Boi de Llobregat", "Badalona"].map(x => html`<button type="button" key=${x} class="filter" aria-pressed=${String(S.user.town === x)} onClick=${() => updUser({ town: x })}>${x}</button>`)}</div>
    <div class="field"><span class="lab">${t("my_chains")}</span><${ChainPicker} /></div>
    <button type="button" class="btn primary" onClick=${closeSheet}>${t("done")}</button></div><//>`;
}

/* ---------- backup code: move your basket, periodic purchases and preferences to another phone or browser ---------- */
const BACKUP_KEYS = ["lang", "seg", "diets", "avoid", "town", "chains", "brand", "fresh", "estimate", "w", "basket", "schedules", "nick", "watch", "purchases", "loc", "maxKm", "theme"];
function backupCode(u) {
  const o = {};
  for (const k of BACKUP_KEYS) if (u[k] !== undefined) o[k] = u[k];
  const bytes = new TextEncoder().encode(JSON.stringify(o));
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return "PREUET1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function readBackup(code) {
  const m = /PREUET1\.([A-Za-z0-9_-]+)/.exec(String(code || "").replace(/\s+/g, ""));
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    if (!o || typeof o !== "object") return null;
    const out = {};
    for (const k of BACKUP_KEYS) if (o[k] !== undefined) out[k] = o[k];
    return out;
  } catch (e) { return null; }
}
function BackupBlock() {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState(false);
  const code = open ? backupCode(S.user) : "";
  const restore = () => {
    const o = readBackup(txt);
    if (!o) { setErr(true); return; }
    S.user = cleanUser(Object.assign({}, S.user, o, { onboarded: true }));
    updUser({});
    setTxt(""); setErr(false);
    toast(t("backup_restored", { n: S.user.basket.length }));
  };
  return html`<details class="card" onToggle=${e => setOpen(e.currentTarget.open)}>
    <summary class="row" style="cursor:pointer;list-style:none"><${Icon} n="shield" /><b class="grow">${t("backup_title")}</b><${Icon} n="chevD" /></summary>
    <div class="stack" style="margin-top:12px">
      <p class="small muted">${t("backup_sub")}</p>
      ${open ? html`<textarea class="pre" readonly rows="3" aria-label=${t("backup_title")} style="width:100%;font-size:var(--t-xs)" value=${code}></textarea>
        <div class="row wrap-ok"><button type="button" class="btn small primary" onClick=${() => copyText(code)}><${Icon} n="copy" s=${16} />${t("backup_copy")}</button>
          ${canDownload() ? html`<button type="button" class="btn small ghost" onClick=${() => download("preuet-copia-" + isoToday() + ".txt", code)}><${Icon} n="download" s=${16} />${t("download")}</button>` : null}</div>` : null}
      <div class="field"><label for="bk-in">${t("backup_paste")}</label>
        <textarea id="bk-in" rows="3" value=${txt} placeholder="PREUET1.…" onInput=${e => { setTxt(e.currentTarget.value); setErr(false); }}></textarea></div>
      ${err ? html`<p class="small" style="color:var(--bad)" role="alert">${t("backup_bad")}</p>` : null}
      <button type="button" class="btn small ghost" style="align-self:flex-start" disabled=${!txt.trim()} onClick=${restore}>${t("backup_restore")}</button>
    </div>
  </details>`;
}
