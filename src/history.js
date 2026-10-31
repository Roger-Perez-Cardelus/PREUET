/* ===== history.js ===== */
/* ---------- price history (data/history.json: cheapest price per kilo or litre, per product and chain, each week) ---------- */
let HIST = null, HIST_P = null;
function loadHistory() {
  if (!HIST_P) HIST_P = fetch("data/history.json").then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(h => { HIST = h && h.s ? h : { dates: [], s: {} }; set({}); return HIST; });
  return HIST_P;
}
function PriceHistory({ p }) {
  useEffect(() => { loadHistory(); }, []);
  if (!HIST) return null;
  const series = X.D.chains.map(c => ({ c, pts: HIST.s[p.id + "|" + c.id] || [] })).filter(x => x.pts.length);
  if (!series.length) return null;
  const long = series.filter(x => x.pts.length > 1);
  const dates = [...new Set(series.flatMap(x => x.pts.map(r => r[0])))].sort();
  let low = null;
  for (const x of series) for (const [d, up] of x.pts) if (!low || up < low.up) low = { up, d, c: x.c };
  const head = html`<div class="row"><h3 class="grow">${t("hist_title")}</h3><span class="xs muted">${t("hist_since", { d: fmtDL(dates[0]) })}</span></div>`;
  if (!long.length || dates.length < 2) return html`<section class="card stack-s">${head}<p class="small muted">${t("hist_few")}</p></section>`;
  const W = 320, H = 130, L = 8, R = 8, T = 10, B = 22;
  const ups = long.flatMap(x => x.pts.map(r => r[1]));
  const lo = Math.min(...ups), hi = Math.max(...ups), span = hi - lo || hi * 0.1 || 1;
  const xOf = d => L + (W - L - R) * (dates.indexOf(d) / (dates.length - 1));
  const yOf = v => T + (H - T - B) * (1 - (v - (lo - span * 0.1)) / (span * 1.2));
  const label = x => x.c.name + ": " + x.pts.map(([d, v]) => fmtD(d) + " " + eurU(v, p.unit)).join(", ");
  return html`<section class="card stack-s">
    ${head}
    <svg viewBox=${"0 0 " + W + " " + H} width="100%" role="img" aria-label=${t("hist_title") + ". " + long.map(label).join(". ")}>
      <line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} stroke="var(--line)" />
      ${dates.map((d, i) => (i === 0 || i === dates.length - 1 || dates.length <= 6) ? html`<text key=${d} x=${xOf(d)} y=${H - 6} font-size="10" fill="var(--ink-3)" text-anchor=${i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}>${fmtD(d)}</text>` : null)}
      ${long.map(x => html`<g key=${x.c.id}>
        <polyline fill="none" stroke=${x.c.color} stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points=${x.pts.map(([d, v]) => xOf(d) + "," + yOf(v)).join(" ")} />
        ${x.pts.map(([d, v]) => html`<circle key=${d} cx=${xOf(d)} cy=${yOf(v)} r="2.6" fill=${x.c.color} />`)}</g>`)}
    </svg>
    <div class="chips">${long.map(x => { const a = x.pts[0][1], b = x.pts[x.pts.length - 1][1], ch = (b - a) / a * 100;
      return html`<span class="chip outline" key=${x.c.id}><i style=${{ width: "10px", height: "10px", borderRadius: "50%", background: x.c.color, display: "inline-block" }}></i>${x.c.name} ${Math.abs(ch) < 0.5 ? "=" : (ch > 0 ? "+" : "−") + Math.abs(Math.round(ch)) + " %"}</span>`; })}</div>
    ${low ? html`<p class="xs muted">${t("hist_low", { p: eurU(low.up, p.unit), chain: low.c.name, d: fmtDL(low.d) })}</p>` : null}
  </section>`;
}
