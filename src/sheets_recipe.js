/* ===== sheets_recipe.js ===== */
/* ---------- recipe sheet ---------- */
function RecipeSheet({ id }) {
  const r = X.R.get(id);
  const [serv, setServ] = useState(r ? r.serv : 2);
  const [cid, setCid] = useState(S.user.recipeChain || "");
  const [have, setHave] = useState(() => new Set(r ? r.ing.map(([pid]) => pid).filter(pid => PANTRY.has(pid)) : []));
  if (!r) return null;
  const opt = OPT();
  const chains = activeChains();
  const best = recipeBest(r, chains, opt, serv);
  const rc = cid ? recipeAt(r, cid, opt, serv) : best;
  const st = stockMap();
  const diet = recipeDiet(r);
  const al = recipeAllergens(r);
  const packs = sum(rc.lines.map(l => { const at = l.pc ? (rc.cid || l.pc.cid) : null; if (!at || have.has(l.pid)) return 0; const p = X.P.get(l.pid); const it = itemAt(l.pid, Math.max(1, Math.ceil(l.q / p.ref - 0.05)), at, opt); return it ? it.cost : 0; }));
  const toAdd = r.ing.filter(([pid]) => !have.has(pid));
  const addAll = () => {
    const items = toAdd.map(([pid, q0]) => { const p = X.P.get(pid); const q = q0 * serv / r.serv; return { p: pid, n: Math.max(1, Math.ceil(q / p.ref - 0.05)) }; });
    mergeItems(items, false);
    toast(t("added_n", { n: items.length }));
    emit("recipe:add", { id, n: items.length, per: rc.per });
  };
  const foot = html`<button type="button" class="btn primary block" disabled=${!toAdd.length} onClick=${addAll}><${Icon} n="basket" />${t("add_ingredients")} (${toAdd.length})</button>`;
  return html`<${Sheet} title=${tl(r)} onClose=${closeSheet} foot=${foot} id=${id}>
    <div class="stack-l">
      <div class="ph stack-s"><h1>${tl(r)}</h1>
        <div class="chips"><span class="chip"><${Icon} n="clock" s=${13} />${t("minutes", { n: r.mins })}</span>
          ${diet.vg ? html`<span class="chip good">${t("tag_vg")}</span>` : diet.vt ? html`<span class="chip good">${t("tag_vt")}</span>` : null}
          ${diet.sg ? html`<span class="chip good">${t("tag_sg")}</span>` : null}
          ${al.map(a => html`<span key=${a} class=${"chip " + (S.user.avoid.includes(a) ? "bad" : "warn")}>${t("al_" + a)}</span>`)}</div></div>
      <div class="card raised row">
        <div class="grow stack-s"><span class="eyebrow">${t("used_cost")}</span><span class="small muted">${rc.cid ? t("best_at", { chain: X.C.get(rc.cid).name }) : t("mix_chains")}${rc.miss ? " · " + t("recipe_missing", { n: rc.miss }) : ""}</span>
          <span class="xs muted">${t("packs_cost")}: ${eur(packs)}</span></div>
        <span class="stack-s" style="align-items:flex-end"><${PriceTag} v=${rc.per} lg=${true} sub=${LANG === "es" ? "/ración" : "/ració"} /><span class="xs muted">${eur(rc.cost)} · ${t("servings", { n: serv })}</span></span>
      </div>
      <div class="row"><span class="grow small" style="font-weight:700">${t("servings", { n: serv })}</span><${Stepper} value=${serv} min=${1} onChange=${v => setServ(Math.max(1, v))} label=${t("servings", { n: serv })} /></div>
      <div class="field"><span class="lab">${t("buy_at")}</span>
        <div class="filters"><button type="button" class="filter" aria-pressed=${String(!cid)} onClick=${() => { setCid(""); updUser({ recipeChain: null }); }}>${t("best_option")}</button>
          ${chains.map(c => html`<button type="button" key=${c} class="filter" aria-pressed=${String(cid === c)} onClick=${() => { setCid(c); updUser({ recipeChain: c }); }}>${X.C.get(c).name}</button>`)}</div></div>
      <section><div class="section-h"><h2 class="grow">${t("ingredients")}</h2></div>
        <div class="list">${rc.lines.map(l => {
          const p = X.P.get(l.pid);
          const at = l.pc ? (rc.cid || l.pc.cid) : null;
          const s = at ? st.get(l.pid + "|" + at) : null;
          return html`<div class="li" key=${l.pid}>
            <label class="check" style="flex:none" title=${t("have_home")}><input type="checkbox" checked=${have.has(l.pid)} onChange=${e => { const n = new Set(have); if (e.currentTarget.checked) n.add(l.pid); else n.delete(l.pid); setHave(n); }} aria-label=${t("have_home") + ": " + tl(p)} /></label>
            <button type="button" class="grow" style="text-align:left;background:none;border:0;padding:0;min-width:0" onClick=${() => openSheet({ type: "product", id: l.pid })}>
              <div class="t" style=${have.has(l.pid) ? "text-decoration:line-through;color:var(--ink-3)" : ""}>${tl(p)}</div>
              <div class="s">${fmtQty(l.q, p.unit)}${l.pc && !rc.cid ? " · " + X.C.get(l.pc.cid).name : ""}${have.has(l.pid) ? " · " + t("have_home") : ""}</div>
              ${s && s.s === "no" ? html`<div class="xs" style="color:var(--bad);font-weight:700">${t("stock_warn", { chain: X.C.get(at).name, ago: ago(s.ts) })}</div>` : null}
            </button>
            <span class="num small">${l.pc ? eur(l.pc.cost) : "—"}</span>
          </div>`;
        })}</div></section>
      <section class="stack-s"><div class="section-h"><h2 class="grow">${t("steps")}</h2></div>
        <ol class="stack-s" style="margin:0;padding-left:1.3em">${(r["steps_" + LANG] || r.steps_ca).map((x, i) => html`<li key=${i}>${x}</li>`)}</ol></section>
      <${CommentsBlock} target=${"r:" + id} />
    </div>
  <//>`;
}
