import { getNotifications, saveNotification, clearNotifications } from "./db.js";
const JIRA_BASE_URL = "https://escolarmanager.atlassian.net/browse";

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
    .register("./service-worker.js")
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

  return await navigator.serviceWorker.register("./service-worker.js");
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

  const existingSubscription =
    await registration.pushManager.getSubscription();

  if (existingSubscription) {
    // já está ativo → não dispara popup duplicado
    return false;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  });

  await fetch(`${BACKEND_URL}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });

  return true;
}

/* ==============================
   HISTÓRICO DE NOTIFICAÇÕES
================================ */
async function loadHistory() {
  const list = document.getElementById("history");
  list.innerHTML = "";

  const notifications = await getNotifications();

  if (!notifications || notifications.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma notificação recebida ainda";
    list.appendChild(li);
    return;
  }

  // 🔽 mais recentes primeiro
  notifications
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach(notification => {
      const li = document.createElement("li");
      li.className = "history-item";
      li.style.cursor = "pointer";
    
      const date = new Date(notification.timestamp).toLocaleString();

      li.innerHTML = `
        <strong>${notification.title}</strong><br>
        ${notification.body || ""}<br>
        <small>${date}</small>
      `;

      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        if (!notification.issueKey) {
          console.warn("Notificação sem issueKey", notification);
          return;
        }

        const url = `${JIRA_BASE_URL}/${notification.issueKey}`;
        window.open(url, "_blank");
      });

      list.appendChild(li);
      
      // separador visual (evita hr no último item)
      if (index < notifications.length - 1) {
        const hr = document.createElement("hr");
        list.appendChild(hr);
      }
    });
}


navigator.serviceWorker.addEventListener("message", async event => {
  if (event.data?.type !== "NEW_NOTIFICATION") return;

  const { title, body, issueKey, timestamp } = event.data.payload;

  if (!issueKey) {
    console.warn("Notificação recebida sem issueKey, ignorando");
    return;
  }

  const notification = {
    title,
    body,
    issueKey,
    timestamp: timestamp || Date.now()
  };

  console.log("📥 Salvando notificação normalizada:", notification);

  await saveNotification(notification);
  loadHistory();
});


async function disableNotifications() {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return false;
  }

  await fetch(`${BACKEND_URL}/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription)
  });

  await subscription.unsubscribe();

  return true;
}



/* ==============================
   LIMPAR HISTÓRICO
================================ */
clearButton.addEventListener("click", async () => {
  const confirmClear = confirm("Deseja limpar todas as notificações?");

  if (!confirmClear) return;

  await clearNotifications();
  loadHistory();
});

function setupButtons() {
  const enableBtn = document.getElementById("enableNotifications");
  const disableBtn = document.getElementById("disableNotifications");

  enableBtn.addEventListener("click", async () => {
    try {
      const activated = await subscribeUser();

      if (activated) {
        alert("Notificações ativadas com sucesso");
      }

      await updateButtons();
    } catch (err) {
      console.error(err);
      alert("Erro ao ativar notificações");
    }
  });

  disableBtn.addEventListener("click", async () => {
    try {
      const disabled = await disableNotifications();

      if (disabled) {
        alert("Notificações desativadas com sucesso");
      }

      await updateButtons();
    } catch (err) {
      console.error(err);
      alert("Erro ao desativar notificações");
    }
  });
}


async function updateButtons() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  const enableBtn = document.getElementById("enableNotifications");
  const disableBtn = document.getElementById("disableNotifications");

  if (!enableBtn || !disableBtn) return;

  if (subscription) {
    enableBtn.disabled = true;
    disableBtn.disabled = false;
  } else {
    enableBtn.disabled = false;
    disableBtn.disabled = true;
  }

  // 🔔 Atualiza o status visual do push
  await updatePushStatus();
}


async function updatePushStatus() {
  if (!("serviceWorker" in navigator)) return;

  const statusEl = document.getElementById("pushStatus");
  if (!statusEl) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    statusEl.textContent = "🟢 Push ativo";
    statusEl.style.color = "green";
  } else {
    statusEl.textContent = "🔴 Push desativado";
    statusEl.style.color = "red";
  }
}


// ===============================
// 🚨 AQUI ENTRA O DOMContentLoaded
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  setupButtons();
  updateButtons();
});
