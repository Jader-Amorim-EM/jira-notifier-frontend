const DB_NAME = "jira-notifier-db";
const DB_VERSION = 1;
const STORE_NAME = "notifications";

/* ==============================
   ABRIR BANCO
================================ */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ==============================
   SALVAR NOTIFICAÇÃO
================================ */
let sequenceCounter = 0;

export async function saveNotification(notification) {
  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.add({
    title: notification.title,
    body: notification.body,
    issueKey: notification.issueKey,
    jiraBaseUrl: notification.jiraBaseUrl,
    timestamp: notification.timestamp || Date.now(),
    sequence: ++sequenceCounter
  });

  return tx.complete;
}

/* ==============================
   BUSCAR HISTÓRICO
================================ */
export async function getNotifications() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearNotifications() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

