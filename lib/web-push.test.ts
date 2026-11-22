// The Web Push protocol (D148): RFC 8291's own test vector, a VAPID header a push service can verify, the
// push services allowed, and what a push service's answer means. No real push service is called.
import { createPublicKey, randomBytes, verify } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { encryptPayload, newVapidKeys, pushHost, sendPush, vapidAuthorization } from "./web-push";

const b = (s: string) => Buffer.from(s, "base64url");

describe("encryptPayload (RFC 8291, Appendix A)", () => {
  it("gives the RFC's body for its keys, salt and plaintext", () => {
    const body = encryptPayload(
      {
        endpoint: "https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV",
        keys: {
          p256dh:
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          auth: "BTBZMqHH6r4Tts7J_aSIgg", // gitleaks:allow (RFC 8291's published test vector)
        },
      },
      b("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
      {
        salt: b("DGv6ra1nlYgDCS1FRnbzlw"),
        ephemeralPrivate: b("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
      },
    );
    const header = b(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
    );
    const record = b(
      "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
    );
    expect(body.toString("base64url")).toBe(Buffer.concat([header, record]).toString("base64url"));
  });
});

describe("vapidAuthorization (RFC 8292)", () => {
  it("signs a JWT for the push service's origin that verifies with the public key it names", () => {
    const keys = newVapidKeys();
    const now = new Date("2026-11-21T12:00:00Z");
    const auth = vapidAuthorization(
      { ...keys, subject: "mailto:owner@example.com" },
      "https://fcm.googleapis.com/fcm/send/abc",
      now,
    );
    const [, jwt = "", k = ""] = /^vapid t=([^,]+), k=(.+)$/.exec(auth) ?? [];
    expect(k).toBe(keys.publicKey);
    const [h = "", c = "", s = ""] = jwt.split(".");
    const claims = JSON.parse(b(c).toString()) as Record<string, unknown>;
    expect(claims).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now.getTime() / 1000 + 12 * 3600,
      sub: "mailto:owner@example.com",
    });
    const point = b(keys.publicKey);
    const key = createPublicKey({
      format: "jwk",
      key: {
        kty: "EC",
        crv: "P-256",
        x: point.subarray(1, 33).toString("base64url"),
        y: point.subarray(33).toString("base64url"),
      },
    });
    const signed = Buffer.from(`${h}.${c}`);
    expect(verify("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, b(s))).toBe(true);
  });
});

describe("pushHost", () => {
  it("accepts the browsers' push services and refuses any other host, scheme or port", () => {
    expect(pushHost("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(pushHost("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(pushHost("https://web.push.apple.com/x")).toBe(true);
    expect(pushHost("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(pushHost("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(pushHost("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(pushHost("https://evilfcm.googleapis.com.example.com/x")).toBe(false);
    expect(pushHost("https://169.254.169.254/latest")).toBe(false);
    expect(pushHost("not a url")).toBe(false);
  });
});

describe("sendPush", () => {
  const keys = newVapidKeys();
  const vapid = { ...keys, subject: "mailto:owner@example.com" };
  const browser = newVapidKeys();
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: browser.publicKey, auth: randomBytes(16).toString("base64url") },
  };
  it("reads 201 as ok, 404 and 410 as gone, anything else or no answer as failed", async () => {
    const answer = (status: number) =>
      vi.fn<typeof fetch>(async () => new Response(null, { status }));
    const now = new Date("2026-11-21T01:31:00Z"); // Fri 23:31 ST
    expect(await sendPush(answer(201), vapid, sub, "{}", now)).toBe("ok");
    expect(await sendPush(answer(404), vapid, sub, "{}", now)).toBe("gone");
    expect(await sendPush(answer(410), vapid, sub, "{}", now)).toBe("gone");
    expect(await sendPush(answer(500), vapid, sub, "{}", now)).toBe("failed");
    const down = vi.fn<typeof fetch>(async () => Promise.reject(new Error("timeout")));
    expect(await sendPush(down, vapid, sub, "{}", now)).toBe("failed");
  });
});
