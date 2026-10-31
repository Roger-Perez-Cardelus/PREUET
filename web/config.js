/* Preuet · configuració de la versió web (GitHub Pages)
 *
 * Deixa supabaseUrl buit i l'app funciona en mode local: la cistella i les aportacions
 * es desen només al navegador de cada persona.
 *
 * Per compartir avisos d'estoc, preus, comentaris i fitxes S01–S10 entre tothom,
 * crea un projecte gratuït a Supabase (vegeu README.md, apartat «Supabase») i enganxa-hi:
 *   - supabaseUrl:     Project Settings → Data API → Project URL   (https://xxxx.supabase.co)
 *   - supabaseAnonKey: Project Settings → API Keys → anon public    (clau pública; les dades les protegeix RLS)
 *
 * Opcional, contra els robots que creen usuaris anònims sense parar (vegeu README.md, «CAPTCHA»):
 *   - turnstileSiteKey: Cloudflare → Turnstile → Site Key   (clau pública; la secreta va a Supabase, mai aquí)
 */
window.PREUET_CONFIG = {
  supabaseUrl: "https://vxsorejvvfgpmfzsihjy.supabase.co",
  supabaseAnonKey: "sb_publishable_RaVIkwJJQDoF3Jy_U3W7cg_5LNIQnag",
  supabaseJs: "vendor/supabase-js-2.117.1.umd.js",
  turnstileSiteKey: "",
};
