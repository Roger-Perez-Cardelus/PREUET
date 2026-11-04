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
    // while a sheet or the welcome is open, the page behind it is out of reach for keyboards and screen readers
    const behind = S.sheets.length > 0 || !!(S.user && !S.user.onboarded);
    document.querySelectorAll("#app > header, #app > main, #app > nav").forEach(el => { el.inert = behind; });
    // only the top sheet is live
    const sheets = document.querySelectorAll("#app > .sheet");
    sheets.forEach((el, i) => { el.inert = i < sheets.length - 1; });
  });
  if (err) return html`<div class="loading"><div class="stack"><b>${t("error_t")}</b><p>${t("error_s")}</p>
    <button type="button" class="btn primary" onClick=${() => { set({ sheets: [] }); resetErr(); }}>${t("reload")}</button></div></div>`;
  if (!S.ready) return html`<div class="loading"><div><b>Preuet</b><p>${t("loading")}</p></div></div>`;
  const tab = S.tab;
  return html`
    <a class="skip-link" href="#contingut" onClick=${e => { e.preventDefault(); const m = document.getElementById("contingut"); if (m) m.focus(); }}>${t("skip_content")}</a>
    <${Header} />
    ${S.offline ? html`<div class="offline-bar" role="status"><${Icon} n="alert" s=${14} />${t("offline_bar")}</div>` : null}
    <main id="contingut" tabindex="-1"><div class="wrap">
      ${PLUS_TABS[tab] && !hasPlus() ? html`<${PlusGate} key=${tab} f=${PLUS_TABS[tab]} />` : tab === "inici" ? html`<${Home} />` : tab === "cistella" ? html`<${Basket} />` : tab === "ofertes" ? html`<${Offers} />` : tab === "receptes" ? html`<${Recipes} />` : html`<${More} />`}
    </div></main>
    <${TabBar} />
    ${S.sheets.map((s, i) => html`<${SheetRouter} key=${i + ":" + s.type + ":" + (s.id || s.code || "")} s=${s} />`)}
    ${S.user && !S.user.onboarded ? html`<${Onboarding} />` : null}
    ${S.test && S.test.phase === "tasks" ? html`<${TestBar} />` : null}
    <${CopyFallback} />
    ${S.toast ? html`<div class=${"toast" + (S.toastAction ? " has-action" : "")} role="status" aria-live="polite"><span>${S.toast}</span>${S.toastAction ? html`<button type="button" onClick=${() => { const a = S.toastAction; set({ toast: null, toastAction: null }); a.run(); }}>${S.toastAction.label}</button>` : null}</div>` : null}`;
}

function loadScript(src) { // web build: supabase-js is fetched only when a Supabase project is configured
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error("load " + src));
    document.head.appendChild(s);
  });
}

/* the data is fetched once; the service worker keeps a copy for offline use */
async function readData() {
  const r = await fetch("data/preuet-data.json");
  if (!r.ok) throw new Error("data " + r.status);
  return r.json();
}

async function boot() {
  let D = null;
  try { D = await readData(); } catch (e) { console.error("data", e); }
  if (!D) { document.getElementById("app").textContent = "Preuet: no s'han pogut carregar les dades. Torna-ho a provar amb connexió. / No se han podido cargar los datos."; return; }
  indexData(D);
  S.user = cleanUser(lsGet(LS_USER));
  LANG = S.user.lang; document.documentElement.lang = LANG;
  const h = (location.hash || "").slice(1);
  if (TABS.some(x => x[0] === h)) S.tab = h;
  S.ready = true;
  applyTheme(S.user.theme);
  applyA11y(S.user.a11y);
  const root = document.getElementById("app");
  root.textContent = ""; // the static "loading" placeholder: Preact would otherwise leave it at the bottom of every page
  render(html`<${App} />`, root);
  const cfg = window.PREUET_CONFIG || null;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    try {
      if (!window.supabase && cfg.supabaseJs) await loadScript(cfg.supabaseJs);
      await Store.initSupabase(cfg);
    } catch (e) { console.warn("supabase", e); }
  }
  S.mode = Store.mode;
  try {
    const remote = await Store.loadUser();
    if (remote && !S.test && (remote.updated || 0) > (S.user.updated || 0)) {
      S.user = cleanUser(remote); LANG = S.user.lang; document.documentElement.lang = LANG;
    }
  } catch (e) { console.warn("user", e); }
  set({});
  if (!openSharedBasket() && !openSharedProduct()) announceWatched();
  window.addEventListener("hashchange", () => { if (/^#c=/.test(location.hash)) openSharedBasket(); else if (/^#p=/.test(location.hash)) openSharedProduct(); });
  try { Store.subscribeCommunity(list => set({ community: list || [] })); } catch (e) { console.warn("community", e); }
  try { Store.subscribeTests(o => set({ tests: o || {} })); } catch (e) { console.warn("tests", e); }
}
/* install prompt (Android/desktop Chrome) and connectivity */
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL.ev = e; set({}); });
window.addEventListener("appinstalled", () => { INSTALL.ev = null; INSTALL.done = true; set({}); });
window.addEventListener("online", () => set({ offline: false }));
window.addEventListener("offline", () => set({ offline: true }));
S.offline = typeof navigator !== "undefined" && navigator.onLine === false;
if (window.__preuetDebug) window.__preuet = { S, Store, X: () => X };
boot();

})();