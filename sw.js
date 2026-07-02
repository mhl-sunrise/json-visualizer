/* Service worker — offline support for JSON Diagram (PWA) */
const CACHE = "json-diagram-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./robots.txt",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/main.js",
  "./js/constants.js",
  "./js/graph-model.js",
  "./js/graph-layout.js",
  "./js/graph-renderer.js",
  "./js/viewport.js",
  "./js/highlight.js",
  "./js/theme.js",
  "./js/storage.js",
  "./js/editor.js",
  "./js/ui-chrome.js",
  "./js/pwa.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/*
 * Network-first for our own assets: always serve the freshest file when online
 * (so updates show immediately), and fall back to cache only when offline.
 * Cross-origin requests use cache-first.
 */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(caches.match(req).then((c) => c || fetch(req)));
});
