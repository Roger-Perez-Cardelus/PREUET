/* ===== features.js ===== */
/* ---------- where am I: nearest AMB town from the phone's location (approximate town centres) ---------- */
const TOWN_POS = {
  "Badalona": [41.450, 2.247], "Badia del Vallès": [41.508, 2.116], "Barberà del Vallès": [41.515, 2.124], "Barcelona": [41.387, 2.170],
  "Begues": [41.331, 1.931], "Castellbisbal": [41.475, 1.982], "Castelldefels": [41.280, 1.977], "Cerdanyola del Vallès": [41.491, 2.141],
  "Cervelló": [41.396, 1.958], "Corbera de Llobregat": [41.418, 1.920], "Cornellà de Llobregat": [41.355, 2.070], "el Papiol": [41.440, 2.010],
  "el Prat de Llobregat": [41.326, 2.095], "Esplugues de Llobregat": [41.377, 2.088], "Gavà": [41.305, 2.001], "l'Hospitalet de Llobregat": [41.360, 2.100],
  "la Palma de Cervelló": [41.405, 1.974], "Molins de Rei": [41.414, 2.016], "Montcada i Reixac": [41.483, 2.187], "Montgat": [41.465, 2.280],
  "Pallejà": [41.424, 1.995], "Ripollet": [41.497, 2.157], "Sant Adrià de Besòs": [41.430, 2.219], "Sant Andreu de la Barca": [41.447, 1.971],
  "Sant Boi de Llobregat": [41.343, 2.036], "Sant Climent de Llobregat": [41.338, 1.997], "Sant Cugat del Vallès": [41.473, 2.085],
  "Sant Feliu de Llobregat": [41.381, 2.045], "Sant Joan Despí": [41.367, 2.057], "Sant Just Desvern": [41.383, 2.075],
  "Sant Vicenç dels Horts": [41.393, 2.007], "Santa Coloma de Cervelló": [41.366, 2.017], "Santa Coloma de Gramenet": [41.452, 2.208],
  "Tiana": [41.482, 2.268], "Torrelles de Llobregat": [41.357, 1.981], "Viladecans": [41.315, 2.014],
};
function kmBetween(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearestTown(pos) {
  let best = null;
  for (const [town, c] of Object.entries(TOWN_POS)) { const d = kmBetween(pos, c); if (!best || d < best.d) best = { town, d }; }
  return best && best.d <= 8 ? best.town : null;
}
function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(p => resolve([Math.round(p.coords.latitude * 1000) / 1000, Math.round(p.coords.longitude * 1000) / 1000]),
      reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60000 });
  });
}
async function useMyLocation() {
  try {
    const pos = await locate();
    const town = nearestTown(pos);
    updUser(town ? { loc: pos, town } : { loc: pos });
    toast(town ? t("geo_found", { town }) : t("geo_outside"));
    loadNearby(true);
  } catch (e) { toast(t("geo_failed")); }
}
function LocateButton({ small }) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return html`<button type="button" class=${"btn ghost" + (small ? " small" : "")} onClick=${useMyLocation}><${Icon} n="pin" s=${18} />${t("geo_use")}</button>`;
}

/* ---------- supermarkets near me (OpenStreetMap, through the Overpass API; asked from the phone, cached for a day) ---------- */
const CHAIN_RX = { mercadona: /mercadona/, lidl: /\blidl\b/, aldi: /\baldi\b/, carrefour: /carrefour/, dia: /^dia\b|\bdia\b|dia %/, bonpreu: /bonpreu|esclat/,
  ametller: /ametller/, consum: /\bconsum\b/, bonarea: /bon ?area/, caprabo: /caprabo/, condis: /condis/, sorli: /sorli/, spar: /\bspar\b/, suma: /\bsuma\b/ };
