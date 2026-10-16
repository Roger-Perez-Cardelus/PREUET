/* ===== testmode.js ===== */
/* ---------- solution tests S01–S10 (guide, Apartat 6, Taula C) ---------- */
const TASKS = [
  { id: "t1", h: "h1", hit: n => n === "basket:results" && S.user.basket.length >= 5 },
  { id: "t2", h: "h2", hit: n => n === "qp:pick" },
  { id: "t3", h: "h3", hit: n => n === "product:nutrition" || n === "product:allergens" },
  { id: "t4", h: "h4", hit: n => n === "stock:report" },
  { id: "t5", h: "h5", hit: n => n === "recipe:add" },
  { id: "t6", h: "h6", hit: n => n === "schedule:create" },
];
const CODES = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"];
const TEAM_HINT = ["Roger", "Juan", "Kiril", "David"];
function ca(key, vars) { const prev = LANG; LANG = "ca"; const s = t(key, vars); LANG = prev; return s; }
function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + pad2(s % 60); }

function noteFor(id, name, d) {
  if (id === "t1") { const c = basketCompare(); return c && c.best ? ca("n_products", { n: S.user.basket.length }) + "; millor: " + X.C.get(c.best.cid).name + " " + eur(c.key(c.best)) : ""; }
  if (id === "t2") return d.cid ? "ha triat " + X.C.get(d.cid).name : "";
  if (id === "t3") return d.id ? "ha consultat " + ca_name(d.id) : "";
  if (id === "t4") return d.pid ? ca_name(d.pid) + " a " + X.C.get(d.cid).name + ": " + ca("stock_" + d.s).toLowerCase() : "";
  if (id === "t5") return d.id ? X.R.get(d.id).ca + " (" + eur(d.per) + "/ració)" : "";
  if (id === "t6") { const s = S.user.schedules[S.user.schedules.length - 1]; return s ? ca(s.freq === "m" ? "f_m" : s.freq === "2w" ? "f_2w" : "f_w").toLowerCase() : ""; }
  return "";
}
function ca_name(pid) { const p = X.P.get(pid); return p ? p.ca : pid; }
BUS.add((name, data) => {
  const T = S.test;
  if (!T || T.phase !== "tasks") return;
  const task = TASKS[T.cur];
  if (task && task.hit(name, data)) completeTask("ok", true, noteFor(task.id, name, data));
});
function completeTask(status, auto, note) {
  const T = S.test;
  if (!T || T.phase !== "tasks") return;
  const i = T.cur;
  const rec = T.tasks[i];
  rec.status = status === "ok" && rec.help > 0 ? "help" : status;
  rec.secs = Math.round((Date.now() - T.t0) / 1000);
  rec.auto = !!auto;
  if (note) rec.note = note;
  T.cur = i + 1;
  T.t0 = Date.now();
  T.open = true; T.openUntil = Date.now() + 9000;
  if (auto) toast(t("t_task_done") + " · " + mmss(rec.secs));
  if (T.cur >= TASKS.length) finishTasks();
  set({});
}
function finishTasks() {
  const T = S.test;
  for (let i = T.cur; i < TASKS.length; i++) if (!T.tasks[i].status) T.tasks[i].status = "fail";
  T.cur = TASKS.length;
  T.phase = "after";
  T.tasksEnd = Date.now();
  set({});
  // let the action that completed the last task finish its own navigation first
  setTimeout(() => { if (S.test && S.test.phase === "after") set({ sheets: [{ type: "testAfter" }] }); }, 450);
}
function startTest(meta) {
  clearTimeout(saveTimer);
  Store.saveUser(S.user);
  const snap = JSON.parse(JSON.stringify(S.user));
  Store.sandbox = true; Store.sandboxItems = [];
  S.user = Object.assign(defaultUser(), { lang: snap.lang, town: snap.town, chains: snap.chains, onboarded: !meta.onb, updated: Date.now() });
  S.test = {
    phase: meta.onb ? "onb" : "tasks", meta, snap, cur: 0, start: Date.now(), t0: Date.now(), tasksEnd: null, open: true, openUntil: Date.now() + 12000,
    tasks: TASKS.map(x => ({ id: x.id, status: null, secs: 0, help: 0, auto: false, note: "" })),
    ans: { useful: 0, easy: 0, trust: 0, use: "", pay: "", feature: "", ev: {}, decision: "" },
  };
  Store.refreshCommunity();
  set({ sheets: [], tab: "inici", q: "" });
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}
function testOnboardingDone() {
  if (!S.test) return;
  S.test.phase = "tasks"; S.test.t0 = Date.now(); S.test.open = true; S.test.openUntil = Date.now() + 12000;
  set({});
}
function endTest() {
  const T = S.test;
  if (!T) return;
  Store.sandbox = false; Store.sandboxItems = [];
  S.user = cleanUser(T.snap);
  S.test = null;
  Store.refreshCommunity();
  set({ sheets: [] });
  go("inici");
}
function testRecord() {
  const T = S.test;
  const end = Date.now();
  return {
    code: T.meta.code, date: isoToday(), durMin: Math.round((end - T.start) / 600) / 100,
    facilitator: T.meta.facilitator, guio: T.meta.guio, version: T.meta.version, seg: T.meta.seg, profile: T.meta.profile,
    criteria: T.meta.criteria, relation: T.meta.relation, consentP: T.meta.consentP, consentR: T.meta.consentR, notP: T.meta.notP,
    tasks: T.tasks.map(x => Object.assign({}, x)), ans: JSON.parse(JSON.stringify(T.ans)),
    savedBy: Store.me.id || null, savedAt: end, app: "Preuet V1", dataDate: X.D.meta.updated, lang: LANG,
  };
}

