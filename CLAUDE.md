# Preuet: instruccions per a Claude

Aquest fitxer és per a qualsevol Claude que treballi en aquest repositori. Respon sempre en català.

## Si véns de la V1: posa't al dia primer

Entre el 28/10 i el 4/11/2026 una altra sessió de Claude hi va fer molts canvis, ja publicats a `main`. Abans de fer
qualsevol altra cosa, fes aquests passos en ordre i, al final, explica a la persona amb qui treballes què has fet i què
queda pendent.

1. **Agafa la versió actual:** `git pull origin main`. Treballa sempre sobre `main`, mai sobre una còpia antiga.
2. **Llegeix sencers** `docs/TRASPAS.md` (què ha canviat i per què), `README.md` i `tools/UPDATE.md`.
3. **Comprova que tot funciona:**
   - `node --test tests/*.test.mjs`: han de passar les 18 proves.
   - `python3 tools/build.py`: ha de construir `dist/web`.
   - `python3 tools/update_data.py check`: no ha de mostrar cap problema.
4. **Revisa la teva tasca setmanal de preus.** Si en tens una de programada, llegeix-ne el missatge i substitueix-lo
   pel de l'apartat «Missatge per a la tasca setmanal» de sota, o adapta'l perquè digui el mateix. Si el missatge
   antic diu de llegir o publicar l'artifact, de llegir Mercadona o Consum o d'executar `build.py artifact`, ja no és
   vàlid.
5. **L'artifact antic** (https://claude.ai/artifact/4fU8NevMmyCkJDCLxAryWZ) és la V1 i ja no s'actualitza. La web
   bona és https://roger-perez-cardelus.github.io/PREUET/. Abans de tocar l'artifact, **pregunta-ho a la persona**,
   perquè és del seu compte:
   - Si té fitxes de proves S01–S10, que les exporti abans (Més → Mode prova → CSV). La web nova no les veu.
   - Després, o s'esborra o s'hi publica l'avís «Preuet s'ha mogut» de sota.
6. **Informa la persona** de les tasques pendents de l'equip (apartat 5 de `docs/TRASPAS.md`). Les principals:
   - tornar a executar `supabase/schema.sql` (versió 3), activar els accessos anònims i definir la clau d'equip;
   - posar preus de referència reals al Preuet Plus.

## Normes del projecte

- **Mai no s'inventa un preu.** Només el que mostra la botiga aquell dia (vegeu `tools/UPDATE.md`).
- **Un push a `main` publica la web.** L'acció passa les proves abans i, si alguna falla, no publica res. Passa-les
  sempre abans de fer push: `node --test tests/*.test.mjs` i `python3 tools/build.py && node tests/smoke.mjs`.
- **Mercadona i Consum s'actualitzen sols** cada dilluns a les 4:23 UTC (`.github/workflows/prices.yml`). No els llegeixis
  amb WebFetch. Si el push et falla perquè `main` ha canviat, fes `git pull --rebase origin main`, torna a passar
  `check` i torna a fer push.
- **Només hi ha la versió web.** No tornis a afegir la versió d'artifact ni dades dins la pàgina.
- **Mode equip** (`src/team.js`): el mode prova i el panell d'equip només s'obren amb el codi d'equip, que comprova
  el servidor. S'hi entra amb `#equip`. No el desactivis ni ensenyis el codi enlloc del repositori.
- **Preuet Plus** (`src/premium.js`) és una prova de disposició a pagar decidida per l'equip. No canviïs què és gratis
  i què és Plus sense que l'equip ho demani.
- Un mòdul nou de `src/` s'ha d'afegir a `src/_order.txt`. Els textos van en català i castellà a `src/i18n*.js`: la
  prova d'i18n comprova que hi siguin tots dos.
- Missatges de commit en català, explicant el perquè.

## Missatge per a la tasca setmanal

```
Actualització setmanal de preus i ofertes de Preuet.
1. Clona el repositori Roger-Perez-Cardelus/PREUET o, si ja el tens, fes git pull origin main. Treballa només sobre main.
2. Segueix tools/UPDATE.md tal com està al repositori, pas a pas. No llegeixis Mercadona ni Consum: l'acció
   «Preus de productes nous» els actualitza sola cada dilluns.
3. No facis servir ni publiquis l'artifact antic: l'app només es publica a GitHub Pages amb el push a main.
4. Abans del push: python3 tools/update_data.py check, python3 tools/build.py i node --test tests/*.test.mjs.
5. Després del push, comprova a Actions que «Publica Preuet a GitHub Pages» acaba en verd.
6. Acaba amb l'informe de l'apartat 6 de tools/UPDATE.md.
```

## Avís «Preuet s'ha mogut» per a l'artifact antic

Només si la persona ho vol. Publica aquest HTML a l'URL de l'artifact antic:

```html
<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preuet s'ha mogut</title>
<style>body{font-family:system-ui,sans-serif;background:#F6F3F8;color:#1E1525;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}
main{max-width:420px;text-align:center}a{display:inline-block;margin-top:16px;background:#47235C;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head>
<body><main><h1>Preuet s'ha mogut</h1><p>Aquesta versió ja no s'actualitza. La nova té més productes, fotos i preus de cada setmana.
<br><small>Esta versión ya no se actualiza. La nueva tiene más productos, fotos y precios de cada semana.</small></p>
<a href="https://roger-perez-cardelus.github.io/PREUET/">Obre la nova Preuet</a></main></body></html>
```
