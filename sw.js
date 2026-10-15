// Order Desk — shows phone alerts (new orders, 6 pm summary) even when the app is closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body: e.data && e.data.text() }; }
  const show = self.registration.showNotification(m.title || "Order Desk", {
    body: m.body || "", tag: m.tag || undefined, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: m.url || "/#dashboard" },
  });
  const badge = self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([show, badge]));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/#dashboard", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) { c.navigate ? c.navigate(url).catch(() => {}) : 0; return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