/* ---------- ficha (always in Catalan, the DP language) ---------- */
const REL = { none: "rel_none", known: "rel_known", family: "rel_family", mate: "rel_mate", other: "rel_other" };
const FEAT = ["feat_cmp", "feat_qp", "feat_nut", "feat_stock", "feat_rec", "feat_per", "feat_off", "feat_org"];
function taskLine(x, i) {
  const st = x.status === "ok" ? ca("t_status_ok") : x.status === "help" ? ca("t_status_help") + " (" + x.help + ")" : ca("t_status_fail");
  return "T" + (i + 1) + " " + ca(TASKS[i].h) + ": " + st + ", " + mmss(x.secs) + (x.auto ? ", " + ca("t_status_auto") : "") + (x.note ? " — " + x.note : "");
}
function fichaRows(r) {
  const a = r.ans || {};
  const ev = a.ev || {};
  const evs = [["link", "ev_link"], ["notify", "ev_notify"], ["saved", "ev_saved"], ["contrib", "ev_contrib"], ["extra", "ev_extra"]].filter(([k]) => ev[k]).map(([, k]) => ca(k));
  if (a.evOther) evs.push(a.evOther);
  const q = (v, l) => (v ? l + ": «" + v + "»" : "");
  const segName = r.seg ? "Segment " + r.seg + " (" + ca("seg_" + r.seg).toLowerCase() + ")" : "";
  const pay = a.pay ? ca("pay_" + a.pay) : "—";
  return [
    ["Codi i arxiu a Drive", r.code + " / " + r.code + "_Solucio_" + r.date],
    ["Data i durada", fmtDL(r.date) + " · " + fmtNum(Math.round(r.durMin * 10) / 10) + " min"],
    ["Participant principal de l'equip", r.facilitator || "—"],
    ["Versió del guió o protocol", r.guio || "—"],
    ["Perfil de la persona", [segName, r.profile].filter(Boolean).join(" — ") || "—"],
    ["Criteri de selecció", r.criteria || "—"],
    ["Relació prèvia amb l'equip", ca(REL[r.relation] || "rel_none")],
    ["Consentiment per participar", r.consentP ? "Sí" : "No"],
    ["Consentiment per gravar", r.consentR ? "Sí" : "No (s'han pres notes)"],
    ["Versió del PMV i material mostrat", "PMV " + (r.version || "V1") + " — web app mòbil Preuet (dades del " + fmtDL(r.dataDate) + "): comparador per cistella, rànquing qualitat-preu, fitxa de producte, estoc col·laboratiu, receptes i compres periòdiques. La persona l'ha fet servir sola amb 6 tasques."],
    ["Tasca realitzada o observació", r.tasks.map(taskLine).join(" · ") + (a.observer ? ". Observació: " + a.observer : "")],
    ["Què va comprendre i què va valorar", [q(a.understood, "Comprensió"), "Utilitat " + (a.useful || "—") + "/5 · facilitat " + (a.easy || "—") + "/5 · confiança en els preus " + (a.trust || "—") + "/5", q(a.liked, "El que més li ha agradat"), a.feature ? "Funció que faria servir més: " + ca(a.feature) : ""].filter(Boolean).join(". ")],
    ["Dubtes, resistències o barreres", a.doubts ? "«" + a.doubts + "»" : "—"],
    ["Reacció davant preu, canal o ingressos", "Pagaria per la versió amb avisos i compres automàtiques: " + pay + (a.priceComment ? ". «" + a.priceComment + "»" : "")],
    ["Evidència conductual o compromís", (evs.length ? evs.join("; ") : "Cap senyal observable més enllà de l'ús durant la prova") + (a.use ? ". La faria servir: " + ca(a.use === "si" ? "yes" : a.use === "no" ? "no" : "maybe") : "")],
    ["Aprenentatge per al projecte", [a.decision ? ca("dec_" + a.decision) : "", a.learning || ""].filter(Boolean).join(" — ") || "—"],
  ];
}
function fichaText(r) {
  return ["FITXA DE PROVA DE SOLUCIÓ — " + r.code, ""].concat(fichaRows(r).map(([k, v]) => k + ": " + v)).concat(["", "Generada amb el mode prova de Preuet. Sense dades personals."]).join("\n");
}
function fichaMd(r) {
  const esc = s => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
  return ["## Fitxa de prova de solució — " + r.code, "", "| Camp | Contingut |", "|---|---|"].concat(fichaRows(r).map(([k, v]) => "| " + esc(k) + " | " + esc(v) + " |")).join("\n") + "\n";
}
function testsCsv(all) {
  const head = ["codi", "data", "durada_min", "segment", "versio_pmv", "relacio", "consent_participar", "consent_gravar"]
    .concat(TASKS.flatMap((x, i) => ["t" + (i + 1) + "_estat", "t" + (i + 1) + "_segons", "t" + (i + 1) + "_ajudes"]))
    .concat(["utilitat", "facilitat", "confianca", "faria_servir", "pagaria", "funcio_preferida", "evidencies", "decisio"]);
  const cell = v => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = CODES.filter(c => all[c]).map(c => {
    const r = all[c], a = r.ans || {}, ev = a.ev || {};
    return [r.code, r.date, r.durMin, r.seg, r.version, r.relation, r.consentP ? "si" : "no", r.consentR ? "si" : "no"]
      .concat(TASKS.flatMap((x, i) => { const k = (r.tasks || [])[i] || {}; return [k.status || "", k.secs || 0, k.help || 0]; }))
      .concat([a.useful || "", a.easy || "", a.trust || "", a.use || "", a.pay || "", a.feature ? ca(a.feature) : "", Object.keys(ev).filter(k => ev[k]).join("+"), a.decision || ""]);
  });
  return [head].concat(rows).map(r => r.map(cell).join(",")).join("\n") + "\n";
}

