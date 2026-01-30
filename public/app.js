import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyACjC1NxtUbKBSDVyzxNXLpvT0pKnnTm_Y",
    authDomain: "qms-hybrid.firebaseapp.com",
    projectId: "qms-hybrid",
    storageBucket: "qms-hybrid.firebasestorage.app",
    messagingSenderId: "219252766112",
    appId: "1:219252766112:web:f46962805bf56c4faae0c5",
    measurementId: "G-GW090D4TM0",
    databaseURL: "https://qms-hybrid-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let messaging = null;
try {
    messaging = getMessaging(app);
} catch (error) {
    console.warn("Firebase Messaging not supported in this environment:", error);
}

// --- UI Elements ---
const currentNumEl = document.getElementById('current-number');
const currentCounterEl = document.getElementById('current-counter');
const lastUpdatedEl = document.getElementById('last-updated');
const recentCallsPreviewEl = document.getElementById('recent-calls-preview');
const fullHistoryListEl = document.getElementById('full-history-list');
const myTicketInput = document.getElementById('my-ticket');
const notifyBtn = document.getElementById('btn-enable-notify');
const notifyStatus = document.getElementById('notify-status');

// --- Real-time Updates ---
const locationId = 'LOC_1'; // Hardcoded for this demo
const currentRef = ref(db, `qms/locations/${locationId}/current`);

// Calculate today's date string for history path (YYYY-MM-DD)
// Note: This relies on client time, ideally should match server timezone
const todayStr = new Date().toISOString().split('T')[0];
const historyRef = ref(db, `qms/locations/${locationId}/history/${todayStr}`);

let currentNumberData = null;
let historyData = {};

onValue(currentRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentNumberData = data;
        // Update UI
        currentNumEl.textContent = data.number;
        currentCounterEl.textContent = `Kaunter ${data.counter}`;

        const date = new Date(data.timestamp);
        lastUpdatedEl.textContent = `Updated: ${date.toLocaleTimeString()}`;

        // Check against user ticket
        checkIfMyTurn();
    }
});

onValue(historyRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        historyData = data;
        updateHistoryUI(data);
        checkIfMyTurn(); // Re-check in case user entered ticket after history load
    }
});

