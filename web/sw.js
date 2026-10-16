/* Preuet service worker: lets the installed app open offline with the last prices it saw.
   Same-origin files go network-first (a new week's prices replace the cached ones as soon as there is signal);
   Supabase and any other origin are never touched. Bump VERSION when the file list changes. */
const VERSION = "preuet-@@BUILD@@";
const SHELL = ["./", "./index.html", "./config.js", "./data/preuet-data.json", "./manifest.webmanifest",
  "./fonts/fonts.css", "./vendor/htm-preact-standalone-3.1.1.umd.js", "./icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
