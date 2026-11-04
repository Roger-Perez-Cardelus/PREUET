/* ===== team.js ===== */
/* ---------- team mode: the team code unlocks the test mode (S01–S10) and a team panel ----------
   The code is checked by the server (Supabase: list_tests / team_stats answer only to the right code), so it is not a
   browser-only lock. Ways in: Més → Sobre Preuet (tap the version line 5 times) or the link #equip.
   On a team phone Preuet Plus is open and its offer is not counted, so the team does not skew the results. */
const LS_TEAM = "preuet:team:v1";
function isTeam() { return !!S.team; }
function teamOn(key) {
  lsSet(LS_TEAMKEY, key); lsSet(LS_TEAM, { at: isoToday() });
  S.team = true;
  updUser({ team: true });
  if (Store._reloadTests) Store._reloadTests();
}
function teamOff() {
  lsDel(LS_TEAM); lsDel(LS_TEAMKEY);
  S.team = false;
  updUser({ team: false });
  if (Store._reloadTests) Store._reloadTests();
}
function openTeam() { openSheet({ type: S.team ? "team" : "teamLogin" }); }
let TEAM_TAPS = { n: 0, t: 0 };
function teamTap() { // five quick taps on the version line
  const now = Date.now();
  TEAM_TAPS = now - TEAM_TAPS.t < 1500 ? { n: TEAM_TAPS.n + 1, t: now } : { n: 1, t: now };
  if (TEAM_TAPS.n >= 5) { TEAM_TAPS = { n: 0, t: 0 }; openTeam(); }
}

function TeamBadge() { return S.team ? html`<span class="team-badge" title=${t("tm_title")}>${t("tm_badge")}</span>` : null; }

function TeamLoginSheet({ s }) {
  const [code, setCode] = useState("");
  const [st, setSt] = useState("idle");
  const go = async () => {
    const k = code.trim();
    if (!k) return;
    setSt("busy");
    let ok = null;
    try { ok = await Store.teamCheck(k); } catch (e) { ok = null; }
    if (ok) { teamOn(k); toast(t("tm_welcome")); replaceSheet(s.next || { type: "team" }); }
    else setSt(ok === false ? "bad" : "offline");
  };
  const foot = html`<button type="button" class="btn primary block" disabled=${!code.trim() || st === "busy"} onClick=${go}><${Icon} n="lock" s=${18} />${st === "busy" ? t("tm_checking") : t("tm_enter")}</button>`;
  return html`<${Sheet} title=${t("tm_login_t")} onClose=${closeSheet} foot=${foot} id="teamLogin"><div class="stack">
    <p class="small muted">${t("tm_login_sub")}</p>
    <div class="field"><label for="tm-code">${t("tm_code")}</label>
      <input id="tm-code" type="password" autocomplete="current-password" value=${code} onInput=${e => { setCode(e.currentTarget.value); setSt("idle"); }}
        onKeyDown=${e => { if (e.key === "Enter") go(); }} /></div>
    ${st === "bad" ? html`<p class="callout warn small" role="alert">${t("tm_bad")}</p>` : null}
    ${st === "offline" ? html`<p class="callout warn small" role="alert">${t("tm_offline")}</p>` : null}
  </div><//>`;
}

