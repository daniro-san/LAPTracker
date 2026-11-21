// The server's PostHog events (D115), with a stand-in fetch: nothing leaves the machine.
import { describe, expect, it, vi } from "vitest";

import {
  captureServer,
  eventWorkspace,
  SERVER_DISTINCT_ID,
  wireProperties,
  type ServerEvent,
} from "./server";

const ON = { VERCEL_ENV: "production", POSTHOG_KEY: "phc_test" };
const EVENTS: ServerEvent[] = [
  {
    event: "$exception",
    properties: {
      name: "TypeError",
      kind: "render",
      route: "/w/[slug]",
      message: "Cannot read properties of undefined (reading 'map')",
      stack:
        "at render (/var/task/.next/server/app/page.js:1:2045)\nat async Page (node:internal/x:3:4)",
      handled: false,
      section: "home",
    },
  },
  {
    event: "$ai_generation",
    properties: {
      model: "openai/gpt-oss-120b",
      inputTokens: 210,
      outputTokens: 95,
      latencyMs: 840,
      fallback: false,
      error: null,
      traceId: "t-1",
    },
  },
  { event: "discord_command_used", properties: { command: "translate_for_me" } },
];

describe("server events (D115)", () => {
  it("send one batch with the fixed id and no person, only when analytics is on", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"));
    await captureServer({ VERCEL_ENV: "preview", POSTHOG_KEY: "phc_test" }, fetcher, EVENTS);
    await captureServer({ VERCEL_ENV: "production" }, fetcher, EVENTS);
    expect(fetcher).not.toHaveBeenCalled();
    await captureServer(ON, fetcher, EVENTS, new Date("2026-11-17T10:00:00Z"));
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://us.i.posthog.com/batch/");
    const body = JSON.parse(String(init?.body)) as {
      api_key: string;
      batch: { distinct_id: string; properties: Record<string, unknown> }[];
    };
    expect(body.api_key).toBe("phc_test");
    expect(body.batch.map((e) => e.distinct_id)).toEqual(Array(3).fill(SERVER_DISTINCT_ID));
    expect(body.batch.every((e) => e.properties.$process_person_profile === false)).toBe(true);
  });

  it("never fail the caller when PostHog does not answer", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Promise.reject(new Error("down")));
    await expect(captureServer(ON, fetcher, EVENTS)).resolves.toBeUndefined();
  });

  it("carry codes, enums and counts only: an AI generation has no prompt or output; an error is PostHog's shape", () => {
    const [error, ai, command] = EVENTS.map(wireProperties);
    expect(ai).toEqual({
      $process_person_profile: false,
      $lib: "laptracker-server",
      $ai_provider: "groq",
      $ai_model: "openai/gpt-oss-120b",
      $ai_input_tokens: 210,
      $ai_output_tokens: 95,
      $ai_latency: 0.84,
      $ai_is_error: false,
      $ai_error: null,
      $ai_trace_id: "t-1",
      fallback: false,
    });
    for (const key of ["$ai_input", "$ai_output_choices", "$ai_output", "$ai_base_url"]) {
      expect(ai).not.toHaveProperty(key);
    }
    // The message arrives already redacted and scrubbed (lib/app-errors.ts); frames outermost first.
    expect(error).toMatchObject({
      $exception_list: [
        {
          type: "TypeError",
          value: "Cannot read properties of undefined (reading 'map')",
          mechanism: { handled: false, synthetic: false },
          stacktrace: {
            type: "raw",
            frames: [
              {
                platform: "node:javascript",
                function: "Page",
                filename: "node:internal/x",
                in_app: false,
              },
              {
                platform: "node:javascript",
                function: "render",
                filename: "/var/task/.next/server/app/page.js",
                lineno: 1,
                colno: 2045,
                in_app: true,
              },
            ],
          },
        },
      ],
      $exception_level: "error",
      kind: "render",
      route: "/w/[slug]",
      section: "home",
    });
    expect(command).toMatchObject({ command: "translate_for_me" });
  });

  it("say which workspace and alliance they came from, and only then (issue 452)", () => {
    const where = eventWorkspace({ slug: "ogs", alliance: { tag: "OGs" } });
    expect(where).toEqual({ workspace: "ogs", alliance: "OGs" });
    for (const e of EVENTS) expect(wireProperties({ ...e, where })).toMatchObject(where);
    for (const props of EVENTS.map(wireProperties)) {
      expect(props).not.toHaveProperty("workspace");
      expect(props).not.toHaveProperty("alliance");
    }
  });
});
