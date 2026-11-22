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

  it("reads SAMPLE_EVERY_MIN as 15 by default, accepts 0 (off) and 15, and rejects what is off the hour's grid", () => {
    expect(parseEnv(valid).SAMPLE_EVERY_MIN).toBe(15);
    expect(parseEnv({ ...valid, SAMPLE_EVERY_MIN: "15" }).SAMPLE_EVERY_MIN).toBe(15);
    expect(parseEnv({ ...valid, SAMPLE_EVERY_MIN: "0" }).SAMPLE_EVERY_MIN).toBe(0);
    expect(() => parseEnv({ ...valid, SAMPLE_EVERY_MIN: "7" })).toThrow(/SAMPLE_EVERY_MIN/);
    expect(() => parseEnv({ ...valid, SAMPLE_EVERY_MIN: "61" })).toThrow(/SAMPLE_EVERY_MIN/);
  });

  it.each([
    ["CRON_SECRET", "local-placeholder-cron-secret-0123456789"],
    ["EDIT_PIN", "000000"],
  ])(
    "refuses the public %s placeholder in production, naming the key and not the value",
    (key, value) => {
      const production = {
        ...valid,
        [key]: value,
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      };
      expect(() => parseEnv(production)).toThrow(new RegExp(`${key}: .*not allowed in production`));
      expect(() => parseEnv(production)).not.toThrow(new RegExp(value));
      // The same value is fine on a preview, locally and in tests.
      expect(() => parseEnv({ ...production, VERCEL_ENV: "preview" })).not.toThrow();
      expect(() =>
        parseEnv({ ...production, NODE_ENV: "development", VERCEL_ENV: undefined }),
      ).not.toThrow();
    },
  );

  it("parses a non-placeholder EDIT_PIN and CRON_SECRET in production", () => {
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).not.toThrow();
  });

  it("guards only a production deployment: both halves of the condition are needed", () => {
    const placeholders = {
      ...valid,
      CRON_SECRET: "local-placeholder-cron-secret-0123456789",
      EDIT_PIN: "000000",
    };
    // A production build on a preview or an unset deployment (`next start` locally).
    expect(() => parseEnv({ ...placeholders, NODE_ENV: "production" })).not.toThrow();
    expect(() =>
      parseEnv({ ...placeholders, NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).not.toThrow();
    // The production deployment flag without a production build (`vercel dev`).
    expect(() =>
      parseEnv({ ...placeholders, NODE_ENV: "development", VERCEL_ENV: "production" }),
    ).not.toThrow();
  });
});
