// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyAXLb4SeiBW0JBTXB6fYBsUG0qNNheNOG8",
  authDomain: "makmur-notification.firebaseapp.com",
  projectId: "makmur-notification",
  storageBucket: "makmur-notification.firebasestorage.app",
  messagingSenderId: "23412371407",
  appId: "1:23412371407:web:3c6bbdb8e077ec5a172cba",
  measurementId: "G-P2HYNVX50V"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/manifest-icon-192.png' // Adjust to your actual icon path
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