const LS_NEAR = "preuet:near:v1";
let NEAR = { key: null, stores: null, busy: false, failed: false };
function chainOfShop(tags) {
  const s = norm([tags.brand, tags.name, tags.operator].filter(Boolean).join(" "));
  for (const [cid, rx] of Object.entries(CHAIN_RX)) if (rx.test(s)) return cid;
  return null;
}
async function loadNearby(force) {
  const loc = S.user && S.user.loc;
  if (!loc) return null;
  const key = loc.join(",");
  if (!force && NEAR.key === key && (NEAR.stores || NEAR.busy)) return NEAR.stores;
  const saved = lsGet(LS_NEAR);
  if (!force && saved && saved.key === key && Date.now() - saved.at < DAY) { NEAR = { key, stores: saved.stores, busy: false, failed: false }; set({}); return NEAR.stores; }
  NEAR = { key, stores: NEAR.key === key ? NEAR.stores : null, busy: true, failed: false };
  const q = `[out:json][timeout:20];(nwr["shop"~"supermarket|convenience"](around:6000,${loc[0]},${loc[1]}););out center tags 400;`;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
    if (!r.ok) throw new Error("overpass " + r.status);
    const j = await r.json();
    const stores = [];
    for (const el of j.elements || []) {
      const tags = el.tags || {};
      const c = chainOfShop(tags);
      const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (!c || lat == null) continue;
      stores.push({ c, name: String(tags.name || X.C.get(c).name).slice(0, 60), street: String([tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ")).slice(0, 80),
        lat, lon, km: Math.round(kmBetween(loc, [lat, lon]) * 10) / 10 });
    }
    stores.sort((a, b) => a.km - b.km);
    NEAR = { key, stores, busy: false, failed: false };
    lsSet(LS_NEAR, { key, at: Date.now(), stores });
  } catch (e) {
    console.warn("nearby", e);
    NEAR = { key, stores: NEAR.stores, busy: false, failed: true };
  }
  MEMO.clear();
  set({});
  return NEAR.stores;
}
function nearestOf(cid) { return NEAR.stores ? NEAR.stores.find(s => s.c === cid) || null : null; }
/* chains with a shop within the chosen distance; null = no filter (no distance set, no location, or shops not loaded yet) */
function chainsInReach() {
  const u = S.user;
  if (!u.maxKm || !u.loc || !NEAR.stores || NEAR.key !== u.loc.join(",")) return null;
  return new Set(NEAR.stores.filter(s => s.km <= u.maxKm).map(s => s.c));
}
function mapsLink(s) { return "https://www.google.com/maps/search/?api=1&query=" + s.lat + "%2C" + s.lon; }
function DistanceOptions() {
  const u = S.user;
  useEffect(() => { if (u.loc) loadNearby(); }, [u.loc && u.loc.join(",")]);
  const reach = chainsInReach();
  return html`<div class="field"><span class="lab">${t("dist_label")}</span>
    ${u.loc ? html`<${Seg} label=${t("dist_label")} value=${u.maxKm || 0} onChange=${v => updUser({ maxKm: v || null })} options=${[{ v: 0, l: t("dist_any") }, { v: 1, l: "1 km" }, { v: 2, l: "2 km" }, { v: 5, l: "5 km" }]} />
      <span class="xs muted">${NEAR.busy ? t("near_loading") : NEAR.failed ? t("near_failed") : u.maxKm && reach ? t("dist_n", { n: reach.size, km: u.maxKm }) : t("dist_note")}</span>`
      : html`<p class="xs muted">${t("dist_need_loc")}</p><${LocateButton} small=${true} />`}
  </div>`;
}
function NearbyStores({ cid }) {
  const u = S.user;
  useEffect(() => { if (u.loc) loadNearby(); }, [u.loc && u.loc.join(",")]);
  if (!u.loc) return html`<section class="card stack-s"><h3>${t("near_title")}</h3><p class="small muted">${t("near_need_loc")}</p><${LocateButton} small=${true} /></section>`;
  const list = (NEAR.stores || []).filter(s => s.c === cid).slice(0, 5);
  return html`<section class="card stack-s"><h3>${t("near_title")}</h3>
    ${NEAR.busy && !NEAR.stores ? html`<p class="small muted">${t("near_loading")}</p>` : list.length ? html`<div>${list.map((s, i) => html`<a class="li" key=${i} href=${mapsLink(s)} target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">
      <span class="grow stack-s" style="gap:2px"><span class="t">${s.name}</span><span class="s">${s.street || t("near_no_address")}</span></span>
      <span class="num small">${fmtNum(s.km)} km</span><${Icon} n="ext" s=${14} /></a>`)}</div>`
      : html`<p class="small muted">${NEAR.failed ? t("near_failed") : t("near_none")}</p>`}
    <p class="xs faint">${t("near_note")}</p></section>`;
}

/* ---------- shopping list in aisle order, with ticks ---------- */
const AISLE = ["fruita", "fleca", "carn", "lactics", "rebost", "dietes", "begudes", "llar", "higiene"];
function ShopListSheet({ cid }) {
  const u = S.user;
  const ch = X.C.get(cid);
  const cmp = basketCompare();
  const row = cmp && cmp.rows.find(r => r.cid === cid);
  const ticked = u.ticked || {};
  const lines = u.basket.map((it, i) => ({ it, p: X.P.get(it.p), l: row ? row.lines[i] : null }));
  const groups = AISLE.concat(X.D.categories.map(c => c.id).filter(c => !AISLE.includes(c))).map(cat => ({ cat, items: lines.filter(x => x.p.cat === cat) })).filter(g => g.items.length);
  const left = lines.filter(x => !ticked[x.it.p]).length;
  const tick = pid => updUser({ ticked: Object.assign({}, ticked, { [pid]: !ticked[pid] }) });
  return html`<${Sheet} title=${t("shop_title", { chain: ch ? ch.name : "" })} onClose=${closeSheet} id="shoplist"
    foot=${html`<div class="row"><span class="grow small">${left ? t("shop_left", { n: left }) : t("shop_done")}</span>
      <button type="button" class="btn small ghost" onClick=${() => updUser({ ticked: {} })}>${t("shop_reset")}</button>
      ${left === 0 && row ? html`<button type="button" class="btn small primary" onClick=${() => replaceSheet({ type: "purchase", cid })}>${t("buy_done")}</button>` : null}</div>`}>
    <div class="stack">
      <p class="small muted">${t("shop_sub")}</p>
      ${groups.map(g => html`<section key=${g.cat} class="stack-s"><span class="eyebrow">${tl(X.CAT.get(g.cat))}</span>
        <div class="list">${g.items.map(({ it, p, l }) => html`<label class="li" key=${it.p} style="cursor:pointer">
          <input type="checkbox" checked=${!!ticked[it.p]} onChange=${() => tick(it.p)} style="width:22px;height:22px;flex:none" />
          <${ProductThumb} p=${p} size=${40} />
          <span class="grow stack-s" style="gap:2px;min-width:0"><span class="t" style=${ticked[it.p] ? "text-decoration:line-through;color:var(--ink-3)" : ""}>${it.n} × ${tl(p)}</span>
            <span class="s">${l ? l.o.name + " · " + packText(l, p) : t("no_price_here", { chain: ch ? ch.name : "" })}</span></span>
          <span class="num small">${l ? eur(l.cost) : "—"}</span></label>`)}</div></section>`)}
    </div><//>`;
}

/* ---------- share the basket as a link ---------- */
function basketLink(items) {
  const base = location.href.split("#")[0];
  return base + "#c=" + items.map(x => x.p + "*" + x.n).join(",");
}
function parseBasketHash(h) {
  const m = /^#?c=(.+)$/.exec(h || "");
  if (!m) return null;
  const items = decodeURIComponent(m[1]).split(",").map(s => { const [p, n] = s.split("*"); return { p, n: clamp(Math.round(Number(n) || 1), 1, 99) }; }).filter(x => X.P.has(x.p));
  return items.length ? items.slice(0, 80) : null;
}
async function shareBasket(items) {
  const url = basketLink(items);
  const text = t("share_text", { n: items.length });
  if (navigator.share) { try { await navigator.share({ title: "Preuet", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  copyText(url);
}
function openSharedBasket() {
  const items = parseBasketHash(location.hash);
  if (!items) return false;
  try { history.replaceState(null, "", "#cistella"); } catch (e) { /* ignore */ }
  if (S.user.basket.length) openSheet({ type: "merge", items, name: t("shared_basket") });
  else { mergeItems(items, true); toast(t("template_loaded", { name: t("shared_basket") })); go("cistella"); }
  return true;
}

/* ---------- products I follow: their offers on the home screen, and a notice when new ones arrive ---------- */
function isWatched(pid) { return (S.user.watch || []).includes(pid); }
function toggleWatch(pid) {
  const w = S.user.watch || [];
  updUser({ watch: w.includes(pid) ? w.filter(x => x !== pid) : w.concat([pid]).slice(-60) });
  toast(w.includes(pid) ? t("watch_off") : t("watch_on"));
}
function watchedOffers() {
  const w = new Set(S.user.watch || []);
  const today = isoToday();
  return X.D.offers.filter(o => o.p && w.has(o.p) && offerStatus(o, today) !== "ended");
}
function WatchButton({ pid }) {
  const on = isWatched(pid);
  return html`<button type="button" class=${"btn small " + (on ? "primary" : "ghost")} aria-pressed=${String(on)} onClick=${() => toggleWatch(pid)}>
    <${Icon} n="star" s=${16} fill=${on} />${on ? t("watching") : t("watch")}</button>`;
}
function WatchedOffers() {
  const list = watchedOffers();
  if (!(S.user.watch || []).length) return null;
  return html`<section><div class="section-h"><div class="grow"><h2>${t("watch_title")}</h2><p class="small muted">${t("watch_sub", { n: S.user.watch.length })}</p></div></div>
    ${list.length ? html`<div class="stack">${list.slice(0, 4).map((o, i) => html`<${OfferCard} key=${i} o=${o} />`)}</div>` : html`<p class="small muted">${t("watch_none")}</p>`}
    ${typeof Notification !== "undefined" && Notification.permission === "default" ? html`<button type="button" class="link-btn" onClick=${() => Notification.requestPermission().then(() => set({}))}>${t("watch_notify")}</button>` : null}
  </section>`;
}
/* called when the app opens with data it has not shown this person yet */
function announceWatched() {
  const u = S.user;
  if (!u || u.seenData === X.D.meta.updated) return;
  const first = !u.seenData;
  updUser({ seenData: X.D.meta.updated });
  if (first) return;
  const n = watchedOffers().length;
  if (!n) return;
  toast(t("watch_new", { n }));
  try { if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification("Preuet", { body: t("watch_new", { n }), icon: "icons/icon-192.png" }); } catch (e) { /* ignore */ }
}

/* ---------- barcode: camera (where the browser can read barcodes) or typed number → Open Food Facts name → Preuet products ---------- */
async function productByEan(ean) {
  const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(ean) + ".json?fields=product_name,product_name_es,product_name_ca,generic_name,brands,quantity");
  if (!r.ok) return null;
  const j = await r.json();
  const p = j && j.product;
  if (!p) return null;
  return { name: p.product_name_ca || p.product_name_es || p.product_name || p.generic_name || "", brand: p.brands || "", qty: p.quantity || "" };
}
function matchByName(name) {
  const words = norm(name).split(" ").filter(w => w.length > 2 && !/^\d/.test(w));
  for (let k = Math.min(3, words.length); k >= 1; k--) {
    for (let i = 0; i + k <= words.length; i++) { const r = searchProducts(words.slice(i, i + k).join(" ")); if (r.length) return r.slice(0, 6); }
  }
  return [];
}
function ScanSheet() {
  const video = useRef(null);
  const [st, setSt] = useState({ phase: "idle", ean: "", info: null, res: [] });
  const [typed, setTyped] = useState("");
  const canCam = typeof window !== "undefined" && "BarcodeDetector" in window && navigator.mediaDevices;
  const look = async ean => {
    setSt({ phase: "look", ean, info: null, res: [] });
    try {
      const info = await productByEan(ean);
      setSt({ phase: "done", ean, info, res: info ? matchByName(info.name + " " + info.qty) : [] });
    } catch (e) { setSt({ phase: "error", ean, info: null, res: [] }); }
  };
  useEffect(() => {
    if (!canCam) return undefined;
    let stream = null, stop = false, iv = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop) return;
        video.current.srcObject = stream; await video.current.play();
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        iv = setInterval(async () => {
          try { const c = await det.detect(video.current); if (c.length) { clearInterval(iv); stream.getTracks().forEach(t_ => t_.stop()); look(c[0].rawValue); } } catch (e) { /* keep trying */ }
        }, 350);
      } catch (e) { setSt(s => Object.assign({}, s, { phase: "nocam" })); }
    })();
    return () => { stop = true; clearInterval(iv); if (stream) stream.getTracks().forEach(t_ => t_.stop()); };
  }, []);
  return html`<${Sheet} title=${t("scan_title")} onClose=${closeSheet} id="scan">
    <div class="stack">
      ${canCam && st.phase === "idle" ? html`<video ref=${video} playsinline muted style="width:100%;border-radius:14px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><p class="small muted">${t("scan_aim")}</p>` : null}
      ${!canCam || st.phase === "nocam" ? html`<p class="small muted">${t("scan_nocam")}</p>` : null}
      <form class="row" onSubmit=${e => { e.preventDefault(); const v = typed.replace(/\D/g, ""); if (v.length >= 8) look(v); }}>
        <div class="field grow"><label for="ean-in">${t("scan_type")}</label><input id="ean-in" type="text" inputmode="numeric" autocomplete="off" value=${typed} placeholder="8410000000000" onInput=${e => setTyped(e.currentTarget.value)} /></div>
        <button type="submit" class="btn small primary" style="align-self:flex-end" disabled=${typed.replace(/\D/g, "").length < 8}>${t("scan_search")}</button>
      </form>
      ${st.phase === "look" ? html`<p class="small muted">${t("scan_looking", { ean: st.ean })}</p>` : null}
      ${st.phase === "error" ? html`<p class="small" role="alert">${t("scan_error")}</p>` : null}
      ${st.phase === "done" ? html`<div class="stack-s">
        <p class="small">${st.info ? html`<b>${st.info.name || st.ean}</b>${st.info.brand ? " · " + st.info.brand : ""}${st.info.qty ? " · " + st.info.qty : ""}` : t("scan_unknown", { ean: st.ean })}</p>
        ${st.res.length ? html`<span class="xs muted">${t("scan_matches")}</span><div class="list">${st.res.map(p => html`<${ProductRow} key=${p.id} p=${p} />`)}</div>`
          : html`<${SearchResults} res=${[]} q=${(st.info && st.info.name) || st.ean} />`}
      </div>` : null}
      <p class="xs faint">${t("scan_note")}</p>
    </div><//>`;
}

