const CACHE_NAME = "jira-pwa-cache-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./index.js",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png"
];

/* ==============================
   INSTALL
================================ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ==============================
   ACTIVATE
================================ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ==============================
   FETCH (Offline First)
================================ */
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

/* ==============================
   PUSH EVENT
================================ */
self.addEventListener("push", event => {
  let data = {};

  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || "Jira";
  const options = {
    body: data.body || "",
    data: {
      url: data.url || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = event.notification.data?.url;

  if (!url) {
    console.warn("Push sem dados de redirecionamento");
    return;
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});

/* ==============================
   CLICK NA NOTIFICAÇÃO
================================ */
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const { issueKey, jiraBaseUrl } = event.notification.data || {};

  if (!issueKey || !jiraBaseUrl) {
    console.warn("Push sem dados de redirecionamento");
    return;
  }

  const url = `${jiraBaseUrl}/browse/${issueKey}`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});




