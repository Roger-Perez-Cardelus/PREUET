/* ===== sheets_info.js ===== */
/* ---------- method & about ---------- */
const METHOD = {
  ca: [
    ["D'on surten els preus", ["Els preus es recullen de les botigues en línia oficials (Bonpreu, Ametller Origen, Dia, Carrefour, Consum, bonÀrea), de comparadors públics que segueixen preus de supermercats (supersupers.com i radarsuper.com, per a Mercadona i Lidl), del fullet en PDF de Lidl i de la pàgina de promocions de Caprabo.", "Cada preu guarda la data, la font i l'enllaç. Condis, Sorli, Spar i Suma no publiquen preus en línia llegibles: s'omplen amb preus aportats per la comunitat.", "Els preus de la web poden diferir dels de la botiga física. El preu vàlid és sempre el de la botiga."]],
    ["Com comparem una cistella", ["Cada producte de Preuet és una classe de productes equivalents (per exemple, «llet semidesnatada 1 L» de qualsevol marca). Per a cada supermercat agafem l'opció més barata que compleix el filtre de marca (la més barata, marca blanca o marca de fabricant).", "El total és el que pagues a caixa: paquets sencers. Si necessites 2 L i el paquet és d'1 L, en compres 2; si només hi ha ampolles d'1,5 L, pagues l'ampolla sencera. Quan surt més a compte, combinem dos formats (per exemple, un pack de 6 i una ampolla). La fruita i la verdura a granel es paguen al pes; les safates, bosses i malles, per paquet.", "Si un supermercat no té preu d'un producte, pots estimar-lo: preu mínim d'aquell producte entre supermercats × índex de preus del supermercat. Les estimacions es marquen sempre i només es fan servir si el supermercat té preu almenys del 60 % de la cistella."]],
    ["Índex de preus i qualitat-preu", ["Índex de la cistella = 100 × (cost de la cistella al supermercat) / (cost mínim dels mateixos productes). L'índex general compara marca blanca i producte fresc: és la mitjana geomètrica de la ràtio de cada producte (limitada a 2) per a tots els productes amb preu a dues cadenes o més.", "Puntuació de preu = 100 × 100 / índex. Qualitat = satisfacció de l'enquesta OCU de 2026 (0–100), barrejada amb les valoracions de la comunitat (fins a un 30 % de pes, segons el nombre de valoracions).", "Qualitat-preu = pes × preu + (1 − pes) × qualitat. El pes el tries tu amb el control."]],
    ["Semàfor nutricional i al·lèrgens", ["Els valors nutricionals són de referència per a un producte típic de cada classe. El semàfor fa servir els llindars de l'Agència d'Estàndards Alimentaris del Regne Unit (FSA) per 100 g (begudes, per 100 ml).", "Els al·lèrgens segueixen els 14 de declaració obligatòria a la UE. Comprova sempre l'etiqueta de la marca concreta."]],
    ["Límits", ["Lidl va deixar de publicar preus en línia el juny de 2026 i d'Aldi només hi ha el fullet en imatge: tenim pocs productes seus i alguns són antics (es marquen).", "Les cadenes amb poques dades no entren al rànquing de la cistella si no arriben al 60 % dels productes.", "L'estoc depèn dels avisos dels usuaris: no és un inventari de la botiga."]],
  ],
  es: [
    ["De dónde salen los precios", ["Los precios se recogen de las tiendas online oficiales (Bonpreu, Ametller Origen, Dia, Carrefour, Consum, bonÀrea), de comparadores públicos que siguen precios de supermercados (supersupers.com y radarsuper.com, para Mercadona y Lidl), del folleto en PDF de Lidl y de la página de promociones de Caprabo.", "Cada precio guarda la fecha, la fuente y el enlace. Condis, Sorli, Spar y Suma no publican precios online legibles: se rellenan con precios aportados por la comunidad.", "Los precios de la web pueden diferir de los de la tienda física. El precio válido es siempre el de la tienda."]],
    ["Cómo comparamos una cesta", ["Cada producto de Preuet es una clase de productos equivalentes (por ejemplo, «leche semidesnatada 1 L» de cualquier marca). Para cada supermercado tomamos la opción más barata que cumple el filtro de marca (la más barata, marca blanca o marca de fabricante).", "El total es lo que pagas en caja: paquetes enteros. Si necesitas 2 L y el paquete es de 1 L, compras 2; si solo hay botellas de 1,5 L, pagas la botella entera. Cuando sale más a cuenta, combinamos dos formatos (por ejemplo, un pack de 6 y una botella). La fruta y la verdura a granel se pagan al peso; las bandejas, bolsas y mallas, por paquete.", "Si un supermercado no tiene precio de un producto, puedes estimarlo: precio mínimo de ese producto entre supermercados × índice de precios del supermercado. Las estimaciones se marcan siempre y solo se usan si el supermercado tiene precio de al menos el 60 % de la cesta."]],
    ["Índice de precios y calidad-precio", ["Índice de la cesta = 100 × (coste de la cesta en el supermercado) / (coste mínimo de los mismos productos). El índice general compara marca blanca y producto fresco: es la media geométrica de la ratio de cada producto (limitada a 2) para todos los productos con precio en dos cadenas o más.", "Puntuación de precio = 100 × 100 / índice. Calidad = satisfacción de la encuesta OCU de 2026 (0–100), mezclada con las valoraciones de la comunidad (hasta un 30 % de peso, según el número de valoraciones).", "Calidad-precio = peso × precio + (1 − peso) × calidad. El peso lo eliges tú con el control."]],
    ["Semáforo nutricional y alérgenos", ["Los valores nutricionales son de referencia para un producto típico de cada clase. El semáforo usa los umbrales de la Agencia de Normas Alimentarias del Reino Unido (FSA) por 100 g (bebidas, por 100 ml).", "Los alérgenos siguen los 14 de declaración obligatoria en la UE. Comprueba siempre la etiqueta de la marca concreta."]],
    ["Límites", ["Lidl dejó de publicar precios online en junio de 2026 y de Aldi solo hay el folleto en imagen: tenemos pocos productos suyos y algunos son antiguos (se marcan).", "Las cadenas con pocos datos no entran en el ranking de la cesta si no llegan al 60 % de los productos.", "El stock depende de los avisos de los usuarios: no es un inventario de la tienda."]],
  ],
};
function MethodSheet() {
  const by = new Map();
  for (const s of X.D.sources) { if (!by.has(s.c)) by.set(s.c, []); by.get(s.c).push(s); }
  return html`<${Sheet} title=${t("method")} onClose=${closeSheet} id="method">
    <div class="prose">
      ${METHOD[LANG].map(([h, ps]) => html`<section class="stack-s" key=${h}><h3>${h}</h3>${ps.map((p, i) => html`<p class="small" key=${i}>${p}</p>`)}</section>`)}
      <section class="stack-s"><h3>${t("sources")}</h3>
        <p class="small"><a href=${X.D.meta.ocu_survey} target="_blank" rel="noopener noreferrer">OCU · Enquesta de satisfacció amb els supermercats 2026 ↗</a></p>
        ${[...by.entries()].map(([c, list]) => html`<details key=${c}><summary class="small" style="cursor:pointer"><b>${X.C.get(c).name}</b> · ${list.length}</summary>
          <ul class="xs" style="overflow-wrap:anywhere">${list.map((s, i) => html`<li key=${i}><a href=${s.url} target="_blank" rel="noopener noreferrer">${s.url.replace(/^https?:\/\//, "").slice(0, 90)}</a></li>`)}</ul></details>`)}
      </section>
    </div><//>`;
}
function AboutSheet() {
  return html`<${Sheet} title=${t("about")} onClose=${closeSheet} id="about">
    <div class="prose">
      <div class="row"><span style="width:44px;height:44px;color:var(--ink)"><${Logo} /></span><div><b style="font-family:var(--f-display);font-size:var(--t-lg)">Preuet</b><p class="small muted">${t("app_tagline")}</p></div></div>
      <p>${t("about_body")}</p>
      <p class="small muted">${t("about_version", { v: "V1", d: fmtDL(X.D.meta.updated) })} · ${X.D.meta.n_prices} preus · ${X.D.meta.n_products} productes</p>
      <p class="small">${t("ai_note")}</p>
      <p class="small">${t("disclaimer")}</p>
      <section class="stack-s"><h3>${t("privacy_t")}</h3>${t("privacy_body").split("\n").map((x, i) => html`<p class="small" key=${i}>${x}</p>`)}</section>
      <dl class="kv"><dt>${t("storage_mode")}</dt><dd>${t("mode_" + Store.mode)}</dd></dl>
    </div><//>`;
}