function updateHistoryUI(data) {
    // Convert object to array and sort by time (newest first)
    const calls = Object.entries(data).map(([number, info]) => ({
        number,
        ...info
    })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // 1. Update Preview (Last 3 excluding current if possible, but simplicity: just last 3)
    // Filter out the *absolute* current one if needed, but often showing it is fine.
    // Let's show the 3 most recent *previous* calls (skipping index 0 if it matches current)

    let recentCalls = calls;
    if (currentNumberData && calls.length > 0 && calls[0].number === currentNumberData.number) {
        recentCalls = calls.slice(1);
    }
    const previewItems = recentCalls.slice(0, 3);

    if (previewItems.length === 0) {
        recentCallsPreviewEl.innerHTML = '<span class="text-muted small fst-italic">No previous calls</span>';
    } else {
        recentCallsPreviewEl.innerHTML = previewItems.map(item => `
            <div class="badge bg-white text-dark border p-2">
                <div class="fs-6 fw-bold">${item.number}</div>
                <div class="micro-text text-muted" style="font-size:0.7rem">Kaunter ${item.counter}</div>
            </div>
        `).join('');
    }

    // 2. Update Full History Modal
    fullHistoryListEl.innerHTML = calls.map(item => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <span class="fw-bold fs-5">${item.number}</span>
                <small class="text-muted ms-2">Kaunter ${item.counter}</small>
            </div>
            <span class="badge bg-light text-dark">${item.time}</span>
        </div>
    `).join('');
}

function checkIfMyTurn() {
    const myTicket = myTicketInput.value.trim();
    if (!myTicket) return;

    // 1. Is it currently being called?
    if (currentNumberData && currentNumberData.number === myTicket) {
        notifyStatus.textContent = "NOMBOR GILIRAN ANDA TELAH DIPANGGIL";
        notifyStatus.style.color = "blue";
        notifyStatus.style.fontWeight = "bold";

        // Trigger local visual alert
        if (Notification.permission === "granted") {
            new Notification(`Nombor Anda Telah Dipanggil: ${currentNumberData.number}!`, {
                body: `Sila ke Kaunter ${currentNumberData.counter}`,
                icon: '/icon.png'
            });
        }
        return;
    }

    // 2. Was it called previously today?
    if (historyData[myTicket]) {
        const info = historyData[myTicket];
        notifyStatus.textContent = `⚠️ Nombor Anda ${myTicket} telah dipanggil pada ${info.time} (Kaunter ${info.counter}). Sila berhubung dengan staff kaunter.`;
        notifyStatus.style.color = "orange";
        notifyStatus.style.fontWeight = "bold";
        return;
    }

    // 3. Not called yet
    notifyStatus.textContent = "Waiting for your turn...";
    notifyStatus.style.color = "gray";
    notifyStatus.style.fontWeight = "normal";
}

// --- Notifications (FCM) ---
// Hook input change to re-check status
myTicketInput.addEventListener('input', checkIfMyTurn);

notifyBtn.addEventListener('click', async () => {
    if (!messaging) {
        notifyStatus.textContent = "Notifications are not supported in this browser/environment (HTTPS required).";
        notifyStatus.style.color = "orange";
        return;
    }

    const ticket = myTicketInput.value.trim();
    if (!ticket) {
        notifyStatus.textContent = "Please enter your ticket number first.";
        notifyStatus.style.color = "red";
        return;
    }

    try {
        notifyBtn.disabled = true;
        notifyBtn.textContent = "Requesting Permission...";

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Explicitly register Service Worker
            let registration;
            if ('serviceWorker' in navigator) {
                try {
                    // Register and wait for it to be ready (active)
                    await navigator.serviceWorker.register('./firebase-messaging-sw.js');
                    registration = await navigator.serviceWorker.ready;
                    console.log('Service Worker ready:', registration);
                } catch (err) {
                    console.error('Service Worker registration failed', err);
                }
            }

            // Get Token
            const token = await getToken(messaging, {
                vapidKey: "BI5NlMHQnr2thtyofNGpeUTmTj_2VCpTUmraEtiMkHULQzI5yNvWB1XGTtNIHXwBBl7oW_z8cSW-NTta2UCZITY",
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log("FCM Token:", token);
                // Save token to DB linked to ticket
                await saveTokenToDatabase(token, ticket);

                notifyStatus.textContent = `Notifications enabled for Ticket ${ticket}`;
                notifyStatus.style.color = "green";
                notifyBtn.textContent = "Notifications On ✅";
            } else {
                notifyStatus.textContent = "No registration token available.";
            }
        } else {
            notifyStatus.textContent = "Permission denied.";
            notifyBtn.disabled = false;
        }
    } catch (error) {
        console.error("An error occurred while retrieving token. ", error);
        notifyStatus.textContent = "Error enabling notifications.";
        notifyBtn.disabled = false;
    }
});

function saveTokenToDatabase(token, ticket) {
    const tokensRef = ref(db, `fcm_tokens/${locationId}/${ticket}`);
    return set(tokensRef, {
        token: token,
        timestamp: Date.now()
    });
}

// --- Foreground Message Handling ---
// --- Foreground Message Handling ---
if (messaging) {
    onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);

        const notificationTitle = payload.notification?.title || 'Permintaan Baru';
        const notificationOptions = {
            body: payload.notification?.body || '',
            tag: 'qms-notification',
            renotify: true,
            icon: '/icon.png',
            vibrate: [200, 100, 200, 100, 200], // Vibrate pattern: vibrate, pause, vibrate...
            requireInteraction: true // Keeps notification on screen until user interacts
        };

        // Use the Service Worker Registration to show the notification
        // This is more reliable on Android than 'new Notification()'
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(notificationTitle, notificationOptions);
            }).catch(err => {
                console.error('Error showing notification via SW:', err);
                // Fallback
                new Notification(notificationTitle, notificationOptions);
            });
        } else {
            new Notification(notificationTitle, notificationOptions);
        }

        // Update the UI text
        notifyStatus.textContent = `${notificationTitle}: ${notificationOptions.body}`;
        notifyStatus.style.color = "blue";
    });
}
