import { describe, expect, it, vi } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { enableDevice } from "./PushSettings";

const t = WORKSPACE_DICTIONARIES.en;
const sub = {} as PushSubscription;

describe("Enable on this device (D148)", () => {
  it("says the push service refused when the browser's subscribe rejects, and saves nothing", async () => {
    let saved = false;
    const result = await enableDevice(
      () =>
        Promise.reject(new DOMException("Registration failed - push service error", "AbortError")),
      async () => {
        saved = true;
        return new Response(null, { status: 200 });
      },
      t,
    );
    expect(result).toEqual({ note: t["push.serviceRefused"] });
    expect(saved).toBe(false);
  });

  it("gives up after 20 s when the browser never answers, so the button comes back", async () => {
    vi.useFakeTimers();
    try {
      const pending = enableDevice(
        () => new Promise<PushSubscription>(() => {}),
        async () => new Response(null, { status: 200 }),
        t,
      );
      await vi.advanceTimersByTimeAsync(20_000);
      await expect(pending).resolves.toEqual({ note: t["push.timedOut"] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps 'Not saved' for a save to the server that fails", async () => {
    const result = await enableDevice(
      async () => sub,
      async () => new Response(null, { status: 500 }),
      t,
    );
    expect(result).toEqual({ note: t["push.failed"] });
  });

  it("is done when both steps go through", async () => {
    const result = await enableDevice(
      async () => sub,
      async () => new Response(null, { status: 200 }),
      t,
    );
    expect(result).toEqual({ done: true });
  });
});
