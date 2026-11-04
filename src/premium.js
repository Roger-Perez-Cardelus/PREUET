/* ===== premium.js ===== */
/* ---------- Preuet Plus: a fake door to measure whether people would pay. Nothing is charged. ----------
   Free for everyone: where the basket is cheapest, the quality-price ranking, product facts (allergens, nutrition, origin),
   community reports and accessibility. Everything else is marked Plus. Opening a Plus feature shows the offer; the app
   counts those views per feature, and "I want Plus" records the plan chosen and the price the person says they would
   really pay (S.user.plus, saved with the profile). Only then does it say that Preuet does not charge yet, and it unlocks Plus.
   The solution tests (S01–S10) always have everything. */
const PLUS_FEATURES = [["offers", "tag"], ["recipes", "pot"], ["shoplist", "check"], ["periodic", "calendar"], ["savings", "receipt"],
  ["history", "chart"], ["alerts", "star"], ["nearby", "pin"], ["scan", "barcode"], ["voice", "mic"], ["share", "share"], ["healthy", "leaf"]];
const PLUS_FREE = ["plus_free_cheapest", "plus_free_qp", "plus_free_facts", "plus_free_community", "plus_free_a11y"];
const PLUS_SHEETS = { recipe: "recipes", schedules: "periodic", schedNew: "periodic", shoplist: "shoplist", purchase: "savings", savings: "savings", scan: "scan", healthy: "healthy" };
const PLUS_TABS = { ofertes: "offers", receptes: "recipes" };
const PLUS_PLANS = { month: 2.49, year: 19.99 };
const PLUS_WTP = [0, 1, 2, 3, 5];

function hasPlus() { return !!S.test || !!(S.user && S.user.plus && S.user.plus.on); }
function cleanPlus(pl) {
  const p = pl && typeof pl === "object" ? pl : {};
  const views = {};
  if (p.views && typeof p.views === "object") for (const [f] of PLUS_FEATURES.concat([["more"]])) {
    const n = Math.round(Number(p.views[f]) || 0); if (n > 0) views[f] = Math.min(n, 9999);
  }
  return { on: p.on === true, plan: p.plan in PLUS_PLANS ? p.plan : null, wtp: PLUS_WTP.includes(p.wtp) ? p.wtp : null,
    at: typeof p.at === "string" && /^\d{4}-\d\d-\d\d$/.test(p.at) ? p.at : null,
    from: typeof p.from === "string" ? p.from.slice(0, 20) : null, views, no: clamp(Math.round(Number(p.no) || 0), 0, 9999) };
}
function plusOf() { return cleanPlus(S.user && S.user.plus); }
function plusSeen(f) {
  const pl = plusOf();
  updUser({ plus: Object.assign({}, pl, { views: Object.assign({}, pl.views, { [f]: (pl.views[f] || 0) + 1 }) }) });
  emit("plus:view", { f });
}
/* true when the feature is locked (and the offer is now open) */
function needPlus(f) {
  if (hasPlus()) return false;
  openSheet({ type: "plus", f });
  return true;
}
function plusName(f) { return t("plus_f_" + f); }

function PlusTag() {
  return hasPlus() ? null : html`<span class="plus-badge"><${Icon} n="lock" s=${11} />Plus</span>`;
}
/* a lock after a small button's label */
function PlusMini() {
  return hasPlus() ? null : html`<span class="plus-mini"><${Icon} n="lock" s=${12} /><span class="sr">(Plus)</span></span>`;
}
/* in place of a Plus block inside a free screen */
function PlusLock({ f }) {
  if (hasPlus()) return null;
  return html`<button type="button" class="card plus-lock row" onClick=${() => needPlus(f)}>
    <span class="plus-ic" aria-hidden="true"><${Icon} n=${(PLUS_FEATURES.find(x => x[0] === f) || [f, "lock"])[1]} s=${20} /></span>
    <span class="grow stack-s" style="gap:2px"><b>${plusName(f)}</b><span class="small muted">${t("plus_d_" + f)}</span></span>
    <${PlusTag} /></button>`;
}
/* in place of a whole tab */
function PlusGate({ f }) {
  useEffect(() => { plusSeen(f); }, [f]);
  return html`<div class="stack-l">
    <section class="card raised stack plus-gate">
      <span class="plus-ic lg" aria-hidden="true"><${Icon} n=${PLUS_FEATURES.find(x => x[0] === f)[1]} s=${30} /></span>
      <div class="stack-s"><${PlusTag} /><h2>${plusName(f)}</h2><p class="muted">${t("plus_d_" + f)}</p></div>
      <button type="button" class="btn primary" onClick=${() => openSheet({ type: "plus", f, seen: true })}><${Icon} n="lock" s=${18} />${t("plus_discover")}</button>
    </section>
    <p class="small muted">${t("plus_free_note")}</p>
  </div>`;
}