/* ---------- purchases: what you actually paid, and what you saved ---------- */
function PurchaseSheet({ cid }) {
  const cmp = basketCompare();
  const row = cmp && cmp.rows.find(r => r.cid === cid);
  const [paid, setPaid] = useState("");
  if (!row) return null;
  const worst = cmp.worst && cmp.worst !== row ? cmp.key(cmp.worst) : null;
  const pv = Number(String(paid).replace(",", "."));
  const save = () => {
    const rec = { id: uid(), date: isoToday(), cid, n: S.user.basket.length, k: row.k, est: Math.round(row.total * 100) / 100,
      worst: worst != null ? Math.round(worst * 100) / 100 : null, worstCid: worst != null ? cmp.worst.cid : null, paid: pv > 0 && pv < 2000 ? Math.round(pv * 100) / 100 : null };
    updUser(u => ({ purchases: (u.purchases || []).concat([rec]).slice(-200), ticked: {} }));
    emit("purchase", rec);
    toast(t("buy_saved"));
    replaceSheet({ type: "savings" });
  };
  return html`<${Sheet} title=${t("buy_title")} onClose=${closeSheet} id="purchase"
    foot=${html`<button type="button" class="btn primary block" onClick=${save}><${Icon} n="check" />${t("buy_save")}</button>`}>
    <div class="stack">
      <div class="card row"><${ChainBadge} cid=${cid} strong=${true} /><span class="grow"></span><span class="stack-s" style="align-items:flex-end"><span class="xs muted">${t("buy_est")}</span><${PriceTag} v=${row.total} /></span></div>
      <p class="small muted">${t("buy_sub", { k: row.k, n: row.n })}</p>
      <div class="field"><label for="paid-in">${t("buy_paid")}</label><input id="paid-in" type="text" inputmode="decimal" placeholder=${num2(row.total)} value=${paid} onInput=${e => setPaid(e.currentTarget.value)} />
        <span class="xs muted">${t("buy_paid_note")}</span></div>
      ${pv > 0 ? html`<p class="small">${t("buy_diff", { d: eur(pv - row.total), p: pct(Math.abs(pv - row.total) / row.total * 100) })}</p>` : null}
    </div><//>`;
}
function savingsStats(list) {
  const month = isoToday().slice(0, 7);
  const saveOf = p => (p.worst != null ? p.worst - (p.paid != null ? p.paid : p.est) : 0);
  const inMonth = list.filter(p => p.date.slice(0, 7) === month);
  const checked = list.filter(p => p.paid != null && p.est > 0);
  return {
    month: sum(inMonth.map(saveOf)), total: sum(list.map(saveOf)), nMonth: inMonth.length,
    acc: checked.length ? sum(checked.map(p => Math.abs(p.paid - p.est) / p.est)) / checked.length * 100 : null, nChecked: checked.length,
    bias: checked.length ? sum(checked.map(p => (p.paid - p.est) / p.est)) / checked.length * 100 : null, saveOf,
  };
}
function purchasesCsv(list) {
  const head = ["data", "supermercat", "productes", "amb_preu", "estimat_preuet", "pagat_tiquet", "diferencia_pct", "mes_car", "import_mes_car", "estalvi"];
  const st = savingsStats(list);
  const rows = list.map(p => [p.date, p.cid, p.n, p.k, p.est, p.paid == null ? "" : p.paid, p.paid == null ? "" : Math.round((p.paid - p.est) / p.est * 1000) / 10, p.worstCid || "", p.worst == null ? "" : p.worst, Math.round(st.saveOf(p) * 100) / 100]);
  return [head].concat(rows).map(r => r.join(",")).join("\n") + "\n";
}
function SavingsSheet() {
  const list = (S.user.purchases || []).slice().reverse();
  const st = savingsStats(list);
  return html`<${Sheet} title=${t("sav_title")} onClose=${closeSheet} id="savings">
    <div class="stack-l">
      ${list.length ? html`
        <div class="card raised stack-s"><span class="eyebrow">${t("sav_month")}</span><span style="font-size:var(--t-2xl);font-weight:800">${eur(st.month)}</span>
          <span class="small muted">${t("sav_month_sub", { n: st.nMonth, total: eur(st.total) })}</span></div>
        ${st.acc != null ? html`<div class="card stack-s"><span class="eyebrow">${t("sav_acc")}</span>
          <span><b>${t("sav_acc_v", { p: fmtNum(Math.round(st.acc * 10) / 10) })}</b> · ${t("sav_bias", { p: (st.bias > 0 ? "+" : "") + fmtNum(Math.round(st.bias * 10) / 10) })}</span>
          <span class="xs muted">${t("sav_acc_sub", { n: st.nChecked })}</span></div>` : html`<p class="small muted">${t("sav_acc_none")}</p>`}
        <div class="list">${list.map(p => html`<div class="li" key=${p.id}><span class="grow stack-s" style="gap:2px"><${ChainBadge} cid=${p.cid} /><span class="s">${fmtDL(p.date)} · ${t("n_products", { n: p.n })}${p.paid != null ? " · " + t("sav_paid", { p: eur(p.paid) }) : ""}</span></span>
          <span class="stack-s" style="align-items:flex-end;gap:2px"><span class="num small">${eur(p.paid != null ? p.paid : p.est)}</span>${p.worst != null ? html`<span class="xs" style="color:var(--good)">−${eur(st.saveOf(p))}</span>` : null}</span>
          <button type="button" class="icon-btn" style="width:32px;height:32px" aria-label=${t("del")} onClick=${() => updUser(u => ({ purchases: (u.purchases || []).filter(x => x.id !== p.id) }))}><${Icon} n="trash" s=${16} /></button></div>`)}</div>
        <div class="row wrap-ok">${canDownload() ? html`<button type="button" class="btn small ghost" onClick=${() => download("preuet-compres-" + isoToday() + ".csv", purchasesCsv(list), "text/csv")}><${Icon} n="download" s=${16} />CSV</button>` : null}
          <button type="button" class="btn small ghost" onClick=${() => copyText(purchasesCsv(list))}><${Icon} n="copy" s=${16} />CSV</button></div>
        <p class="xs faint">${t("sav_note")}</p>`
      : html`<${Empty} title=${t("sav_empty")} sub=${t("sav_empty_s")} />`}
    </div><//>`;
}
