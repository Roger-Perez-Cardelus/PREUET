/* Preuet · configuració de la versió web (GitHub Pages)
 *
 * Deixa supabaseUrl buit i l'app funciona en mode local: la cistella i les aportacions
 * es desen només al navegador de cada persona.
 *
 * Per compartir avisos d'estoc, preus, comentaris i fitxes S01–S10 entre tothom,
 * crea un projecte gratuït a Supabase (vegeu README.md, apartat «Supabase») i enganxa-hi:
 *   - supabaseUrl:     Project Settings → Data API → Project URL   (https://xxxx.supabase.co)
 *   - supabaseAnonKey: Project Settings → API Keys → anon public    (clau pública; les dades les protegeix RLS)
 */
window.PREUET_CONFIG = {
  supabaseUrl: "https://vxsorejvvfgpmfzsihjy.supabase.co",
  supabaseAnonKey: "",
  supabaseJs: "vendor/supabase-js-2.117.1.umd.js",
};
