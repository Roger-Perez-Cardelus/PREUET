# Actualització setmanal de preus i ofertes

Procediment que segueix la tasca programada cada dilluns, i que també pot fer qualsevol persona de l'equip. Resultat: `data/preuet-data.json` amb els preus i les ofertes de la setmana, i l'app tornada a publicar.

**Regla d'or: mai no s'inventa un preu.** Només s'hi posa el que la pàgina mostra aquell dia. Si una pàgina no es pot llegir, els seus productes conserven el preu anterior amb la data antiga, i l'app els marca com a «Preu antic» quan tenen més de 30 dies.

## 0. On és tot

| Peça | On |
|---|---|
| App publicada (artifact de Claude) | https://claude.ai/artifact/4fU8NevMmyCkJDCLxAryWZ |
| Codi i dades | El repositori de GitHub, si existeix (vegeu README). Si no, l'artifact mateix: el projecte hi és sencer a `source/…` i les dades a `data/preuet-data.json`. |
| Dades | `data/preuet-data.json` |
| Eines | `tools/update_data.py` (aplica i valida) i `tools/build.py` (construeix l'app) |

## 1. Preparar

1. Obtén el projecte: clona el repositori o, si no n'hi ha, llegeix l'artifact (`Artifact read` de l'URL), llista'n els fitxers (`Artifact list`, `scope: files`) i baixa'ls tots amb `Artifact read` i `paths`. Munta una carpeta amb `source/X` → `X` i `data/preuet-data.json` → `data/preuet-data.json`.
2. Comprova que les dades són bones abans de tocar res: `python3 tools/update_data.py check` (ha d'acabar sense problemes).
3. Genera la llista de feina: `python3 tools/update_data.py worklist --out worklist.json`. Per a cada cadena hi ha les pàgines a llegir i, per a cada pàgina, els noms exactes dels productes que Preuet hi segueix (`track`).

## 2. Llegir els preus (`captures.json`)

Llegeix **cada pàgina** de `worklist.json` amb WebFetch i demana-hi, literalment:

> Llista tots els productes de la pàgina amb el nom exacte tal com surt, el preu actual en euros del paquet i el text de promoció si n'hi ha (per exemple «2a unitat -50%», «Preu Club», «Abans 2,29 €» amb les dates si surten). Inclou especialment aquests: <noms de `track`>. No calculis res ni completis res que no surti a la pàgina.

Desa el resultat a `captures.json`, una entrada per pàgina, amb l'URL exacte de `worklist.json` com a clau:

```json
{
  "https://www.compraonline.bonpreuesclat.cat/categories/…": [
    {"name": "BONPREU Llet sencera en cartró", "price": 0.96, "promo": ""},
    {"name": "ANETO Brou de pollastre 2 x 1L", "price": 4.99, "promo": "Abans 7,99€"}
  ]
}
```

- El preu és el del **paquet**, no el preu per kg o per litre. L'eina recalcula el preu unitari.
- Si una pàgina falla (bloqueig, error, pàgina buida), busca la mateixa categoria amb WebSearch i llegeix la pàgina del resultat. Posa-la a `captures.json` amb la seva URL nova; si el web no identifica la cadena (per exemple, un comparador), escriu l'entrada com `{"chain": "mercadona", "items": [...]}`. Si tampoc no es pot, deixa-la fora i anota-ho per a l'informe.
- No cal que el nom sigui idèntic: l'eina accepta majúscules, accents i espais diferents, però exigeix que les xifres del nom (mides de paquet) coincideixin.

Notes per cadena:

| Cadena | Font | Notes |
|---|---|---|
| Mercadona | supersupers.com (comparador públic) | La web de Mercadona no es pot llegir automàticament. Mercadona no fa promocions. |
| Lidl | radarsuper.com i el fullet PDF | Lidl ja no publica preus en línia. El fullet de la setmana s'enllaça a `https://radarsuper.com/folletos/lidl/provincia/barcelona`. Afegeix l'URL nou del PDF a `captures.json` com una pàgina més. |
| Aldi | radarsuper.com/aldi | Preus antics (estat «antic»). Si n'hi ha de nous, s'actualitzen. |
| Carrefour, Dia, Bonpreu, Ametller Origen, Consum, bonÀrea | Botiga en línia oficial | Pàgines de categoria o de producte. |
| Caprabo | Pàgina de promocions | Només ofertes, sense preus de producte. |
| Condis, Sorli, Spar, Suma | — | No publiquen preus llegibles: només hi ha preus de la comunitat. |

Aplica'ls:

```bash
python3 tools/update_data.py apply-prices captures.json --dry-run   # revisa l'informe
python3 tools/update_data.py apply-prices captures.json
```

`apply-prices` també afegeix els preus del dia a `data/history.json` (l'evolució que es veu a la fitxa de producte). Si cal refer-ho: `python3 tools/update_data.py history`.

L'informe diu, per cadena, quants preus han canviat, quants són iguals i quants tenen més de 30 dies. Els canvis de preu unitari de més del 50 % es retenen: torna a mirar la pàgina i, només si el preu nou és correcte (per exemple, ha canviat el format del paquet amb el mateix nom), torna a executar amb `--accept-big`. Els productes nous que no segueix Preuet s'ignoren.

## 3. Ofertes de la setmana (`offers.json`)

Recull les promocions **vigents i properes** amb data, de:

- les mateixes pàgines del pas 2 (Bonpreu, Carrefour, Ametller Origen, Consum, Dia, bonÀrea);
- el fullet de Lidl de la setmana que comença (dates «del … al …» de la portada);
- `https://www.caprabo.com/es/ofertas-y-promociones/promociones/index.html?tk=0`.

Format, una llista amb totes les ofertes:

```json
[
  {"c": "lidl", "title": "Llet semidesnatada Milbona 1 L", "price": 0.79, "was": 0.95, "mech": "Lidl Plus -16%",
   "frm": "2026-10-26", "to": "2026-11-01", "src": "https://assets.leaflets.schwarz/…pdf", "p": "llet-semi"}
]
```

- `c`: id de la cadena (`mercadona`, `lidl`, `aldi`, `carrefour`, `dia`, `bonpreu`, `ametller`, `consum`, `bonarea`, `caprabo`, `condis`, `sorli`, `spar`, `suma`).
- `price` i `was`: preu en oferta i preu anterior, o `null` si la pàgina no els dona (promocions generals).
- `frm` i `to`: dates ISO `AAAA-MM-DD`, o `null` si la pàgina no en diu.
- `p`: id del producte de Preuet si és clarament el mateix (vegeu `products` a les dades), si no `null`.
- Parteix de les ofertes actuals (`offers` de les dades) i treu-ne les que la pàgina ja no mostra.

```bash
python3 tools/update_data.py apply-offers offers.json
```

Les acabades es descarten soles.

## 4. Validar i construir

```bash
python3 tools/update_data.py check --fix      # recalcula comptes, ordre d'opcions, fonts i data
python3 tools/build.py                        # dist/artifact i dist/web
```

`check` ha d'acabar sense problemes. Si les dades tenen més de 8 dies, `check` ho avisa (i l'acció de GitHub ho mostra com a avís), però no falla. Si una cadena amb estat «complet» o «parcial» no té cap preu dels últims 30 dies, l'eina ho avisa: canvia-li l'estat a `antic` a `chains` o torna a llegir-ne les pàgines.

## 5. Publicar

1. **Artifact**: llegeix-lo primer (`Artifact read` de l'URL) i publica `dist/artifact/index.html` al mateix `url`, amb `files` = `{"data/preuet-data.json": "dist/artifact/data/preuet-data.json", "data/history.json": "dist/artifact/data/history.json"}` (les fotos de `dist/artifact/img/products/` només cal pujar-les quan canviïn). No passis `capabilities` (es conserven) ni toquis els fitxers de `source/` (es conserven sols).
2. **GitHub** (si hi ha repositori): commit de `data/preuet-data.json` i `data/history.json` amb el missatge `Preus i ofertes del AAAA-MM-DD` i push a `main`. GitHub Pages es torna a publicar sol.

## 6. Informe

Una línia per cadena (preus actualitzats, iguals, antics), el nombre d'ofertes vigents i properes, les pàgines que no s'han pogut llegir i els canvis retinguts. Res més.
