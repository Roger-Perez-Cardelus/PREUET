# Traspàs: què ha canviat a Preuet des de la V1

Document per a qui continuï el projecte, persona o Claude. Resumeix la feina feta entre el 28/10 i el 4/11/2026 a la
branca `claude/fervent-shannon-t7dywn`, ja fusionada a `main` i publicada. Punt de partida: la V1 de l'equip (fins al
commit `d048b44`, 20/10/2026). Per veure-ho tot en detall:

```bash
git log --oneline d048b44..main
git diff --stat d048b44..main -- . ':!data' ':!web/img' ':!docs/img' ':!tmp-raw'
```

Cada commit explica el perquè al missatge. El README és la referència de com funciona tot; aquest document diu què és
nou, quines decisions s'han pres i què queda pendent.

## 1. Abans de tocar res

- **Proves:** `node --test tests/*.test.mjs` (18 proves) i `python3 tools/build.py web && node tests/smoke.mjs`
  (recorregut amb Playwright; amb `AXE=1` també revisa l'accessibilitat). L'acció de GitHub les passa abans de publicar:
  si alguna falla, la web no es publica.
- **Dades:** `python3 tools/update_data.py check` ha d'acabar sense problemes.
- **Publicar:** qualsevol push a `main` torna a publicar GitHub Pages (`.github/workflows/pages.yml`).
- **L'ordre dels mòduls** és a `src/_order.txt`: tot s'ajunta en un sol script. Un fitxer nou s'hi ha d'afegir.

## 2. Actualització de preus: ara hi ha dues vies, i no xoquen

| Què | Com | Quan |
|---|---|---|
| **Mercadona i Consum** | Acció **«Preus de productes nous»** (`.github/workflows/prices.yml`, mode `update`): llegeix l'API del catàleg de Mercadona i el cercador de Consum (`tools/fetch_prices.py`), refà els preus, desa l'historial i torna a publicar. | Sola cada dilluns a les 4:23 UTC, o a mà a Actions. |
| **La resta** (Bonpreu, Ametller, Carrefour, Dia, bonÀrea, Lidl, Aldi) | El procediment de sempre de `tools/UPDATE.md` (WebFetch + `update_data.py apply-prices`). | La tasca setmanal del vostre Claude. |

- `UPDATE.md` ja ho explica (apartat «Mercadona i Consum: llegits directament»): la tasca setmanal **no cal que llegeixi
  Mercadona ni Consum**.
- `apply-prices` actualitza els paquets al seu lloc, així que conserva les fotos i els codis de barres.
- **Carrefour i Dia** responen 403 a les lectures automàtiques. Els seus preus són del 19/10 i l'app els marca com a
  antics. Mode `pages` de l'acció: baixa les pàgines font per revisar-les (`tools/parse_pages.py`).
- `apply-prices` reté els canvis de més del 50 % per revisar-los a mà.

## 3. Què ha canviat a l'app

**Càlcul de la cistella**
- Es compta el que pagues a caixa: paquets sencers, o al pes per a la fruita i la verdura a granel. Abans es feia una
  proporció. Pot combinar dos formats i avisa quan el paquet és més gran del que cal.
- **Tria de tiquet:** més barata, combinada (dos súpers, amb subtotals i una llista per a cada botiga) i qualitat-preu.
  El tiquet ja no queda fixat a l'últim súper tocat.
- **Cistella més sana** (`src/health.js`): canvis triats a mà per productes semblants (per exemple llet sencera →
  semidesnatada). Només surten si la nutrició ho confirma: −20 % de greix saturat, sucres o sal, o +30 % de fibra.
- Avís quan els preus d'un súper tenen més de 8 dies, i data per cadena.

**Dades**
- **131 productes** (38 de nous, definits a `tools/new_products.py`) i 929 preus.
- **Fotos del paquet real**, d'Open Food Facts (CC BY-SA, amb atribució a la fitxa), buscades pel codi de barres de la
  botiga. Acció `photos.yml`; correspondències revisades a `data/off-matches.json`.
- **Historial setmanal** de preus (`data/history.json`) i gràfic d'evolució a la fitxa.
- **Preus de la comunitat validats:** un sol preu fora del −60 %…+60 % de l'oficial no compta fins que un altre el confirma.

**Funcions noves**
- Ubicació i súpers a prop (OpenStreetMap).
- Llista de la compra per passadissos.
- Compartir la cistella per enllaç.
- Seguir productes i avisos d'ofertes.
- Escàner de codi de barres.
- Registre de compres i estalvi.
- Cerques recents.
- Instal·lació com a app.
- Desfer.

**Accessibilitat**
- Fitxes amb el focus atrapat i el fons inert; en tancar-les, el focus torna on era.
- Mida del text, contrast alt i menys animacions (Perfil → Accessibilitat).
- Enllaç per saltar al contingut i avís per a lectors de pantalla.
- Cerca per veu i lectura en veu de la llista.

**Supabase**
- Esquema v2 a `supabase/schema.sql`:
  - autors no visibles al feed;
  - valoració única per persona;
  - neteja d'aportacions velles;
  - CAPTCHA opcional (Turnstile).
- La clau pública ja és a `web/config.js`.

**Web**
- Les dades ja no van dins la pàgina: es baixen un cop i el service worker les guarda.
- La pàgina es demana primer a la xarxa, i cada versió nova es veu a la primera.
- CSP amb hashes.

**Súpers sense cap preu** (Caprabo, Condis, Sorli, Spar, Suma): s'amaguen a tot arreu, també les 4 ofertes de Caprabo.
Continuen a les dades i tornaran a sortir soles quan tinguin preus (`indexData` a `src/core.js`).

**Sense versió d'artifact**: l'app només es publica a GitHub Pages. S'ha tret la versió d'artifact de Claude (la V1
de https://claude.ai/artifact/… s'ha quedat antiga i no s'actualitza), el mode de dades de Claude de `src/store.js` i
`tools/page_body.html` i `tools/cdn.txt`. Les dades compartides només van a Supabase.

**GitHub**: README amb captures (`docs/img/`), estat de les accions i formularis d'incidències.

## 4. Preuet Plus: model de pagament simulat (decisió de l'equip)

`src/premium.js`. **No es cobra res:** és una prova de disposició a pagar per al Lean Canvas.

- **Gratis:**
  - on és més barata la cistella;
  - el rànquing qualitat-preu;
  - la fitxa del producte, amb al·lèrgens, nutrició i origen;
  - la comunitat;
  - l'accessibilitat.
- **Plus:**
  - ofertes, receptes, llista de la compra, cistella més sana;
  - compres periòdiques, compres i estalvi, evolució del preu;
  - avisos, súpers a prop, escàner, veu i compartir.
- En obrir una funció Plus surt l'oferta: 2,49 €/mes o 19,99 €/any (**preus provisionals**, a `PLUS_PLANS`) i
  «Quant pagaries?». Es desa al perfil (`user.plus`):
  - vistes per funció;
  - pla triat;
  - preu declarat;
  - «Ara no».

  Després s'explica que no es cobra i es desbloqueja.
- **El mode prova S01–S10 ho té tot desbloquejat** (`hasPlus()` és cert si `S.test`).
- Per tancar una funció, s'afegeix a `PLUS_FEATURES` i es posa `needPlus("id")`, `PLUS_SHEETS` o `PLUS_TABS` on calgui.
  Per obrir-la, el mateix al revés.
- Les consultes SQL per llegir els resultats són al README («Preuet Plus»).
- És un bloqueig només del navegador: serveix per mesurar, no per protegir.

## 5. Pendent

**Ho ha de fer l'equip (fora del codi)**
1. **Supabase:**
   - tornar a executar `supabase/schema.sql` (v2);
   - activar *Anonymous sign-ins*;
   - definir la clau d'equip.

   Sense això, les aportacions i les respostes del Plus es queden a cada mòbil.
2. Opcionals: Turnstile (CAPTCHA) i `pg_cron` per a la neteja automàtica (passos al README).
3. **Substituir els preus de Plus** per un preu de referència real.
4. A GitHub:
   - About: descripció, web i temes;
   - Settings → Social preview amb `docs/img/social.jpg`;
   - crear les etiquetes `dades` i `error`.
5. Provar l'app amb usuaris reals i amb un lector de pantalla real.
6. No activar el Plus amb els mòbils de l'equip fora del mode prova, perquè embruta les dades.

**Idees que no s'han fet**
- Que compartir sigui gratis: és com l'app es dona a conèixer.
- Que Caprabo torni a sortir com a «només promocions».
- Més productes amb alternativa sana (arròs i pasta integrals).

## 6. Coses que convé saber

- `tmp-raw/` és només per revisar a mà: no s'ha de publicar ni fer servir a l'app.
- La nutrició és per tipus de producte, no per marca ni per súper. Per això no hi ha cap tiquet «més sà» per súper.
- Els tests carreguen l'app sense navegador (`tests/harness.mjs`). Una funció nova que vulgueu provar s'ha d'afegir a la
  llista que exporta.
