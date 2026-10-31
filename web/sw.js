/* Preuet service worker: lets the installed app open offline and fast on a weak signal.
   - Prices (data/*.json): network first, but after 3 s the saved copy is used, and refreshed when the network answers.
   - Everything else on this site: the saved copy at once, refreshed in the background (a new version shows on the next visit).
   Supabase and any other origin are never touched. VERSION changes with every build, so each deploy starts a clean cache. */
const VERSION = "preuet-@@BUILD@@";
const SHELL = ["./", "./index.html", "./config.js", "./data/preuet-data.json", "./data/history.json", "./manifest.webmanifest",
  "./fonts/fonts.css", "./vendor/htm-preact-standalone-3.1.1.umd.js", "./vendor/supabase-js-2.117.1.umd.js", "./icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function save(req, res) {
  if (res && res.ok && res.type === "basic") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
  return res;
}
function cached(req) {
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
}
function networkFirst(req, ms) {
  const net = fetch(req).then(res => save(req, res));
  const late = new Promise(resolve => setTimeout(resolve, ms)).then(() => cached(req));
  return Promise.race([net.catch(() => cached(req)), late.then(hit => hit || net)]).then(res => res || net);
}
function staleWhileRevalidate(req, e) {
  const net = fetch(req).then(res => save(req, res));
  e.waitUntil(net.catch(() => {}));
  return cached(req).then(hit => hit || net);
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/data\/[^/]+\.json$/.test(url.pathname)) e.respondWith(networkFirst(req, 3000));
  else e.respondWith(staleWhileRevalidate(req, e));
});
