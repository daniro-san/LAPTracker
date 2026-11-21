// /admin's run watch (D141, issue 521): idle, it refreshes only while a tick's batch can run and from the
// next tick that can start a run on; while a run is in progress, every 4 s. The effect runs once here, with fake timers and a visible tab.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: <T>(current: T) => ({ current }),
}));

const { useRunWatch } = await import("./useRunWatch");

const run = { phase: "Before snapshot", event: "Manual round", startedText: "Thu 19:14" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { hidden: false, addEventListener() {}, removeEventListener() {} });
  refresh.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const at = (iso: string) => Date.parse(`2026-11-20T${iso}Z`);

describe("useRunWatch (D141)", () => {
  it("does not refresh an idle tab outside a tick's batch window", () => {
    vi.setSystemTime(at("10:05:30"));
    useRunWatch([], null, at("10:00:00"), () => {});
    vi.advanceTimersByTime(60_000); // 10:05:30 to 10:06:30: neither scheduler's window
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not refresh an idle tab in a window before the next tick that can start a run", () => {
    vi.setSystemTime(at("10:07:00"));
    useRunWatch([], null, at("11:30:00"), () => {});
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes an idle tab every 20 s inside the window from that tick on", () => {
    vi.setSystemTime(at("10:07:00")); // tick.yml's tick
    useRunWatch([], null, at("10:07:00"), () => {});
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("refreshes every 4 s while a run is going, whatever the clock", () => {
    vi.setSystemTime(at("10:05:30"));
    useRunWatch([run], null, null, () => {});
    vi.advanceTimersByTime(20_000);
    expect(refresh).toHaveBeenCalledTimes(5);
  });
});