/* ---------- onboarding ---------- */
function Onboarding() {
  const [step, setStep] = useState(0);
  const u = S.user;
  const finish = tid => {
    updUser({ onboarded: true });
    if (S.test && S.test.phase === "onb") testOnboardingDone();
    if (tid) { const tp = X.T.find(x => x.id === tid); mergeItems(tp.items.map(([p, n]) => ({ p, n })), true); go("cistella"); }
  };
  const suggested = u.seg === "B" ? "familia" : u.seg === "C" ? (u.diets.includes("sg") ? "sensegluten" : "saludable") : "estudiant";
  const tp = X.T.find(x => x.id === suggested);
  return html`<div class="onb" role="dialog" aria-modal="true" aria-label=${t("onb1_t")}><div class="wrap stack-l" style="max-width:520px">
    <div class="row"><span class="dots" aria-label=${t("onb_step", { a: step + 1, b: 3 })}>${[0, 1, 2].map(i => html`<i key=${i} class=${i === step ? "on" : ""}></i>`)}</span><span class="grow"></span>
      <button type="button" class="link-btn" onClick=${() => finish(null)}>${t("onb_skip")}</button></div>
    ${step === 0 ? html`<div class="stack-l">
      <span style="width:64px;height:64px;color:var(--ink)"><${Logo} /></span>
      <h1 style="font-size:var(--t-2xl);font-weight:800;line-height:1.05">${t("onb1_t")}</h1>
      <p class="muted">${t("onb1_s")}</p>
      <div class="stack">${[["receipt", "onb_p1"], ["shield", "onb_p2"], ["users", "onb_p3"]].map(([ic, k]) => html`<div class="row" key=${k}><span class="chip plum" style="width:36px;height:36px;justify-content:center;padding:0"><${Icon} n=${ic} s=${18} /></span><span>${t(k)}</span></div>`)}</div>
      <${Seg} label=${t("lang_label")} value=${u.lang} onChange=${v => updUser({ lang: v })} options=${[{ v: "ca", l: "Català" }, { v: "es", l: "Castellano" }]} />
      <button type="button" class="btn primary" onClick=${() => setStep(1)}>${t("next")}</button></div>` : null}
    ${step === 1 ? html`<div class="stack-l"><h1 style="font-size:var(--t-xl);font-weight:800">${t("who")}</h1><${SegmentPick} />
      <div class="field"><span class="lab">${t("diets")}</span><div class="chips">${DIET_TAGS.map(d => html`<button type="button" key=${d} class="filter" aria-pressed=${String(u.diets.includes(d))} onClick=${() => updUser({ diets: u.diets.includes(d) ? u.diets.filter(x => x !== d) : u.diets.concat([d]) })}>${t("tag_" + d)}</button>`)}</div></div>
      <div class="row"><button type="button" class="btn ghost" onClick=${() => setStep(0)}>${t("back")}</button><button type="button" class="btn primary grow" onClick=${() => setStep(2)}>${t("next")}</button></div></div>` : null}
    ${step === 2 ? html`<div class="stack-l"><h1 style="font-size:var(--t-xl);font-weight:800">${t("onb3_t")}</h1><${TownField} />
      <div class="field"><span class="lab">${t("my_chains")}</span><${ChainPicker} /></div>
      <button type="button" class="btn primary" onClick=${() => finish(suggested)}>${t("onb_start", { name: tl(tp) })}</button>
      <button type="button" class="btn ghost" onClick=${() => finish(null)}>${t("onb_empty")}</button>
      <button type="button" class="link-btn" onClick=${() => setStep(1)}>${t("back")}</button></div>` : null}
  </div></div>`;
}

