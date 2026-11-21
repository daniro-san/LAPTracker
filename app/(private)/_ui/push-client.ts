// The browser's side of notifications (D148): the desk's service worker, registered per workspace (scope
// /w/<slug>/), and this device's push subscription. Browser only. Sign-out uses `dropDevice` too.

/** Whether this browser can take notifications at all (iPhone: only once added to the Home Screen). */
export const canPush = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const scopeOf = (slug: string) => `/w/${slug}/`;

/** The workspace's service worker, registered (again) and active. */
export async function deskWorker(slug: string): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: scopeOf(slug) });
  return navigator.serviceWorker.ready;
}

/** This device's subscription for the workspace, without registering anything; null when none. */
export async function currentSubscription(slug: string): Promise<PushSubscription | null> {
  if (!canPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration(scopeOf(slug));
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** sha256 of the endpoint as parsed, hex: how the server's row for this device is named (lib/push.ts). */
export async function endpointHash(endpoint: string): Promise<string> {
  const text = new TextEncoder().encode(new URL(endpoint).href);
  const digest = await crypto.subtle.digest("SHA-256", text);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const keyBytes = (base64url: string) => {
  const text = atob(base64url.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
};

/**
 * A fresh subscription on the site's key. One the server does not know (another key, or deleted after the
 * push service said it was gone) is dropped first, so the new one is on the current key.
 */
export async function subscribe(slug: string, publicKey: string): Promise<PushSubscription> {
  const reg = await deskWorker(slug);
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
}

/** The endpoint and keys only, as the server checks them. */
export function subscriptionBody(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  };
}

/**
 * The desk's language switched (D148): this device's notifications follow, when it has them. The workspace
 * is the page's own (/w/<slug>/…); nothing happens anywhere else, and a refusal changes nothing.
 */
export async function followLanguage(language: string): Promise<void> {
  const slug = /^\/w\/([a-z0-9][a-z0-9-]*)/.exec(window.location.pathname)?.[1];
  const sub = slug ? await currentSubscription(slug).catch(() => null) : null;
  if (!slug || !sub) return;
  await fetch(`/api/w/${slug}/push`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "language", endpoint: sub.endpoint, language }),
  }).catch(() => null);
}

/** Sign-out on this device: its subscription ends here, and its endpoint goes to the server with the sign-out. */
export async function dropDevice(slug: string): Promise<string | undefined> {
  try {
    const sub = await currentSubscription(slug);
    if (!sub) return undefined;
    const { endpoint } = sub;
    await sub.unsubscribe();
    return endpoint;
  } catch {
    return undefined;
  }
}
