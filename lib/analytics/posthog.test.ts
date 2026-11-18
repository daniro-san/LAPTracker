// The browser SDK's start and the analytics question (D115), with posthog-js replaced by a stand-in that
// keeps the consent the way posthog-js does in "on_reject" mode: no answer counts as "no".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const state = { optedIn: false };
  const ph = {
    state,
    config: {} as Record<string, unknown>,
    init: vi.fn((_key: string, config: Record<string, unknown>) => {
      ph.config = { ...config };
    }),
    has_opted_in_capturing: () => state.optedIn,
    opt_in_capturing: vi.fn(() => {
      state.optedIn = true;
    }),
    opt_out_capturing: vi.fn(() => {
      state.optedIn = false;
    }),
    set_config: vi.fn((c: Record<string, unknown>) => Object.assign(ph.config, c)),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  };
  return ph;
});
vi.mock("posthog-js/no-external", () => ({ default: sdk }));
vi.mock("posthog-js/dist/exception-autocapture", () => ({}));
vi.mock("posthog-js/dist/posthog-recorder", () => ({}));

/** A fresh module on `path`, with this device's stored answer and a replay sample that always draws in. */
async function start(path: string, stored: string | null) {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.state.optedIn = false;
  const store = new Map(stored ? [["lap_analytics", stored]] : []);
  vi.stubGlobal("location", { pathname: path });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  vi.spyOn(Math, "random").mockReturnValue(0);
  const m = await import("./posthog");
  const ph = m.startPostHog("phc_test");
  return { m, ph, store };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("public page loads (D115)", () => {
  it("with no answer: on_reject with no answer as no, cookieless on /ingest/c, never recorded", async () => {
    const { m, ph } = await start("/players", null);
    expect(sdk.init.mock.calls[0]?.[1]).toMatchObject({
      cookieless_mode: "on_reject",
      opt_out_capturing_by_default: true,
      api_host: "/ingest/c",
    });
    expect(sdk.opt_in_capturing).not.toHaveBeenCalled();
    m.followPath(ph, "/players");
    m.followPath(ph, "/w/ogs/members");
    await settle();
    expect(sdk.startSessionRecording).not.toHaveBeenCalled();
  });

  it("after Allow on this device: opted in, events on /ingest, and the public page can be recorded", async () => {
    const { m, ph } = await start("/players", "granted");
    expect(sdk.opt_in_capturing).toHaveBeenCalled();
    expect(sdk.init.mock.calls[0]?.[1]).toMatchObject({ api_host: "/ingest" });
    m.followPath(ph, "/players");
    await settle();
    expect(sdk.startSessionRecording).toHaveBeenCalledWith(true);
  });

  it("answering on the bar: Allow opts in and is kept; No thanks opts out and stops recording", async () => {
    const { m, ph, store } = await start("/players", null);
    m.answerConsent(ph, "granted");
    expect(store.get("lap_analytics")).toBe("granted");
    expect(sdk.config.api_host).toBe("/ingest");
    m.answerConsent(ph, "denied");
    expect(store.get("lap_analytics")).toBe("denied");
    expect(sdk.opt_out_capturing).toHaveBeenCalled();
    expect(sdk.config.api_host).toBe("/ingest/c");
    expect(m.isCookieless(ph)).toBe(true);
  });
});

describe("desk and /admin page loads (D115)", () => {
  it("are unchanged: memory persistence, no consent mode, recorded", async () => {
    const { m, ph } = await start("/w/ogs/members", null);
    const config = sdk.init.mock.calls[0]?.[1];
    expect(config).toMatchObject({ persistence: "memory", api_host: "/ingest" });
    expect(config).not.toHaveProperty("cookieless_mode");
    m.followPath(ph, "/w/ogs/members");
    await settle();
    expect(sdk.startSessionRecording).toHaveBeenCalledWith(true);
  });
});
