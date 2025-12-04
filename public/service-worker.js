/* eslint-disable no-undef */

self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  if (!event.data) {
    console.log("No data in push event");
    return;
  }

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (error) {
    notificationData = {
      title: "Notification",
      body: event.data.text(),
    };
  }

  const options = {
    badge: "/icon-192x192.png",
    icon: "/icon-192x192.png",
    ...notificationData,
  };

  event.waitUntil(
    self.registration.showNotification(
      options.title || "Notification",
      options,
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    }),
  );
});