/* ---------- setup + results ---------- */
function TestSetupSheet() {
  const saved = S.tests || {};
  const firstFree = CODES.find(c => !saved[c]) || "S01";
  const [m, setM] = useState({ code: firstFree, facilitator: "", guio: "Guió de prova de solució v1 · 16/10/2026", version: "V1", seg: "A", profile: "", criteria: "", relation: "none", consentP: null, consentR: null, notP: false, onb: true });
  const [key, setKey] = useState(lsGet(LS_TEAMKEY) || "");
  const upd = (k, v) => setM(Object.assign({}, m, { [k]: v }));
  const ok = m.consentP === true && m.notP && m.consentR !== null;
  const YN = (k, label) => html`<div class="field"><span class="lab">${label}</span><${Seg} label=${label} value=${m[k] === true ? "y" : m[k] === false ? "n" : ""} onChange=${v => upd(k, v === "y")} options=${[{ v: "y", l: t("yes") }, { v: "n", l: t("no") }]} /></div>`;
  const done = CODES.filter(c => saved[c]).length;
  return html`<${Sheet} title=${t("t_title")} onClose=${closeSheet} id="test"
    foot=${html`<button type="button" class="btn primary block" disabled=${!ok} onClick=${() => startTest(m)}><${Icon} n="play" />${t("t_begin")} · ${m.code}</button>`}>
    <div class="stack-l">
      <div class="callout stack-s"><p class="small">${t("t_intro")}</p><p class="small"><b>${t("t_privacy")}</b></p></div>
      <div class="field"><span class="lab">${t("t_code")}</span><div class="chips">${CODES.map(c => html`<button type="button" key=${c} class="filter" aria-pressed=${String(m.code === c)} onClick=${() => upd("code", c)}>${c}${saved[c] ? " ✓" : ""}</button>`)}</div>
        ${saved[m.code] ? html`<p class="xs" style="color:var(--warn)">${t("t_overwrite", { c: m.code })}</p>` : null}</div>
      <div class="field"><label for="tf-fac">${t("t_facilitator")}</label><input id="tf-fac" type="text" list="team-hint" maxlength="40" value=${m.facilitator} placeholder=${t("t_facilitator_ph")} onInput=${e => upd("facilitator", e.currentTarget.value)} />
        <datalist id="team-hint">${TEAM_HINT.map(x => html`<option value=${x} key=${x}></option>`)}</datalist></div>
      <div class="field"><label for="tf-guio">${t("t_guio")}</label><input id="tf-guio" type="text" maxlength="80" value=${m.guio} onInput=${e => upd("guio", e.currentTarget.value)} /></div>
      <div class="field"><span class="lab">${t("t_version")}</span><${Seg} label=${t("t_version")} value=${m.version} onChange=${v => upd("version", v)} options=${[{ v: "V1", l: "V1" }, { v: "V2", l: "V2" }, { v: "V3", l: "V3" }]} /></div>
      <div class="field"><span class="lab">${t("t_seg")}</span><${Seg} label=${t("t_seg")} value=${m.seg} onChange=${v => upd("seg", v)} options=${["A", "B", "C"].map(s => ({ v: s, l: s + " · " + t("seg_" + s) }))} /></div>
      <div class="field"><label for="tf-prof">${t("t_profile")}</label><textarea id="tf-prof" maxlength="200" placeholder=${t("t_profile_ph")} value=${m.profile} onInput=${e => upd("profile", e.currentTarget.value)}></textarea></div>
      <div class="field"><label for="tf-crit">${t("t_criteria")}</label><textarea id="tf-crit" maxlength="200" placeholder=${t("t_criteria_ph")} value=${m.criteria} onInput=${e => upd("criteria", e.currentTarget.value)}></textarea></div>
      <div class="field"><label for="tf-rel">${t("t_relation")}</label><select id="tf-rel" value=${m.relation} onChange=${e => upd("relation", e.currentTarget.value)}>${Object.keys(REL).map(k => html`<option value=${k} key=${k}>${t(REL[k])}</option>`)}</select></div>
      <${Toggle} checked=${m.notP} onChange=${v => upd("notP", v)} label=${t("t_notP")} />
      ${YN("consentP", t("t_consentP"))}
      ${YN("consentR", t("t_consentR"))}
      ${m.consentP === false ? html`<div class="callout warn">${t("t_consent_need")}</div>` : null}
      <${Toggle} checked=${m.onb} onChange=${v => upd("onb", v)} label=${t("t_onboarding")} />
      <p class="xs faint">${t("t_begin_note")}</p>
      ${Store.mode === "supabase" ? html`<div class="field"><label for="tf-key">Codi d'equip / Código de equipo</label><input id="tf-key" type="password" value=${key} onInput=${e => setKey(e.currentTarget.value)} onChange=${e => { lsSet(LS_TEAMKEY, e.currentTarget.value); if (Store._reloadTests) Store._reloadTests(); }} /></div>` : null}
      <${TestResults} done=${done} />
    </div><//>`;
}
function TestResults({ done }) {
  const all = S.tests || {};
  const list = CODES.filter(c => all[c]);
  const avg = k => { const v = list.map(c => (all[c].ans || {})[k]).filter(x => x > 0); return v.length ? fmtNum(Math.round(sum(v) / v.length * 10) / 10) : "—"; };
  return html`<section class="stack">
    <div><h3>${t("t_results")}</h3><p class="small muted">${t("t_results_sub", { n: done })} ${Store.mode === "claude" ? t("t_team_only") : ""}</p></div>
    ${list.length ? html`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${t("t_code")}</th><th>${t("t_seg")}</th><th>PMV</th><th>${t("t_dur")}</th><th>${t("t_tasks_done")}</th><th>U</th><th>F</th><th>C</th><th>${t("q_use").split(" ")[0]}</th><th></th></tr></thead>
      <tbody>${list.map(c => { const r = all[c], a = r.ans || {}; const okN = (r.tasks || []).filter(x => x.status === "ok" || x.status === "help").length;
        return html`<tr key=${c}><td><b>${c}</b><div class="xs faint">${fmtD(r.date)}</div></td><td>${r.seg}</td><td>${r.version}</td><td class="n">${fmtNum(Math.round(r.durMin * 10) / 10)}′</td><td class="n">${okN}/6</td>
          <td class="n">${a.useful || "—"}</td><td class="n">${a.easy || "—"}</td><td class="n">${a.trust || "—"}</td><td>${a.use ? t(a.use === "si" ? "yes" : a.use === "no" ? "no" : "maybe") : "—"}</td>
          <td><button type="button" class="btn small ghost" onClick=${() => openSheet({ type: "testSummary", code: c })}>${t("t_open")}</button></td></tr>`; })}
        <tr><td colspan="5"><b>${t("t_avg")}</b></td><td class="n">${avg("useful")}</td><td class="n">${avg("easy")}</td><td class="n">${avg("trust")}</td><td colspan="2"></td></tr></tbody>
    </table></div>
    <p class="xs faint">U = ${t("q_useful")} · F = ${t("q_easy")} · C = ${t("q_trust")} (${t("t_scale")})</p>
    <div class="row wrap-ok">
      ${canDownload() ? html`<button type="button" class="btn small ghost" onClick=${() => download("preuet-proves-solucio.csv", testsCsv(all), "text/csv")}><${Icon} n="download" s=${16} />${t("t_csv")}</button>
      <button type="button" class="btn small ghost" onClick=${() => download("preuet-fitxes-S01-S10.md", "# Fitxes de prova de solució · Preuet\n\n" + list.map(c => fichaMd(all[c])).join("\n"), "text/markdown")}><${Icon} n="download" s=${16} />${t("t_all_md")}</button>` : null}
      <button type="button" class="btn small ghost" onClick=${() => copyText(testsCsv(all))}><${Icon} n="copy" s=${16} />CSV</button>
    </div>` : html`<p class="small muted">${t("t_none_saved")}</p>`}
  </section>`;
}

