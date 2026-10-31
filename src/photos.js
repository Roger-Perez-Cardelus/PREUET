/* ===== photos.js ===== */
/* ---------- product photos (img/products: 640×480 and a 160×160 thumbnail, from Wikimedia Commons with author and licence;
   see tools/fetch_images.py). Without a photo, the category icon. ---------- */
function ProductThumb({ p, size }) {
  const s = size || 48;
  const cat = X.CAT.get(p.cat);
  const box = { width: s + "px", height: s + "px", flex: "none", borderRadius: Math.round(s / 4) + "px", overflow: "hidden", background: "var(--plum-soft)", display: "grid", placeItems: "center", color: "var(--plum)" };
  if (p.img && p.img.f) return html`<span style=${p.img.n ? Object.assign({}, box, { background: "#fff", border: "1px solid var(--line)" }) : box}><img src=${s <= 80 && p.img.t ? p.img.t : p.img.f} alt="" loading="lazy" decoding="async" width=${s} height=${s} style=${"width:100%;height:100%;object-fit:" + (p.img.n ? "contain" : "cover")} /></span>`;
  return html`<span style=${box} aria-hidden="true"><${Icon} n=${"cat_" + (cat ? cat.id : "rebost")} s=${Math.round(s * 0.55)} /></span>`;
}
function ProductPhoto({ p }) {
  if (!p.img || !p.img.f) return null;
  const pack = !!p.img.n; // a real pack from Open Food Facts, not a generic photo
  const ch = pack && X.C.get(p.img.c);
  return html`<figure style="margin:0" class="stack-s">
    <img src=${p.img.f} alt=${pack ? p.img.n : tl(p)} decoding="async" style=${"width:100%;max-height:240px;border-radius:16px;" + (pack ? "object-fit:contain;background:#fff" : "object-fit:cover;background:var(--plum-soft)")} />
    <figcaption class="xs faint">${pack ? t("photo_pack", { name: p.img.n, chain: ch ? ch.name : "" }) + " · " : ""}${t("photo_credit", { a: p.img.a || "?", l: p.img.l || "" })}${p.img.s ? html` · <a href=${p.img.s} target="_blank" rel="noopener noreferrer">${pack ? "Open Food Facts" : "Wikimedia Commons"} ↗</a>` : null}${pack ? "" : " · " + t("photo_note")}</figcaption>
  </figure>`;
}
/* the photo of one supermarket's own pack, next to its price */
function PackThumb({ o }) {
  if (!o || !o.img || !o.img.t) return null;
  return html`<span style="width:44px;height:44px;flex:none;border-radius:10px;overflow:hidden;background:#fff;border:1px solid var(--line);display:grid;place-items:center">
    <img src=${o.img.t} alt="" loading="lazy" decoding="async" width="44" height="44" style="width:100%;height:100%;object-fit:contain" /></span>`;
}
