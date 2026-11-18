// Events the server sends to PostHog (D115): route errors as codes, Groq calls as `$ai_generation` metadata,
// and Discord command counts. A closed list, each with properties that are codes, enums or numbers: no name,
// no text, no roster field, no member value, no secret. Production with POSTHOG_KEY only, as D77; anywhere
// else nothing is sent. Every event has the fixed distinct id `laptracker-server` (as D91's flag read) and no
// person profile. A failed or slow send is dropped: it never fails or holds up the request beyond SEND_MS.
import { analyticsKey } from "./events";
import { POSTHOG_INGEST_HOST } from "./region";

export const SERVER_DISTINCT_ID = "laptracker-server";
const SEND_MS = 2_000;

/** The Groq failure codes (lib/ai/groq.ts `ChatFailure`), which lib/analytics may not import. */
export type AiFailure = "timeout" | "busy" | "failed";

export interface ServerEvents {
  /** A route or render error (lib/app-errors.ts): the error's class name and where, never its message. */
  $exception: { name: string; kind: string; route: string };
  /** One Groq request (D81), privacy mode: no prompt and no output, only what it cost and how it went. */
  $ai_generation: {
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    fallback: boolean;
    error: AiFailure | null;
    traceId: string;
  };
  /** A Discord command the app accepted (D96, D101): which one. */
  discord_command_used: {
    command: "send_to_laptracker" | "translate_for_me" | "translate_for_everyone";
  };
}
export type ServerEvent = {
  [E in keyof ServerEvents]: { event: E; properties: ServerEvents[E] };
}[keyof ServerEvents];

type Wire = Record<string, string | number | boolean | null | object[]>;

/** The PostHog properties of one event; exported for the tests. */
export function wireProperties(e: ServerEvent): Wire {
  const base: Wire = { $process_person_profile: false, $lib: "laptracker-server" };
  switch (e.event) {
    case "$exception":
      return {
        ...base,
        $exception_list: [
          {
            type: e.properties.name,
            value: `${e.properties.kind} error`,
            mechanism: { handled: true, synthetic: false },
          },
        ],
        kind: e.properties.kind,
        route: e.properties.route,
      };
    case "$ai_generation": {
      const p = e.properties;
      return {
        ...base,
        $ai_provider: "groq",
        $ai_model: p.model,
        $ai_input_tokens: p.inputTokens,
        $ai_output_tokens: p.outputTokens,
        $ai_latency: p.latencyMs / 1000,
        $ai_is_error: p.error !== null,
        $ai_error: p.error,
        $ai_trace_id: p.traceId,
        fallback: p.fallback,
      };
    }
    case "discord_command_used":
      return { ...base, command: e.properties.command };
  }
}

export interface ServerAnalyticsEnv {
  VERCEL_ENV?: string | undefined;
  POSTHOG_KEY?: string | undefined;
  [name: string]: unknown;
}

/** Sends the events in one batch; resolves either way. Does nothing when analytics is off. */
export async function captureServer(
  env: ServerAnalyticsEnv,
  fetcher: typeof fetch,
  events: ServerEvent[],
  now: Date = new Date(),
): Promise<void> {
  const key = analyticsKey(env);
  if (!key || events.length === 0) return;
  const batch = events.map((e) => ({
    event: e.event,
    distinct_id: SERVER_DISTINCT_ID,
    timestamp: now.toISOString(),
    properties: wireProperties(e),
  }));
  try {
    await fetcher(`${POSTHOG_INGEST_HOST}/batch/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, batch }),
      signal: AbortSignal.timeout(SEND_MS),
    });
  } catch {
    // Analytics never breaks a request.
  }
}