/* ---------- live task bar ---------- */
function TestBar() {
  const T = S.test;
  const ref = useRef(null);
  const [, tick] = useReducer(x => x + 1, 0);
  const [more, setMore] = useState(false);
  const [conf, setConf] = useState(false);
  useEffect(() => { const iv = setInterval(() => {
    const X_ = S.test;
    if (X_ && X_.open && X_.openUntil && Date.now() > X_.openUntil) { X_.open = false; X_.openUntil = 0; }
    tick();
  }, 1000); return () => clearInterval(iv); }, []);
  // publish the bar's live height (--tb-h) so pages, sheet footers and toasts keep clear of it
  useLayoutEffect(() => {
    const el = ref.current, root = document.documentElement;
    if (!el) return undefined;
    const put = () => root.style.setProperty("--tb-h", Math.ceil(el.getBoundingClientRect().height) + "px");
    put();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(put) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); root.style.removeProperty("--tb-h"); };
  }, []);
  const cur = T ? T.cur : -1;
  useEffect(() => { setMore(false); setConf(false); }, [cur]);
  if (!T || T.phase !== "tasks") return null;
  const i = T.cur;
  if (i >= TASKS.length) return null;
  const rec = T.tasks[i];
  const secs = (Date.now() - T.t0) / 1000;
  const hold = () => { T.openUntil = 0; }; // the facilitator is using the bar: stop the auto-collapse
  return html`<div class="testbar" ref=${ref} role="region" aria-label=${t("t_title")}>
    <div class="row tb-top">
      <b class="num">${T.meta.code} · <span class="tb-long">${t("t_task_n", { a: i + 1, b: TASKS.length })}</span><span class="tb-short" aria-hidden="true">${i + 1}/${TASKS.length}</span></b><span class="num tb-dim">${mmss(secs)}</span>
      ${rec.help ? html`<span class="xs tb-dim">· ${t("t_help")} ${rec.help}</span>` : null}<span class="grow"></span>
      <button type="button" class="alt" onClick=${() => { rec.help += 1; hold(); set({}); }}>${t("t_help")} +1</button>
      <button type="button" onClick=${() => completeTask("ok", false)}>${t("t_ok")}</button>
      <button type="button" class="alt tb-icon" aria-expanded=${String(T.open)} aria-label=${T.open ? t("t_hide") : t("t_show")} onClick=${() => { T.open = !T.open; hold(); set({}); }}>${T.open ? "▾" : "▴"}</button>
    </div>
    ${T.open ? html`<div class="stack-s">
      <p class="tb-task">${t(TASKS[i].id)}</p>
      <div class="row tb-foot"><span class="xs tb-dim grow">${t("t_hyp")}: ${t(TASKS[i].h)}</span>
        <button type="button" class="alt" onClick=${() => completeTask("fail", false)}>${t("t_skip")}</button>
        <button type="button" class="alt tb-icon" aria-expanded=${String(more)} aria-label=${t("t_more")} onClick=${() => { setMore(!more); setConf(false); hold(); }}>⋯</button>
      </div>
      ${more ? html`<div class="row wrap-ok tb-more">
        <button type="button" class="alt" onClick=${() => finishTasks()}>${t("t_finish")}</button>
        ${conf ? html`<span class="xs grow">${t("t_abort_q")}</span><button type="button" onClick=${endTest}>${t("t_abort_yes")}</button>`
          : html`<button type="button" class="alt" onClick=${() => setConf(true)}>${t("t_abort")}</button>`}
      </div>` : null}
    </div>` : null}
  </div>`;
}

