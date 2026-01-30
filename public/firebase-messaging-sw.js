importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

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

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
