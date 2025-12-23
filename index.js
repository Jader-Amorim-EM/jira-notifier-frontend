import { getNotifications, saveNotification, clearNotifications } from "./db.js";


/* ==============================
   CONFIGURAÇÕES
================================ */
const BACKEND_URL = "https://jira-push-backend.onrender.com";
const PUBLIC_VAPID_KEY = "BONlAh-vW098CFCTrKIgQj-xltr_inPdJ_2sBpojC5LyqGo9r5YOU843LU4ApEJOwuWG0g2LzxTFUKH9tniWuvA";

/* ==============================
   ELEMENTOS DA TELA
================================ */
const enableButton = document.getElementById("enableNotifications");
const historyList = document.getElementById("history");
const clearButton = document.getElementById("clearHistory");

/* ==============================
   SERVICE WORKER
================================ */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.error("Erro ao registrar SW:", err));
}

/* ==============================
   PERMISSÃO DE NOTIFICAÇÃO
================================ */
async function requestPermission() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada");
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
   SUBSCRIBE PUSH
================================ */
async function subscribeUser() {
  await requestPermission();

  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  });

  await fetch(`${BACKEND_URL}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });

  alert("Notificações ativadas com sucesso");
}

enableButton.addEventListener("click", () => {
  subscribeUser().catch(err => {
    console.error(err);
    alert("Erro ao ativar notificações");
  });
});

/* ==============================
   HISTÓRICO DE NOTIFICAÇÕES
================================ */
async function loadHistory() {
  const notifications = await getNotifications();

  historyList.innerHTML = "";

  if (!notifications.length) {
    historyList.innerHTML = "<li>Nenhuma notificação recebida ainda</li>";
    return;
  }

  notifications.sort((a, b) => b.timestamp - a.timestamp)
    .forEach(n => {
      const li = document.createElement("li");
      
      li.style.cursor = "pointer";

      li.innerHTML = `
        <strong>${n.title}</strong><br/>
        ${n.body}<br/>
        <small>${new Date(n.timestamp).toLocaleString()}</small>
        <hr/>
      `;
      
      li.addEventListener("click", () => {
        if (!n.issueKey || !n.jiraBaseUrl) return;

        const url = `${n.jiraBaseUrl}/browse/${n.issueKey}`;
        window.open(url, "_blank");
      });

      historyList.appendChild(li);
    });
}

navigator.serviceWorker.addEventListener("message", event => {
  if (event.data?.type === "NEW_NOTIFICATION") {
    saveNotification(event.data.payload).then(loadHistory);
  }
});

/* ==============================
   CARREGAR HISTÓRICO AO ABRIR
================================ */
window.addEventListener("load", loadHistory);

/* ==============================
   LIMPAR HISTÓRICO
================================ */
clearButton.addEventListener("click", async () => {
  const confirmClear = confirm("Deseja limpar todas as notificações?");

  if (!confirmClear) return;

  await clearNotifications();
  loadHistory();
});
