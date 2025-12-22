const BACKEND_URL = "https://jira-push-backend.onrender.com";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then(() => console.log("Service Worker registrado"))
      .catch(err => console.error("Erro no Service Worker:", err));
  });
}

const PUBLIC_VAPID_KEY = "BONlAh-vW098CFCTrKIgQj-xltr_inPdJ_2sBpojC5LyqGo9r5YOU843LU4ApEJOwuWG0g2LzxTFUKH9tniWuvA";

const enableButton = document.getElementById("enableNotifications");

/* ==============================
   REGISTRAR SERVICE WORKER
================================ */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker não suportado");
  }

  return await navigator.serviceWorker.register("/service-worker.js");
}

/* ==============================
   PEDIR PERMISSÃO
================================ */
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Permissão negada");
  }
}

/* ==============================
   CONVERTER VAPID
================================ */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}


/* ==============================
   CRIAR SUBSCRIPTION
================================ */
async function subscribeUser() {
  const registration = await registerServiceWorker();

  await requestNotificationPermission();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  });

  console.log("Subscription criada:", subscription);

  await sendSubscriptionToBackend(subscription);
}

/* ==============================
   ENVIAR PARA BACKEND
================================ */
async function sendSubscriptionToBackend(subscription) {
  await fetch(`${BACKEND_URL}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(subscription)
  });
}

enableButton.addEventListener("click", () => {
  subscribeUser().catch(err => {
    console.error(err);
    alert("Erro ao ativar notificações");
  });
});

import { getNotifications } from './db.js';

async function loadHistory() {
  const history = document.getElementById('history');
  const notifications = await getNotifications();

  history.innerHTML = '';

  notifications.forEach(n => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${n.title}</strong><br/>
      ${n.body}<br/>
      <small>${new Date(n.timestamp).toLocaleString()}</small>
    `;
    history.appendChild(li);
  });
}

window.addEventListener('load', loadHistory);
