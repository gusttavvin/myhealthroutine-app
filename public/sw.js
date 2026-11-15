// Service worker da versão funcional: mostra os avisos (push) mesmo com o app fechado.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = { title: "MyHealthRoutine", body: "Abra o aplicativo para ver o aviso." };
      try {
        const sub = await self.registration.pushManager.getSubscription();
        const res = await fetch("/api/push/latest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub ? sub.endpoint : "" }),
        });
        if (res.ok) data = await res.json();
      } catch (e) {
        /* sem internet: mostra o aviso genérico */
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [300, 120, 300, 120, 300],
        tag: "myhealthroutine",
        renotify: true,
        requireInteraction: true,
        data: { url: "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
