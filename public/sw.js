// The Officers' Desk's service worker (D148): browser notifications only. It shows a push as a notification
// and opens, or focuses, the desk page it links to on a tap. It caches nothing and handles no fetch, so it
// changes nothing about how pages load. Registered per workspace (scope /w/<slug>/) from Alliance settings.
/* global self, URL */
"use strict";

self.addEventListener("install", () => self.skipWaiting());

/** The push's JSON ({title, body, url, tag}), or nothing usable. */
const read = (event) => {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
};

self.addEventListener("push", (event) => {
  const data = read(event);
  // Only a path on this site: a payload can never send the tap elsewhere.
  const url =
    typeof data.url === "string" && data.url.startsWith("/w/") ? data.url : self.registration.scope;
  const title = typeof data.title === "string" ? data.title : "Officers’ Desk";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/icon/192",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url ?? self.registration.scope,
    self.location.origin,
  );
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === target.href);
      return open ? open.focus() : self.clients.openWindow(target.href);
    }),
  );
});
