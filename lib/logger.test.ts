import { describe, expect, it } from "vitest";

import { secretsOf } from "./app-context";
import { TEST_ENV, TEST_PIN } from "./app-context.test-helpers";
import { runSnapshot } from "./collector";
import { ago, EVENT_ID, fakeV1, makeDeps, minutes, roster, T0 } from "./collector.test-helpers";
import { createRunLogger, MAX_RUN_LOG_LINES } from "./logger";
import { REDACTED } from "./redact";
import type { RunLogLine } from "./repo/run-logs";

function recordingLogger() {
  const lines: RunLogLine[] = [];
  const logger = createRunLogger(
    { insertRunLog: async (line) => void lines.push(line) },
    { snapshotId: () => 7, secrets: secretsOf(TEST_ENV), now: () => T0 },
  );
  return { logger, lines };
}

describe("createRunLogger", () => {
  it("stops at the 400th line, which is log.capped, and writes nothing after it", async () => {
    const { logger, lines } = recordingLogger();

    for (let i = 0; i < MAX_RUN_LOG_LINES + 50; i++) await logger.info("v1.fetch", { n: i });

    expect(lines).toHaveLength(MAX_RUN_LOG_LINES);
    expect(lines.at(-2)).toMatchObject({ code: "v1.fetch", data: { n: MAX_RUN_LOG_LINES - 2 } });
    expect(lines.at(-1)).toMatchObject({ code: "log.capped", data: { max: MAX_RUN_LOG_LINES } });
    expect(lines.filter((l) => l.code === "log.capped")).toHaveLength(1);
    expect(logger.stats()).toEqual({ failedWrites: 0, droppedLines: 51 });
  });

  it("never throws when its repo throws, and the run it logs still completes", async () => {
    const logger = createRunLogger(
      {
        insertRunLog: async () => {
          throw new Error("connection terminated");
        },
      },
      { snapshotId: () => 1, secrets: [], now: () => T0 },
    );
    const { deps } = makeDeps(fakeV1((id) => roster(id, ago(T0, minutes(1)))));

    await expect(logger.error("abort", { reason: "x" })).resolves.toBeUndefined();
    const summary = await runSnapshot(EVENT_ID, "before", { ...deps, logger });
    await logger.shutdown();

    expect(summary.status).toBe("complete");
    expect(logger.stats().failedWrites).toBeGreaterThan(20);
  });

  it("redacts a value equal to EDIT_PIN wherever it appears in data", async () => {
    const { logger, lines } = recordingLogger();

    await logger.warn("auth", { header: TEST_PIN, note: `pin=${TEST_PIN};`, nested: [TEST_PIN] });

    expect(JSON.stringify(lines)).not.toContain(TEST_PIN);
    expect(lines[0]?.data).toEqual({
      header: REDACTED,
      note: `pin=${REDACTED};`,
      nested: [REDACTED],
    });
  });
});