function PlusSheet({ s }) {
  const pl = plusOf();
  const f = s.f || "more";
  const [plan, setPlan] = useState(pl.plan || "year");
  const [wtp, setWtp] = useState(pl.wtp);
  const [done, setDone] = useState(false);
  useEffect(() => { if (!pl.on && !s.seen) plusSeen(f); }, []);
  const go_on = () => { if (s.next) replaceSheet(s.next); else closeSheet(); };
  if (done || pl.on) {
    const foot = done ? html`<button type="button" class="btn primary block" onClick=${go_on}>${s.next || PLUS_TABS[S.tab] ? t("plus_continue_to", { f: plusName(f) }) : t("plus_continue")}</button>`
      : html`<button type="button" class="btn ghost block" onClick=${() => { updUser({ plus: Object.assign(plusOf(), { on: false }) }); closeSheet(); toast(t("plus_off_done")); }}>${t("plus_off")}</button>`;
    return html`<${Sheet} title="Preuet Plus" onClose=${closeSheet} foot=${foot} id="plus"><div class="stack">
      <div class="callout good" role="status"><b>${done ? t("plus_thanks_t") : t("plus_active_t")}</b></div>
      <p>${t("plus_thanks")}</p>
      ${pl.at ? html`<p class="small muted">${pl.wtp == null ? t("plus_your_plan", { plan: t("plus_plan_" + (pl.plan || plan)) }) : t("plus_your_answer", { plan: t("plus_plan_" + (pl.plan || plan)), wtp: pl.wtp === 5 ? "5 € +" : pl.wtp === 0 ? "0 €" : eur(pl.wtp) })}</p>` : null}
    </div><//>`;
  }
  const join = () => {
    updUser({ plus: Object.assign(plusOf(), { on: true, plan, wtp, at: isoToday(), from: f }) });
    emit("plus:join", { f, plan, wtp });
    setDone(true);
  };
  const no = () => { updUser({ plus: Object.assign(plusOf(), { no: plusOf().no + 1 }) }); closeSheet(); };
  const per = PLUS_PLANS.year / 12;
  const foot = html`<div class="stack-s">
    <button type="button" class="btn primary block" onClick=${join}><${Icon} n="star" s=${18} fill=${true} />${t("plus_join")}</button>
    <button type="button" class="link-btn" style="align-self:center" onClick=${no}>${t("plus_not_now")}</button>
  </div>`;
  return html`<${Sheet} title="Preuet Plus" onClose=${closeSheet} foot=${foot} id="plus"><div class="stack-l">
    ${f !== "more" ? html`<div class="callout row"><${Icon} n="lock" /><span class="grow">${t("plus_locked", { f: plusName(f) })}</span></div>` : null}
    <section class="stack-s">
      <h3>${t("plus_inc_t")}</h3>
      <ul class="plus-list">${PLUS_FEATURES.map(([k, ic]) => html`<li key=${k} class=${k === f ? "on" : ""}><span class="plus-ic" aria-hidden="true"><${Icon} n=${ic} s=${18} /></span>
        <span class="grow stack-s" style="gap:0"><b>${plusName(k)}</b><span class="xs muted">${t("plus_d_" + k)}</span></span></li>`)}</ul>
    </section>
    <section class="card stack-s">
      <h3>${t("plus_free_t")}</h3>
      <ul class="plus-list free">${PLUS_FREE.map(k => html`<li key=${k}><span class="ok" aria-hidden="true"><${Icon} n="check" s=${16} /></span><span class="grow">${t(k)}</span></li>`)}</ul>
    </section>
    <div class="field"><span class="lab">${t("plus_plan")}</span>
      <div class="plus-plans" role="radiogroup" aria-label=${t("plus_plan")}>${Object.keys(PLUS_PLANS).map(k => html`<button type="button" role="radio" key=${k} class="plus-plan"
          aria-checked=${String(plan === k)} onClick=${() => setPlan(k)}>
        <b>${t("plus_plan_" + k)}</b><span class="num">${eur(PLUS_PLANS[k])}<small>${k === "year" ? t("plus_per_year") : t("plus_per_month")}</small></span>
        ${k === "year" ? html`<span class="chip good">${t("plus_year_save", { x: eur(per), p: Math.round((1 - per / PLUS_PLANS.month) * 100) })}</span>` : null}
      </button>`)}</div></div>
    <div class="field"><span class="lab" id="plus-wtp">${t("plus_wtp")}</span>
      <div class="chips" role="group" aria-labelledby="plus-wtp">${PLUS_WTP.map(v => html`<button type="button" key=${v} class="filter" aria-pressed=${String(wtp === v)} onClick=${() => setWtp(wtp === v ? null : v)}>${v === 5 ? "5 € +" : v === 0 ? t("plus_wtp_0") : eur(v)}</button>`)}</div>
      <span class="xs muted">${t("plus_wtp_note")}</span></div>
    <p class="xs faint">${t("plus_no_card")}</p>
  </div><//>`;
}
function PlusCard() {
  const on = hasPlus();
  return html`<button type="button" class="card raised row plus-card" style="width:100%;text-align:left" onClick=${() => openSheet({ type: "plus" })}>
    <span class="plus-ic" aria-hidden="true"><${Icon} n="star" s=${22} fill=${true} /></span>
    <span class="grow stack-s" style="gap:2px"><b>Preuet Plus</b><span class="small muted">${S.test ? t("plus_in_test") : on ? t("plus_active_sub") : t("plus_card_sub")}</span></span>
    <${Icon} n="chevR" /></button>`;
}
