const CACHE_NAME = "condobill-pwa-v1";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/index.css",
  "/vite.svg"
];

// Install Event - Pre-cache essential shells
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[PWA SW] Pre-caching asset skip on setup, will cache runtime:", err);
      });
    })
  );
});

// Activate Event - Purge older caches for clean updates
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercept requests
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Avoid intercepting dev-server HMR updates or vite specific socket channels
  if (url.pathname.includes("@vite") || url.pathname.includes("hot-update") || url.port === "3001" || url.pathname.includes("ws")) {
    return;
  }

  // Handle main document and page routing: Network-First to ensure latest version is grabbed, falling back to cached file
  if (event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((match) => {
            return match || caches.match("/");
          });
        })
    );
    return;
  }

  // Other assets (CSS, JS, images, fonts): Cache-First Strategy with Background Cache Revalidation (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to keep caches updated
        fetch(event.request)
          .then((freshResponse) => {
            if (freshResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, freshResponse));
            }
          })
          .catch(() => {}); // ignore failures offline
        return cachedResponse;
      }

      return fetch(event.request).then((freshResponse) => {
        if (freshResponse && freshResponse.status === 200) {
          const copy = freshResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (url.protocol.startsWith("http")) {
              cache.put(event.request, copy);
            }
          });
        }
        return freshResponse;
      });
    })
  );
});
