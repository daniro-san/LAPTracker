import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const valid = {
  LAP_API_KEY: "lap_test-placeholder",
  DATABASE_URL: "postgres://user:pw@localhost:5432/lap",
  CRON_SECRET: "x".repeat(32),
  EDIT_PIN: "123456",
  SERVER_TZ: "Etc/GMT+2",
  EVENT_WEEKDAY: "6",
  EVENT_TIME: "12:00",
  SNAPSHOT_BEFORE: "10:00",
  SNAPSHOT_AFTER: "14:00",
  SNAPSHOT_WINDOW_MIN: "45",
  QUOTA_CHECK_AT: "fri 20:00",
  NOTIFY_WEBHOOK_PUBLIC: "",
};

describe("parseEnv", () => {
  it("accepts the documented defaults and treats empty optionals as unset", () => {
    const env = parseEnv(valid);
    expect(env.EVENT_WEEKDAY).toBe(6);
    expect(env.NOTIFY_WEBHOOK_PUBLIC).toBeUndefined();
    // The host literal lives only in lib/env.ts (grep test in lib/sources), so assert the shape here.
    expect(new URL(env.LAP_API_BASE_URL).pathname).toBe("/v1");
    expect(new URL(env.LAP_SITE_BASE_URL).pathname).toBe("/api");
  });

  it("fails fast naming every bad key without echoing its value", () => {
    const secret = "not-a-lap-key-SECRETVALUE";
    const run = () =>
      parseEnv({ ...valid, LAP_API_KEY: secret, EDIT_PIN: "12", SERVER_TZ: "Mars/Olympus" });
    expect(run).toThrow(/LAP_API_KEY[\s\S]*EDIT_PIN[\s\S]*SERVER_TZ/);
    const message = (() => {
      try {
        run();
      } catch (error) {
        return String(error);
      }
      return "";
    })();
    expect(message).not.toContain(secret);
  });
});