/* ---------- router ---------- */
function SheetRouter({ s }) {
  switch (s.type) {
    case "product": return html`<${ProductSheet} id=${s.id} />`;
    case "category": return html`<${CategorySheet} id=${s.id} />`;
    case "picker": return html`<${PickerSheet} />`;
    case "merge": return html`<${MergeSheet} s=${s} />`;
    case "recipe": return html`<${RecipeSheet} id=${s.id} />`;
    case "chains": return html`<${ChainsSheet} />`;
    case "chain": return html`<${ChainSheet} id=${s.id} />`;
    case "schedules": return html`<${SchedulesSheet} />`;
    case "schedNew": return html`<${SchedNewSheet} />`;
    case "community": return html`<${CommunitySheet} />`;
    case "feedback": return html`<${FeedbackSheet} />`;
    case "profile": return html`<${ProfileSheet} />`;
    case "town": return html`<${TownSheet} />`;
    case "method": return html`<${MethodSheet} />`;
    case "about": return html`<${AboutSheet} />`;
    case "shoplist": return html`<${ShopListSheet} cid=${s.cid} />`;
    case "purchase": return html`<${PurchaseSheet} cid=${s.cid} />`;
    case "savings": return html`<${SavingsSheet} />`;
    case "scan": return html`<${ScanSheet} />`;
    case "test": return html`<${TestSetupSheet} />`;
    case "testAfter": return html`<${TestAfterSheet} />`;
    case "testSummary": return html`<${TestSummarySheet} code=${s.code} />`;
    default: return null;
  }
}
