# Preuet

Compara la cistella sencera entre els supermercats de l'àrea de Barcelona i compra on et surt més a compte.
Producte mínim viable (PMV) de l'equip AT2 · Grup F (Empresa, EETAC–UPC, curs 2026–2027).

## Què fa

| Funció | On és a l'app |
|---|---|
| Comparador per cistella: total a cada supermercat, millor opció en un sol súper i en dos, tiquet detallat | Cistella |
| Rànquing qualitat-preu amb el pes que tria cada persona (índex de preus + enquesta OCU 2026 + valoracions) | Cistella |
| Fitxa de producte: preus per cadena amb font i data, semàfor nutricional, al·lèrgens i procedència | Toca qualsevol producte |
| Estoc col·laboratiu: avisos «n'hi ha / en queda poc / esgotat» per municipi i missatge per avisar el súper | Fitxa de producte |
| Receptes ordenades pel cost per ració, amb els ingredients que afegeixes a la cistella | Receptes |
| Compres periòdiques: la cistella que es repeteix cada setmana, quinzena o mes | Més → Compres periòdiques |
| Ofertes vigents i properes de cada cadena | Ofertes |
| Mode prova S01–S10 per a les proves de solució (fitxa Taula C en català i CSV) | Més → Mode prova |

Bilingüe (català i castellà), tema clar i fosc, pensada per al mòbil.

## Dues versions, un sol codi

| | Artifact de Claude | Web a GitHub Pages |
|---|---|---|
| Enllaç | https://claude.ai/artifact/4fU8NevMmyCkJDCLxAryWZ | https://roger-perez-cardelus.github.io/PREUET/ |
| Aportacions compartides (estoc, preus, comentaris, fitxes S01–S10) | Base de dades de l'artifact | Supabase (o només al navegador si no es configura) |
| Qui hi entra | Les persones amb qui la comparteixis | Qualsevol persona amb l'enllaç |
| S'instal·la al mòbil i obre sense connexió | No | Sí («Afegeix a la pantalla d'inici») |

## Estructura

```
src/                 codi de l'app (Preact + htm, sense pas de compilació) i estils
  _order.txt         ordre en què s'ajunten els mòduls
data/
  preuet-data.json   preus, ofertes, productes, receptes, cistelles i fonts
tools/
  build.py           construeix dist/artifact i dist/web
  update_data.py     actualització setmanal: aplica preus i ofertes nous i valida les dades
  UPDATE.md          procediment de l'actualització setmanal
  page_body.html     capçalera de la versió artifact
web/                 fitxers només de la versió web: config.js, manifest, service worker, fonts, llibreries, icones
supabase/schema.sql  taules, polítiques de seguretat (RLS) i funcions de Supabase
.github/workflows/   publicació automàtica a GitHub Pages
```

## Provar-la a l'ordinador

```bash
python3 tools/build.py web
cd dist/web && python3 -m http.server 8000
```

Obre http://localhost:8000. Sense Supabase, l'app funciona en mode local: tot es desa al navegador.

## Publicar-la a GitHub Pages

1. El repositori és https://github.com/Roger-Perez-Cardelus/PREUET (públic: Pages és gratuït en repositoris públics).
2. Al repositori: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` executa l'acció «Publica Preuet a GitHub Pages», que valida les dades, construeix la web i la publica. L'adreça surt a l'acció i a Settings → Pages.

## Supabase: aportacions compartides a la versió web

1. Crea un projecte gratuït a https://supabase.com (millor en una regió europea).
2. **SQL Editor → New query**: enganxa `supabase/schema.sql` i fes **Run**.
3. **Authentication → Sign In / Providers**: activa **Allow anonymous sign-ins**. Cada mòbil rep un usuari anònim; ningú no ha de registrar-se.
4. Tria un codi d'equip per a les fitxes S01–S10 (mínim 8 caràcters) i executa al SQL Editor:
   `select public.set_team_key('el-vostre-codi');`
   Al mode prova de la web, cada membre de l'equip l'escriu un cop al camp «Codi d'equip».
5. **Project Settings → API**: copia la *Project URL* i la clau pública (*anon* o *publishable*) a `web/config.js`, i fes push. Totes dues són públiques: les dades les protegeixen les polítiques de `schema.sql`.
6. (Opcional) Per moderar aportacions, afegeix el teu usuari a `public.admins` (vegeu la capçalera de `schema.sql`).

Per comprovar-ho: a l'app, **Més → Sobre Preuet → Mode de dades** ha de dir «Servidor propi (Supabase)».

Què protegeix `schema.sql`: l'autor i l'hora de cada aportació els posa el servidor, cada persona només pot esborrar les seves (l'administrador, qualsevol), hi ha un límit de 40 aportacions cada 10 minuts per persona, la cistella i les preferències només les veu el seu usuari, i les fitxes S01–S10 només es llegeixen i es desen amb el codi d'equip.

## Actualització setmanal

Els preus i les ofertes es tornen a llegir cada dilluns de les botigues en línia i els comparadors públics, i l'app es torna a publicar. El procediment complet és a [`tools/UPDATE.md`](tools/UPDATE.md); les eines són `tools/update_data.py` i `tools/build.py`.

## Dades i límits

- Preus de les botigues en línia oficials (Bonpreu, Ametller Origen, Dia, Carrefour, Consum, bonÀrea), de comparadors públics (supersupers.com per a Mercadona, radarsuper.com per a Lidl i Aldi) i del fullet de Lidl. Cada preu guarda la font, l'enllaç i la data.
- Condis, Sorli, Spar i Suma no publiquen preus llegibles en línia: s'omplen amb preus aportats per la comunitat.
- Els preus de la web poden diferir dels de la botiga física. El preu vàlid és sempre el de la botiga.
- Els valors nutricionals són de referència per a un producte típic de cada classe; el semàfor fa servir els llindars de la FSA del Regne Unit. Cal llegir sempre l'etiqueta de la marca concreta.
- L'estoc depèn dels avisos dels usuaris: no és un inventari de les botigues.
- La qualitat de cada cadena surt de l'enquesta de satisfacció de l'OCU (2026) i de les valoracions de la comunitat.

## Llicències de tercers

- Fonts Figtree, Bricolage Grotesque i DM Mono: SIL Open Font License 1.1 (fitxers de Fontsource).
- htm 3.1.1 amb Preact: Apache-2.0 i MIT.
- supabase-js 2.117.1: MIT.

## Ús d'IA

L'app s'ha desenvolupat amb l'ajuda de Claude (Anthropic). Cal declarar-ho a l'annex d'ús d'IA del Document del Projecte, com indica la guia de l'assignatura.
