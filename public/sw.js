// Rumo: recebe os avisos e abre a tela certa ao tocar.
self.addEventListener("push", (e) => {
  let a = { title: "Rumo", body: "", url: "/hoje" };
  try { a = { ...a, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(a.title, { body: a.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: a.chave, data: { url: a.url } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/hoje";
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) { if ("focus" in c) { await c.focus(); return c.navigate(url); } }
    return self.clients.openWindow(url);
  })());
});
