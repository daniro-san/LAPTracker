// Events the server sends to PostHog (D115): route errors as codes, Groq calls as `$ai_generation` metadata,
// Discord command counts, and the desk's writes (`ws_action`). A closed list, each with properties that are
// codes, enums or numbers: no name, no text, no roster field, no member value, no secret. Production with
// POSTHOG_KEY only, as D77; anywhere else nothing is sent. Events have the fixed distinct id
// `laptracker-server` (as D91's flag read) and no person profile, except `ws_action`, which belongs to the
// officer's pseudonymous id (lib/analytics/person.ts), the same one the desk's page identifies, so funnels
// can mix the browser's events and the server's. A failed or slow send is dropped: it never fails or holds up
// the request beyond SEND_MS.
import { after } from "next/server";

import { analyticsKey } from "./events";
import { POSTHOG_INGEST_HOST } from "./region";

export const SERVER_DISTINCT_ID = "laptracker-server";
const SEND_MS = 2_000;

/** The Groq failure codes (lib/ai/groq.ts `ChatFailure`), which lib/analytics may not import. */
export type AiFailure = "timeout" | "busy" | "failed";

/** The desk's features that write (docs/analytics/tracking-plan.md, "Desk actions"). */
export const DESK_FEATURES = [
  "calendar",
  "theft",
  "roll_call",
  "follow_up",
  "new_member",
  "member_facts",
  "sheet_import",
  "notice",
  "notice_ai",
  "notice_review",
  "notice_publish",
  "screenshot",
  "screenshot_draft",
  "start_here",
  "profile",
  "thanks",
  "garrison",
  "tracker_key",
  "workspace_data",
] as const;
export type DeskFeature = (typeof DESK_FEATURES)[number];

/** What was done: the route's own action, as one word from this list. */
export const DESK_ACTIONS = [
  "add",
  "edit",
  "delete",
  "save",
  "discard",
  "retype",
  "read_text",
  "paste",
  "mark",
  "rest",
  "undo",
  "team",
  "record",
  "link",
  "unlink",
  "rename",
  "ask",
  "approve",
  "publish",
  "share",
  "take_down",
  "restore",
  "undo_delete",
  "archive",
  "unarchive",
  "draft",
  "translate",
  "improve",
  "fit",
  "import",
  "picture_add",
  "picture_remove",
  "picture_keep",
  "picture_unkeep",
  "picture_download",
  "picture_reuse",
  "download",
  "cancel",
] as const;
export type DeskAction = (typeof DESK_ACTIONS)[number];

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
  /** A desk write that went through (lib/private/desk-action.ts): which feature, which action. */
  ws_action: { feature: DeskFeature; action: DeskAction };
}
export type ServerEvent = {
  [E in keyof ServerEvents]: {
    event: E;
    properties: ServerEvents[E];
    /** `ws_action` only: the officer's pseudonymous id. */
    person?: string;
  };
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
    case "ws_action":
      // On the officer's person (no `$set`): the same person the desk's page identifies.
      return {
        $lib: "laptracker-server",
        area: "workspace",
        feature: e.properties.feature,
        action: e.properties.action,
        tier: "officer",
      };
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
    distinct_id: e.person ?? SERVER_DISTINCT_ID,
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

/** Runs `send` after the response (`after`); outside a request (instrumentation, tests) it just starts it. */
export function sendLater(send: () => Promise<void>): void {
  try {
    after(send);
  } catch {
    void send();
  }
}
