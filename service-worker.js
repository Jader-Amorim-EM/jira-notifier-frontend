function saveToIndexedDB(notification) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('jira-notifier-db', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('notifications', 'readwrite');
      tx.objectStore('notifications').add(notification);
      tx.oncomplete = resolve;
    };

    request.onerror = reject;
  });
}


const CACHE_NAME = "jira-pwa-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/index.js",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
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
self.addEventListener('push', event => {
  const data = event.data.json();

  const notification = {
    title: data.title,
    body: data.body,
    url: data.url || '/',
    timestamp: new Date().toISOString()
  };

  event.waitUntil(
    saveToIndexedDB(notification).then(() =>
      self.registration.showNotification(notification.title, {
        body: notification.body,
        data: { url: notification.url }
      })
    )
  );
});


/* ==============================
   CLICK NA NOTIFICAÇÃO
================================ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
