/* ===== main.js ===== */
/* ---------- root ---------- */
function App() {
  const [, force] = useReducer(x => x + 1, 0);
  useLayoutEffect(() => { RENDER.add(force); return () => RENDER.delete(force); }, []);
  const [err, resetErr] = useErrorBoundary(e => console.error("render error", e));
  useEffect(() => {
    const onKey = e => {
      if (e.key !== "Escape" || !S.sheets.length) return;
      const top = S.sheets[S.sheets.length - 1];
      if (top.type === "testAfter" || (top.type === "testSummary" && !top.code)) return;
      closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = S.sheets.length || (S.user && !S.user.onboarded) ? "hidden" : "";
    document.body.classList.toggle("testing", !!(S.test && S.test.phase === "tasks"));
    document.body.classList.toggle("sheet-open", S.sheets.length > 0);
  });
  const ids = [...new Set(S.community.map(c => c.uid).filter(Boolean))].sort().join(",");
  useEffect(() => {
    if (!ids || Store.mode !== "claude") return;
    Store.profiles(ids.split(",")).then(p => { if (p && Object.keys(p).length) set({ profiles: Object.assign({}, S.profiles, p) }); });
  }, [ids]);
  if (err) return html`<div class="loading"><div class="stack"><b>${t("error_t")}</b><p>${t("error_s")}</p>
    <button type="button" class="btn primary" onClick=${() => { set({ sheets: [] }); resetErr(); }}>${t("reload")}</button></div></div>`;
  if (!S.ready) return html`<div class="loading"><div><b>Preuet</b><p>${t("loading")}</p></div></div>`;
  const tab = S.tab;
  return html`
    <${Header} />
    <main><div class="wrap">
      ${tab === "inici" ? html`<${Home} />` : tab === "cistella" ? html`<${Basket} />` : tab === "ofertes" ? html`<${Offers} />` : tab === "receptes" ? html`<${Recipes} />` : html`<${More} />`}
    </div></main>
    <${TabBar} />
    ${S.sheets.map((s, i) => html`<${SheetRouter} key=${i + ":" + s.type + ":" + (s.id || s.code || "")} s=${s} />`)}
    ${S.user && !S.user.onboarded ? html`<${Onboarding} />` : null}
    ${S.test && S.test.phase === "tasks" ? html`<${TestBar} />` : null}
    <${CopyFallback} />
    ${S.toast ? html`<div class="toast" role="status" aria-live="polite">${S.toast}</div>` : null}`;
}

async function fetchNewerData() {
  try {
    const r = await fetch("data/preuet-data.json", { cache: "no-store" });
    if (!r.ok) return;
    const D = await r.json();
    if (D && D.meta && Array.isArray(D.products) && D.meta.updated > X.D.meta.updated) {
      indexData(D); MEMO.clear(); S.user = cleanUser(S.user); set({});
    }
  } catch (e) { /* offline or not published: keep embedded data */ }
}

function loadScript(src) { // web build: supabase-js is fetched only when a Supabase project is configured
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("load " + src));
    document.head.appendChild(s);
  });
}

/* The artifact carries the data inline; the web version fetches data/preuet-data.json (the service worker keeps a copy offline). */
async function readData() {
  const el = document.getElementById("preuet-data");
  if (el && el.textContent.trim()) return { D: JSON.parse(el.textContent), inline: true };
  const r = await fetch("data/preuet-data.json");
  if (!r.ok) throw new Error("data " + r.status);
  return { D: await r.json(), inline: false };
}

async function boot() {
  let D = null, inline = false;
  try { ({ D, inline } = await readData()); } catch (e) { console.error("data", e); }
  if (!D) { document.getElementById("app").textContent = "Preuet: no s'han pogut carregar les dades. Torna-ho a provar amb connexió. / No se han podido cargar los datos."; return; }
  indexData(D);
  S.user = cleanUser(lsGet(LS_USER));
  LANG = S.user.lang; document.documentElement.lang = LANG;
  const h = (location.hash || "").slice(1);
  if (TABS.some(x => x[0] === h)) S.tab = h;
  S.ready = true;
  applyTheme(S.user.theme);
  const root = document.getElementById("app");
  root.textContent = ""; // the static "loading" placeholder: Preact would otherwise leave it at the bottom of every page
  render(html`<${App} />`, root);
  if (inline) fetchNewerData();
  const cfg = window.PREUET_CONFIG || null;
  let ok = false;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    try {
      if (!window.supabase && cfg.supabaseJs) await loadScript(cfg.supabaseJs);
      ok = await Store.initSupabase(cfg);
    } catch (e) { console.warn("supabase", e); }
  }
  if (!ok) { try { ok = await Store.initClaude(); } catch (e) { console.warn("claude", e); } }
  S.mode = Store.mode;
  initDownloads().then(() => set({}));
  try {
    const remote = await Store.loadUser();
    if (remote && !S.test && (remote.updated || 0) > (S.user.updated || 0)) {
      S.user = cleanUser(remote); LANG = S.user.lang; document.documentElement.lang = LANG;
    }
  } catch (e) { console.warn("user", e); }
  set({});
  if (!openSharedBasket()) announceWatched();
  window.addEventListener("hashchange", () => { if (/^#c=/.test(location.hash)) openSharedBasket(); });
  try { Store.subscribeCommunity(list => set({ community: list || [] })); } catch (e) { console.warn("community", e); }
  try { Store.subscribeTests(o => set({ tests: o || {} })); } catch (e) { console.warn("tests", e); }
}
if (window.__preuetDebug) window.__preuet = { S, Store, X: () => X };
boot();

})();