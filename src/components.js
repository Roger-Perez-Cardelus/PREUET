/* ===== components.js ===== */
/* ---------- icons (24px stroke) ---------- */
const ICONS = {
  home: "M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z",
  basket: "M3 9.5h18l-1.7 9a2 2 0 0 1-2 1.5H6.7a2 2 0 0 1-2-1.5zM8 9.5l3-5.5M16 9.5l-3-5.5M9 13.5v3M12 13.5v3M15 13.5v3",
  tag: "M20.4 13.5l-6.9 6.9a2 2 0 0 1-2.8 0L3 12.7V4a1 1 0 0 1 1-1h8.7l7.7 7.7a2 2 0 0 1 0 2.8zM7.8 6.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  pot: "M4 10.5h16V16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2.5 10.5h19M9.5 7c0-1.2 1.2-1.6 1.2-2.8M13.5 7c0-1.2 1.2-1.6 1.2-2.8",
  grid: "M4.5 4.5h5.5V10H4.5zM14 4.5h5.5V10H14zM4.5 14H10v5.5H4.5zM14 14h5.5v5.5H14z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21",
  plus: "M12 5v14M5 12h14", minus: "M5 12h14", x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  chevR: "M9.5 6l6 6-6 6", chevL: "M14.5 6l-6 6 6 6", chevD: "M6 9.5l6 6 6-6", chevU: "M6 14.5l6-6 6 6",
  trash: "M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5",
  copy: "M9 9h11v11H9zM5.5 15H4V4h11v1.5",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14",
  calendar: "M4 6h16v14H4zM4 10h16M8.5 3.5v5M15.5 3.5v5",
  store: "M4.5 10.5V20h15v-9.5M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M10 20v-5h4v5",
  star: "M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.7L12 16.8l-5.2 2.7 1-5.7-4.2-4.1 5.8-.9z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.6a3.5 3.5 0 0 1 0 6.4M18 14.4c1.8.8 3 2.6 3 4.6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5.5M12 7.6v.4",
  flask: "M9 3h6M10 3v6.2L5 18.2A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-2.8L14 9.2V3M7.4 15h9.2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.2v.3",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.2 2",
  pin: "M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  ext: "M14 4h6v6M20 4l-8.5 8.5M18 14v6H4V6h6",
  sliders: "M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  leaf: "M5 19C5 11 11 5 20 5c0 9-6 15-14 15zM5 19c3-3 6.2-6 9.5-8.2",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  chart: "M4 6h9M4 10.5h15M4 15h6M4 19.5h12",
  table: "M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.5M12 16.9v.4",
  msg: "M4 5h16v11H9.5L4 20z",
  box: "M3.5 7.5 12 3.2l8.5 4.3v9L12 20.8l-8.5-4.3zM3.5 7.5 12 11.8l8.5-4.3M12 11.8v9",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3z",
  shield: "M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z",
  play: "M8 5.5v13l10.5-6.5z",
  barcode: "M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12M2.5 4.5h3M18.5 4.5h3M2.5 19.5h3M18.5 19.5h3",
  share: "M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5", user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  refresh: "M19.5 11A7.5 7.5 0 0 0 6.2 6.5L4 9M4 4.5V9h4.5M4.5 13a7.5 7.5 0 0 0 13.3 4.5L20 15M20 19.5V15h-4.5",
  scale: "M12 4v16M5 8h14M7.5 8 4.5 14a3 3 0 0 0 6 0zM16.5 8l-3 6a3 3 0 0 0 6 0zM8 20h8",
  cat_lactics: "M8.5 3h7v3l2.5 3.5V21H6V9.5L8.5 6zM6 9.5h12M8.5 6h7M9.5 13.5h5",
  cat_fleca: "M4 11.5C4 7.4 7.6 4.5 12 4.5s8 2.9 8 7c0 1-.6 1.8-1.5 2V20h-13v-6.5c-.9-.2-1.5-1-1.5-2zM9 9.5l1.5 1.5M12.5 8.5 14 10",
  cat_rebost: "M8 3h8v3H8zM7 6h10a1.5 1.5 0 0 1 1.5 1.5V19a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7.5A1.5 1.5 0 0 1 7 6zM5.5 11h13M5.5 16h13",
  cat_carn: "M6.5 6C11 3 20 5 20 12c0 5.5-5.5 8.5-10.5 7.8C5 19 2.5 15.4 3.2 11.5 3.6 9 4.5 7.3 6.5 6zM14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  cat_fruita: "M12 7.5c-2-1.6-7.5-1.6-7.5 4.4 0 5 3.6 9.6 7.5 8.1 3.9 1.5 7.5-3.1 7.5-8.1 0-6-5.5-6-7.5-4.4zM12 7.5c0-2 1-3.6 3-4.5",
  cat_begudes: "M10 2.5h4V6l2 3v11.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3zM8 13.5h8",
  cat_llar: "M5 9h14l-1.5 11.5h-11zM5 9c0-3 3.1-5.5 7-5.5S19 6 19 9M9 13v4M15 13v4",
  cat_higiene: "M8.5 9.5h7a2 2 0 0 1 2 2V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-8.5a2 2 0 0 1 2-2zM12 9.5V5.5M12 5.5h4M9.5 3.5h5",
  cat_dietes: "M12 21V9M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5zM12 9c-2 0-3.5-1.5-3.5-3.5C10.5 5.5 12 7 12 9zM12 9c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5zM5 4l14 16",
};
const FILLED = new Set(["play"]);
function Icon({ n, s, fill, label }) {
  const d = ICONS[n] || ICONS.info;
  const f = fill || FILLED.has(n);
  return html`<svg class="ic" width=${s || 20} height=${s || 20} viewBox="0 0 24 24" fill=${f ? "currentColor" : "none"} stroke=${f ? "none" : "currentColor"}
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${label ? null : "true"} role=${label ? "img" : null} aria-label=${label || null}><path d=${d} /></svg>`;
}
function Logo() {
  return html`<svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M5 4.8h12.4l9.6 9.6a2.3 2.3 0 0 1 0 3.2l-9.4 9.4a2.3 2.3 0 0 1-3.2 0L5 17.6z" fill="#FFD23F" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    <circle cx="10.2" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M12.6 17.4l2.6 2.6 5.6-5.6" fill="none" stroke="#1D7A4C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

/* ---------- small pieces ---------- */
const SHORT = { mercadona: "Me", lidl: "Li", aldi: "Al", carrefour: "Ca", dia: "Di", bonpreu: "Bp", ametller: "Am", consum: "Co", bonarea: "bÀ", caprabo: "Cp", condis: "Cd", sorli: "So", spar: "Sp", suma: "Su" };
const SHORT_NAME = { ametller: "Ametller", carrefour: "Carrefour", mercadona: "Mercadona" };
function ChainBadge({ cid, noName, strong, short }) {
  const c = X.C.get(cid);
  if (!c) return null;
  return html`<span class="cb"><i style=${{ background: chipColor(c.color), color: textOn(chipColor(c.color)) }} aria-hidden="true">${SHORT[cid] || c.name.slice(0, 2)}</i>${noName ? null : html`<span style=${strong ? "font-weight:800" : ""}>${short && SHORT_NAME[cid] ? SHORT_NAME[cid] : c.name}</span>`}</span>`;
}
function PriceTag({ v, sub, lg, plain, title }) {
  return html`<span class=${"ptag" + (lg ? " lg" : "") + (plain ? " plain" : "")} title=${title || null}><span class="p">${eur(v)}</span>${sub ? html`<span class="u">${sub}</span>` : null}</span>`;
}
function Stepper({ value, onChange, min, label }) {
  const lo = min == null ? 0 : min;
  return html`<span class="stepper" role="group" aria-label=${label || null}>
    <button type="button" aria-label=${t("qty_minus")} onClick=${e => { e.stopPropagation(); onChange(Math.max(lo, value - 1)); }}>${value <= 1 && lo === 0 ? html`<${Icon} n="trash" s=${16} />` : "−"}</button>
    <span aria-live="polite">${value}</span>
    <button type="button" aria-label=${t("qty_plus")} onClick=${e => { e.stopPropagation(); onChange(Math.min(99, value + 1)); }}>+</button>
  </span>`;
}
function Seg({ options, value, onChange, label }) {
  return html`<div class="seg-ctl" role="group" aria-label=${label || null}>
    ${options.map(o => html`<button type="button" key=${o.v} aria-pressed=${String(value === o.v)} onClick=${() => onChange(o.v)}>${o.l}</button>`)}
  </div>`;
}
function Stars({ value, onChange, label }) {
  return html`<span class="stars" role=${onChange ? "radiogroup" : "img"} aria-label=${label || t("avg_rating", { x: value || 0, n: 0 })}>
    ${[1, 2, 3, 4, 5].map(i => onChange
      ? html`<button type="button" key=${i} class=${i <= (value || 0) ? "on" : ""} role="radio" aria-checked=${String(i === value)} aria-label=${t("stars_n", { n: i })} onClick=${() => onChange(i)}>★</button>`
      : html`<span key=${i} style=${{ color: i <= Math.round(value || 0) ? "var(--tag-edge)" : "var(--line)", fontSize: "1rem" }}>★</span>`)}
  </span>`;
}
function Empty({ title, sub, children }) {
  return html`<div class="empty"><b>${title}</b>${sub ? html`<p class="small">${sub}</p>` : null}${children ? html`<div style="margin-top:12px">${children}</div>` : null}</div>`;
}
function Toggle({ checked, onChange, label }) {
  return html`<label class="check"><input type="checkbox" checked=${checked} onChange=${e => onChange(e.currentTarget.checked)} /><span>${label}</span></label>`;
}
function ConfirmInline({ text, yes, onYes, onNo }) {
  return html`<div class="callout warn stack-s" role="alert"><span>${text}</span>
    <div class="row wrap-ok"><button type="button" class="btn small primary" onClick=${onYes}>${yes}</button><button type="button" class="btn small ghost" onClick=${onNo}>${t("cancel")}</button></div></div>`;
}

/* ---------- sheet (full-screen panel) ---------- */
function Sheet({ title, onClose, children, foot, id }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { const hd = el.querySelector("h2"); if (hd) hd.focus({ preventScroll: true }); }
  }, [id]);
  return html`<section class="sheet" ref=${ref} role="dialog" aria-modal="true" aria-label=${title}>
    <div class="sheet-head"><div class="wrap">
      ${onClose ? html`<button type="button" class="icon-btn" onClick=${onClose} aria-label=${t("back")}><${Icon} n="chevL" /></button>` : null}
      <h2 class="grow" tabindex="-1">${title}</h2>
    </div></div>
    <div class="sheet-body"><div class="wrap">${children}</div></div>
    ${foot ? html`<div class="sheet-foot"><div class="wrap">${foot}</div></div>` : null}
  </section>`;
}

/* ---------- copy helper with visible fallback ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t("copied")); return true; }
  catch (e) { set({ copyFallback: text }); return false; }
}
function CopyFallback() {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, [S.copyFallback]);
  if (!S.copyFallback) return null;
  return html`<div class="sheet" style="z-index:80"><div class="sheet-body"><div class="wrap stack">
    <p class="small muted">${t("copy_fail")}</p>
    <textarea ref=${ref} class="pre" style="width:100%;min-height:50vh" readonly value=${S.copyFallback}></textarea>
    <button type="button" class="btn primary" onClick=${() => set({ copyFallback: null })}>${t("close")}</button>
  </div></div></div>`;
}
async function download(filename, text, mime) {
  const r = await saveFile(filename, text, mime);
  if (r === "saved") toast(t("downloaded"));
  else if (r === "error") copyText(text);
}

/* ---------- in-view hook (test mode observes what the person looks at) ---------- */
function useInView(ref, onSeen, deps) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // "seen" = at least 35 % of the element or 140 px of it on screen (tall sections never reach 35 %)
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting && (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= 140)) onSeen(); }); }, { threshold: [0, 0.1, 0.2, 0.35, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, deps || []);
}
