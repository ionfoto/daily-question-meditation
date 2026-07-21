// Service worker: кэширует приложение, чтобы оно работало без интернета.
const CACHE = "vopros-dnya-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./questions.js",
  "./sound.js",
  "./runcalc.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./audio/pad.wav",
  "./audio/rain.wav",
  "./audio/ocean.wav",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Стратегия «сначала сеть»: при наличии интернета всегда свежая версия,
// офлайн — запасной вариант из кэша.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
