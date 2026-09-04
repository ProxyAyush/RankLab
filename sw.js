const CACHE_NAME = "ranklab-shell-v10-answer-calculator";
const ROOT_URL = new URL("./", self.location).href;
const FALLBACK_URL = new URL("./index.html", self.location).href;
const APP_SHELL = [
  ROOT_URL,
  FALLBACK_URL,
  new URL("./feedback.html", self.location).href,
  new URL("./privacy.html", self.location).href,
  new URL("./terms.html", self.location).href,
  new URL("./styles.css", self.location).href,
  new URL("./app.js", self.location).href,
  new URL("./pages.js", self.location).href,
  new URL("./model-data.js", self.location).href,
  new URL("./manifest.webmanifest", self.location).href,
  new URL("./icons/app-icon.svg", self.location).href,
  new URL("./icons/icon-192.png", self.location).href,
  new URL("./icons/icon-512.png", self.location).href,
  new URL("./icons/icon-maskable-512.png", self.location).href,
  new URL("./icons/apple-touch-icon.png", self.location).href
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(FALLBACK_URL, copy));
          }
          return response;
        })
        .catch(() => caches.match(FALLBACK_URL).then((cached) => cached || caches.match(ROOT_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
