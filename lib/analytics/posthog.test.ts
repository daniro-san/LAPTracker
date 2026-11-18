// The browser SDK's start (D115), with posthog-js replaced: a page load that starts on a public page is
// cookieless, sends to /ingest/c, and is never recorded, even after it moves to the desk.
import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));
vi.mock("posthog-js/no-external", () => ({ default: sdk }));
vi.mock("posthog-js/dist/exception-autocapture", () => ({}));
vi.mock("posthog-js/dist/posthog-recorder", () => ({}));

afterEach(() => vi.unstubAllGlobals());

describe("startPostHog (D115)", () => {
  it("starts a public page load cookieless, on its own path, and never records it", async () => {
    vi.stubGlobal("location", { pathname: "/players" });
    const { followPath, startPostHog } = await import("./posthog");
    const ph = startPostHog("phc_test");
    expect(sdk.init.mock.calls[0]?.[1]).toMatchObject({
      cookieless_mode: "always",
      api_host: "/ingest/c",
      persistence: "memory",
    });
    followPath(ph, "/players");
    followPath(ph, "/w/ogs/members");
    await new Promise((r) => setTimeout(r, 0));
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
  });
});