function Kpi({ v, l, sub }) {
  return html`<div class="kpi"><span class="kpi-v num">${v}</span><span class="kpi-l">${l}</span>${sub ? html`<span class="kpi-s">${sub}</span>` : null}</div>`;
}
const pctOf = (a, b) => (b ? Math.round(a / b * 100) + " %" : "—");
function TeamPlus({ d }) {
  const feats = PLUS_FEATURES.map(([k]) => ({ k, v: (d.views || {})[k] || 0, j: (d.from || {})[k] || 0 })).filter(x => x.v || x.j).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...feats.map(x => x.v));
  const wtp = PLUS_WTP.map(v => ({ v, n: (d.wtp || {})[String(v)] || 0 }));
  return html`<section class="stack">
    <h3>${t("tm_plus")}</h3>
    <div class="kpis">
      <${Kpi} v=${d.users} l=${t("tm_users")} sub=${t("tm_active7", { n: d.active7 })} />
      <${Kpi} v=${d.seen} l=${t("tm_seen")} sub=${pctOf(d.seen, d.users) + " " + t("tm_of_users")} />
      <${Kpi} v=${d.joined} l=${t("tm_joined")} sub=${pctOf(d.joined, d.seen) + " " + t("tm_of_seen")} />
      <${Kpi} v=${d.wtp_avg == null ? "—" : eur(Number(d.wtp_avg))} l=${t("tm_wtp_avg")} sub=${t("tm_no", { n: d.no || 0 })} />
    </div>
    ${feats.length ? html`<div class="card stack-s"><span class="eyebrow">${t("tm_by_feature")}</span>
      ${feats.map(x => html`<div class="tm-row" key=${x.k}><span class="tm-name">${plusName(x.k)}</span>
        <span class="tm-track"><span style=${{ width: (x.v / max * 100) + "%" }}></span></span>
        <span class="xs muted num">${t("tm_views_joins", { v: x.v, j: x.j })}</span></div>`)}</div>`
      : html`<p class="small muted">${t("tm_nodata")}</p>`}
    <div class="card stack-s"><span class="eyebrow">${t("tm_wtp")}</span>
      <div class="chips">${wtp.map(x => html`<span class="chip outline" key=${x.v}>${x.v === 0 ? t("plus_wtp_0") : x.v === 5 ? "5 € +" : eur(x.v)} · <b>${x.n}</b></span>`)}</div>
      <span class="xs muted">${t("tm_plans", { m: (d.plans || {}).month || 0, y: (d.plans || {}).year || 0 })}</span></div>
  </section>`;
}
function TeamSheet() {
  const [st, setSt] = useState({ busy: true });
  const load = () => {
    setSt({ busy: true });
    Store.teamStats(lsGet(LS_TEAMKEY)).then(setSt, () => setSt({ error: "other" }));
  };
  useEffect(load, []);
  const tests = CODES.filter(c => (S.tests || {})[c]).length;
  const d = st.data;
  const err = st.error;
  const C7 = ["stock", "price", "comment", "rating", "origin", "suggest"];
  const foot = html`<div class="row">
    <button type="button" class="btn small ghost" onClick=${() => { teamOff(); closeSheet(); toast(t("tm_bye")); }}>${t("tm_logout")}</button>
    <span class="grow"></span>
    <button type="button" class="btn small primary" onClick=${load} disabled=${!!st.busy}><${Icon} n="refresh" s=${16} />${t("tm_refresh")}</button></div>`;
  return html`<${Sheet} title=${t("tm_title")} onClose=${closeSheet} foot=${foot} id="team"><div class="stack-l">
    <div class="row" style="gap:10px"><${TeamBadge} /><span class="small muted grow">${t("tm_sub")}</span></div>
    <section class="card raised stack-s">
      <div class="row"><span class="plus-ic" aria-hidden="true"><${Icon} n="flask" s=${20} /></span>
        <span class="grow stack-s" style="gap:2px"><b>${t("test_mode")}</b><span class="small muted">${t("t_results_sub", { n: tests })}</span></span></div>
      <button type="button" class="btn primary" onClick=${() => openSheet({ type: "test" })}><${Icon} n="play" s=${18} />${t("tm_open_tests")}</button>
    </section>
    ${st.busy ? html`<p class="small muted" role="status">${t("tm_loading")}</p>`
      : err ? html`<div class="callout warn small" role="status">${t("tm_err_" + err)}</div>`
      : html`<${TeamPlus} d=${d} />
        <section class="stack-s"><h3>${t("community")}</h3>
          <div class="kpis"><${Kpi} v=${d.contrib} l=${t("tm_contrib")} sub=${t("tm_contrib7", { n: C7.reduce((a, k) => a + ((d.contrib7 || {})[k] || 0), 0) })} />
            <${Kpi} v=${d.tests} l=${t("tm_tests_server")} sub="S01–S10" /></div>
          <div class="chips">${C7.map(k => html`<span class="chip outline" key=${k}>${t("tm_c_" + k)} · <b>${(d.contrib7 || {})[k] || 0}</b></span>`)}</div></section>`}
    <section class="stack-s"><h3>${t("tm_data")}</h3>
      <p class="small muted">${t("tm_data_sub", { d: fmtDL(X.D.meta.updated), n: X.D.meta.n_prices, p: X.D.meta.n_products })}</p>
      <div class="card">${X.D.chains.map(c => { const nd = chainNewest(c.id), old = (chainStaleDays(c.id) || 0) > STALE_DAYS;
        return html`<div class="li" key=${c.id}><${ChainBadge} cid=${c.id} /><span class="grow"></span><span class="xs muted">${t("n_products", { n: c.n_products })}</span>
          <span class=${"chip " + (old ? "warn" : "good")}>${nd ? fmtD(nd) : "—"}</span></div>`; })}</div>
    </section>
  </div><//>`;
}
function TeamCard() {
  if (!S.team) return null;
  return html`<button type="button" class="card raised row team-card" style="width:100%;text-align:left" onClick=${() => openSheet({ type: "team" })}>
    <span class="plus-ic" aria-hidden="true"><${Icon} n="chart" s=${22} /></span>
    <span class="grow stack-s" style="gap:2px"><span class="row" style="gap:8px"><b>${t("tm_title")}</b><${TeamBadge} /></span><span class="small muted">${t("tm_card_sub")}</span></span>
    <${Icon} n="chevR" /></button>`;
}
