// 보임 알림 서비스 워커: 마감 1시간 전·30분 전 알림을 보여 주고, 누르면 그 업무를 연다.
self.addEventListener("push", (event) => {
  let data = { title: "보임", body: "마감이 가까운 업무가 있습니다.", url: "/", tag: "boim" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag, data: { url: data.url }, icon: "/icon-192.png", badge: "/icon-192.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const hit = all.find((c) => c.url === url);
    if (hit) return hit.focus();
    return clients.openWindow(url);
  })());
});