/* ---------- post-task questions ---------- */
function Likert({ k, label }) {
  const a = S.test.ans;
  return html`<div class="field"><span class="lab">${label}</span><div class="row" style="gap:6px">${[1, 2, 3, 4, 5].map(v => html`<button type="button" key=${v} class="filter" style="min-width:44px" aria-pressed=${String(a[k] === v)} onClick=${() => { a[k] = v; set({}); }}>${v}</button>`)}</div><span class="xs faint">${t("t_scale")}</span></div>`;
}
function TArea({ k, label, ph }) {
  const a = S.test.ans;
  return html`<div class="field"><label for=${"ta-" + k}>${label}</label><textarea id=${"ta-" + k} maxlength="600" placeholder=${ph || ""} value=${a[k] || ""} onInput=${e => { a[k] = e.currentTarget.value; }} onBlur=${() => set({})}></textarea></div>`;
}
function TestAfterSheet() {
  const T = S.test;
  if (!T) return null;
  const a = T.ans;
  const pick = (k, v) => { a[k] = v; set({}); };
  return html`<${Sheet} title=${t("t_after") + " · " + T.meta.code} onClose=${null} id="testAfter"
    foot=${html`<button type="button" class="btn primary block" onClick=${() => { T.phase = "summary"; set({ sheets: [{ type: "testSummary", code: null }] }); }}>${t("next")}</button>`}>
    <div class="stack-l">
      <p class="small muted">${t("t_after_sub")}</p>
      <div class="card stack-s">${T.tasks.map((x, i) => html`<div class="row small" key=${x.id}><span class="grow">T${i + 1} · ${t(TASKS[i].h)}</span>
        <span class=${"chip " + (x.status === "ok" ? "good" : x.status === "help" ? "warn" : "bad")}>${t(x.status === "ok" ? "t_status_ok" : x.status === "help" ? "t_status_help" : "t_status_fail")}</span><span class="num xs">${mmss(x.secs)}</span></div>`)}</div>
      <${TArea} k="understood" label=${t("q_understood")} />
      <${Likert} k="useful" label=${t("q_useful")} />
      <${Likert} k="easy" label=${t("q_easy")} />
      <${Likert} k="trust" label=${t("q_trust")} />
      <${TArea} k="liked" label=${t("q_liked")} />
      <${TArea} k="doubts" label=${t("q_doubts")} />
      <div class="field"><span class="lab">${t("q_feature")}</span><div class="chips">${FEAT.map(f => html`<button type="button" key=${f} class="filter" aria-pressed=${String(a.feature === f)} onClick=${() => pick("feature", f)}>${t(f)}</button>`)}</div></div>
      <div class="field"><span class="lab">${t("q_use")}</span><${Seg} label=${t("q_use")} value=${a.use} onChange=${v => pick("use", v)} options=${[{ v: "si", l: t("yes") }, { v: "potser", l: t("maybe") }, { v: "no", l: t("no") }]} /></div>
      <div class="field"><span class="lab">${t("q_pay")}</span><div class="chips">${["0", "1", "2", "3"].map(v => html`<button type="button" key=${v} class="filter" aria-pressed=${String(a.pay === v)} onClick=${() => pick("pay", v)}>${t("pay_" + v)}</button>`)}</div></div>
      <${TArea} k="priceComment" label=${t("q_price_comment")} ph=${t("q_price_ph")} />
      <div class="field"><span class="lab">${t("t_evidence")}</span>
        ${[["link", "ev_link"], ["notify", "ev_notify"], ["saved", "ev_saved"], ["contrib", "ev_contrib"], ["extra", "ev_extra"]].map(([k, l]) => html`<${Toggle} key=${k} checked=${!!a.ev[k]} onChange=${v => { a.ev[k] = v; set({}); }} label=${t(l)} />`)}</div>
      <${TArea} k="evOther" label=${t("ev_other")} />
      <${TArea} k="observer" label=${t("t_observer")} />
      <div class="field"><span class="lab">${t("t_learning")}</span><${Seg} label=${t("t_learning")} value=${a.decision} onChange=${v => pick("decision", v)} options=${[{ v: "keep", l: t("dec_keep") }, { v: "iterate", l: t("dec_iterate") }, { v: "rethink", l: t("dec_rethink") }]} /></div>
      <${TArea} k="learning" label=${t("t_learning")} ph=${t("t_learning_ph")} />
    </div><//>`;
}
function TestSummarySheet({ code }) {
  const live = !code && S.test;
  const r = live ? (S.test.rec || (S.test.rec = testRecord())) : (S.tests || {})[code];
  const [state, setState] = useState(null);
  if (!r) return null;
  const rows = fichaRows(r);
  const save = async () => {
    setState("saving");
    const res = await Store.saveTest(r.code, r);
    setState(res);
    toast(res === "shared" ? t("t_saved", { c: r.code }) : t("t_saved_local", { c: r.code }));
  };
  const foot = live ? html`<div class="stack-s">
      <button type="button" class="btn primary block" disabled=${state === "saving" || state === "shared" || state === "local"} onClick=${save}><${Icon} n="check" />${state === "shared" || state === "local" ? t("saved") : t("t_save")}</button>
      <button type="button" class="btn ghost block" onClick=${endTest}>${t("t_end")}</button></div>` : null;
  return html`<${Sheet} title=${t("t_summary") + " · " + r.code} onClose=${live ? null : closeSheet} foot=${foot} id=${"sum" + r.code}>
    <div class="stack-l">
      <p class="small muted">${t("t_summary_sub")}</p>
      <dl class="card" style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin:0">${rows.map(([k, v]) => html`<div key=${k} style="border-bottom:1px solid var(--line);padding-bottom:8px">
        <dt class="xs" style="text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);font-weight:700">${k}</dt><dd class="small" style="margin:3px 0 0;overflow-wrap:anywhere">${v}</dd></div>`)}</dl>
      <div class="row wrap-ok">
        <button type="button" class="btn small ghost" onClick=${() => copyText(fichaText(r))}><${Icon} n="copy" s=${16} />${t("t_copy_md")}</button>
        ${canDownload() ? html`<button type="button" class="btn small ghost" onClick=${() => download(r.code + "_Solucio_" + r.date + ".md", fichaMd(r), "text/markdown")}><${Icon} n="download" s=${16} />${t("t_dl_md")}</button>` : null}
      </div>
    </div><//>`;
}
