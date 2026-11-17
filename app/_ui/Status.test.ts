import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { en } from "@/lib/copy";

import { makeClock, type Clock } from "./format";
import { CaptureWindow, Legend, NextUpdate, StatusChips, type PhaseStatus } from "./Status";

const clock = { at: () => "Nov 7, 10:00" } as unknown as Clock;
const now = new Date("2026-11-07T15:01:00Z");
const html = (manual: boolean) =>
  renderToStaticMarkup(
    createElement(NextUpdate, {
      at: new Date("2026-11-07T10:00:00Z"),
      manual,
      clock,
      copy: en,
    }),
  );
const counts = (stale: number, failed: number) =>
  renderToStaticMarkup(
    createElement(StatusChips, { phases: [], stale, failed, now, clock, copy: en }),
  );

describe("StatusChips", () => {
  it("counts stale and failed rows apart, each only when there are some", () => {
    const text = counts(2, 1);
    expect(text).toContain("2 stale");
    expect(text).toContain("1 failed");
    expect(counts(0, 0)).not.toMatch(/stale|failed/);
    expect(counts(0, 3)).not.toContain("stale");
  });
});

describe("StatusChips, running", () => {
  const chip = (phases: PhaseStatus[], at = now) =>
    renderToStaticMarkup(
      createElement(StatusChips, { phases, stale: 0, failed: 0, now: at, clock, copy: en }),
    );
  it("shows the Updating now chip while a phase runs, and Not updated yet with no phase", () => {
    const running = [phase("after", "running", "2026-11-07T15:00Z")];
    expect(chip(running)).toContain("Updating now");
    expect(chip([])).toContain("Not updated yet");
  });

  it("says the update failed once a run is left running past RUN_STALE_AFTER_MS", () => {
    const running = [phase("after", "running", "2026-11-07T15:00Z")];
    // 2 min 29 s after its start the run may still finish; at 2 min 30 s it was killed.
    expect(chip(running, new Date("2026-11-07T15:02:29Z"))).toContain("Updating now");
    const stale = chip(running, new Date("2026-11-07T15:02:30Z"));
    expect(stale).toContain("Last update failed at Nov 7, 10:00");
    expect(stale).not.toContain("Updating now");
  });
});

describe("NextUpdate", () => {
  it("says a manual round is run by hand instead of naming the next scheduled update", () => {
    expect(html(false)).toContain("Next update at Nov 7, 10:00");
    const manual = html(true);
    expect(manual).toContain("Run by hand by the admin");
    expect(manual).not.toContain("Next update");
  });
});

// Server time is UTC−2: 12:00Z reads 10:00, 15:01Z reads 13:01.
const phase = (phase: PhaseStatus["phase"], status: PhaseStatus["status"], at: string) => ({
  phase,
  status,
  startedAt: new Date(at),
  finishedAt: status === "running" ? null : new Date(at),
});
const windowText = (before?: PhaseStatus, after?: PhaseStatus, at = now) =>
  renderToStaticMarkup(
    createElement(CaptureWindow, {
      before,
      after,
      now: at,
      clock: makeClock("en", "Etc/GMT+2"),
      copy: en,
    }),
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("CaptureWindow", () => {
  it("shows when the Before and the After were taken, with the day only when they differ", () => {
    expect(
      windowText(
        phase("before", "complete", "2026-11-07T12:00Z"),
        phase("after", "partial", "2026-11-07T15:01Z"),
      ),
    ).toBe("Start 10:00 → End 13:01 server time");
    expect(
      windowText(
        phase("before", "complete", "2026-11-07T01:00Z"),
        phase("after", "complete", "2026-11-07T15:01Z"),
      ),
    ).toBe("Start Nov 6, 23:00 → End Nov 7, 13:01 server time");
  });

  it("shows a phase that has no time as its state's word, or — before it ran", () => {
    expect(windowText(phase("before", "complete", "2026-11-07T12:00Z"))).toBe(
      "Start 10:00 server time → End —",
    );
    expect(
      windowText(
        phase("before", "failed", "2026-11-07T12:00Z"),
        phase("after", "running", "2026-11-07T15:00Z"),
      ),
    ).toBe("Start failed → End Updating now");
  });

  it("shows an End left running past RUN_STALE_AFTER_MS as failed", () => {
    const start = phase("before", "complete", "2026-11-07T12:00Z");
    const end = phase("after", "running", "2026-11-07T15:00Z");
    expect(windowText(start, end, new Date("2026-11-08T09:00Z"))).toBe(
      "Start 10:00 server time → End failed",
    );
  });
});

describe("Legend", () => {
  it("lists the member-change item only when the page shows the mark", () => {
    expect(renderToStaticMarkup(createElement(Legend, { memberMark: true, copy: en }))).toContain(
      "Includes member changes",
    );
    expect(renderToStaticMarkup(createElement(Legend, { copy: en }))).not.toContain(
      "Includes member changes",
    );
  });
});
