/* ===== photos.js ===== */
/* ---------- product photos (img/products: 640×480 and a 160×160 thumbnail, from Wikimedia Commons with author and licence;
   see tools/fetch_images.py). Without a photo, the category icon. ---------- */
function ProductThumb({ p, size }) {
  const s = size || 48;
  const cat = X.CAT.get(p.cat);
  const box = { width: s + "px", height: s + "px", flex: "none", borderRadius: Math.round(s / 4) + "px", overflow: "hidden", background: "var(--plum-soft)", display: "grid", placeItems: "center", color: "var(--plum)" };
  if (p.img && p.img.f) return html`<span style=${box}><img src=${s <= 80 && p.img.t ? p.img.t : p.img.f} alt="" loading="lazy" decoding="async" width=${s} height=${s} style="width:100%;height:100%;object-fit:cover" /></span>`;
  return html`<span style=${box} aria-hidden="true"><${Icon} n=${"cat_" + (cat ? cat.id : "rebost")} s=${Math.round(s * 0.55)} /></span>`;
}
function ProductPhoto({ p }) {
  if (!p.img || !p.img.f) return null;
  return html`<figure style="margin:0" class="stack-s">
    <img src=${p.img.f} alt=${tl(p)} decoding="async" style="width:100%;max-height:240px;object-fit:cover;border-radius:16px;background:var(--plum-soft)" />
    <figcaption class="xs faint">${t("photo_credit", { a: p.img.a || "?", l: p.img.l || "" })}${p.img.s ? html` · <a href=${p.img.s} target="_blank" rel="noopener noreferrer">Wikimedia Commons ↗</a>` : null} · ${t("photo_note")}</figcaption>
  </figure>`;
}
