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
   PUSH NOTIFICATION
================================ */
self.addEventListener("push", event => {
  const data = event.data?.json() || {};

  const notification = {
    title: data.title || "Jira",
    body: data.body || "",
    issueKey: data.issueKey,
    jiraBaseUrl: data.jiraBaseUrl,
    timestamp: Date.now()
  };

  event.waitUntil(
    (async () => {
      // 👉 Mostra a notificação corretamente
      await self.registration.showNotification(notification.title, {
        body: notification.body,
        data: {
          issueKey: notification.issueKey,
          jiraBaseUrl: notification.jiraBaseUrl
        }
      });

      // 👉 Envia para a página atualizar o histórico em tempo real
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window"
      });

      for (const client of clients) {
        client.postMessage({
          type: "NEW_NOTIFICATION",
          payload: notification
        });
      }
    })()
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
        return self.clients.openWindow(url);
      })
  );
});




