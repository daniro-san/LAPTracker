// Events the server sends to PostHog (D115): server errors, Groq calls as `$ai_generation` metadata, Discord
// command counts, the desk's writes (`ws_action`), and the sign-in's start and failures (issue 781). A closed list, each with properties that are codes,
// enums or numbers: no name, no text, no roster field, no member value, no secret. The one text is
// `$exception`'s message and frames, which pass redact(), redactPrivate and scrubMessage first. Production with
// POSTHOG_KEY only, as D77; anywhere else nothing is sent. Events have the fixed distinct id
// `laptracker-server` (as D91's flag read) and no person profile, except `ws_action`, which belongs to the
// officer's pseudonymous id (lib/analytics/person.ts), the same one the desk's page identifies, so funnels
// can mix the browser's events and the server's. Events from a workspace say which one (issue 452): its slug
// and its alliance's public tag, never a person. A failed or slow send is dropped: it never fails or holds up
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
  // D129: Alliance settings → Discord (the bot and commands check, the two webhooks and their test).
  "discord",
  // D126: the owner's switches, caps and pauses on /admin (no person: `area` is `admin`).
  "features",
  // D137: Alliance settings → Raid Shield check (the morning read's time and the leaders' message).
  "raid_prep",
  // D142: a member's "This is me" approved or removed by an officer.
  "member_link",
  // D154: what a member sent about themselves, put on the card ("accept") or marked seen ("mark").
  "self_report",
  // Issue 486: the invite's "finish" made the workspace (the setup funnel's first step).
  "workspace",
  // D148: Alliance settings → Notifications (a device turned on, its uses changed, turned off).
  "push",
  // D156: Alliance settings → Your line on our posts (one post's line changed). Never the text.
  "post_callout",
  // D159: Alliance settings → Posts (a catalog post turned on or off, or its settings saved), with `post`.
  "posts",
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
  "turn_on",
  "turn_off",
  "cap",
  "copy",
  "pause",
  "resume",
  // D134: an /admin value back to its default, and a default for new alliances changed.
  "reset",
  "default",
  "check",
  "test",
  // D137: Raid prep's "Accept the tracker's".
  "accept",
  // Issue 486: a workspace made from an invite.
  "create",
] as const;
export type DeskAction = (typeof DESK_ACTIONS)[number];

/** Where a Follow-up record was made (issue 516): the Follow-up tab or a member card. */
export const DESK_FROM = ["follow_up", "card"] as const;
export type DeskFrom = (typeof DESK_FROM)[number];

/** A Follow-up record's or undo's place, and whether the member was on the week's list (issue 516). */
export interface DeskPlace {
  from: DeskFrom;
  on_list: boolean;
}

/** The catalog's posts (D159, `CATALOG_POSTS` in lib/schema-discord.ts): `posts` events say which one. */
export const DESK_POSTS = ["week", "shield_up", "welcome", "summary", "kvk"] as const;
export type DeskPost = (typeof DESK_POSTS)[number];

/** Where a Discord sign-in started (issue 781): a workspace's own button, or the chooser at /w (D131). */
export type SignInVia = "workspace" | "chooser";

/**
 * Why a sign-in ended without a session (issue 781): the callback's refusals, the sign-in page's `e` codes
 * and the no-access page's reasons (`NoAccess` in lib/private/sign-in.ts, which this module may not import).
 */
export const SIGN_IN_FAILURES = [
  "rate_limited",
  "bad_state",
  "not_configured",
  "denied",
  "discord",
  "none",
  "not_member",
  "no_role",
  "board_closed",
  "allowlist_expired",
  "blocked",
] as const;
export type SignInFailure = (typeof SIGN_IN_FAILURES)[number];

/**
 * Which alliance an event came from (issue 452): the workspace's slug and its alliance's public tag (null
 * when the caller has no label for it, D133). Neither is personal data. No PostHog groups (a paid add-on).
 */
export interface EventWorkspace {
  workspace: string;
  alliance: string | null;
}

export function eventWorkspace(w: {
  slug: string;
  alliance?: { tag: string | null } | null;
}): EventWorkspace {
  return { workspace: w.slug, alliance: w.alliance?.tag ?? null };
}

export interface ServerEvents {
  /**
   * A server error (lib/report-error.ts, D115's 2026-11-21 amendment): its class, its message and stack frames
   * after redact(), redactPrivate and scrubMessage, where (`kind`, the route pattern, the desk's or /admin's
   * `section`), and whether our code caught it (`handled`). Never a request body, query string or user text.
   */
  $exception: {
    name: string;
    kind: string;
    route: string;
    message: string;
    /** The redacted frames, one `at …` per line, innermost first, as AppErrorDetail keeps them. */
    stack?: string;
    handled: boolean;
    section?: string;
    /** The footer's version (D59): `v5.70.0` on production, the branch elsewhere (issue 781). */
    release?: string;
    /** The deployment's commit SHA (issue 781). */
    commit?: string;
  };
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
  /** The sign-in button sent the browser to Discord (issue 781); `silent`: the renewal that asks nothing (D99). */
  ws_sign_in_started: { via: SignInVia; silent: boolean };
  /** A sign-in that came back without a session (issue 781): a reason code only, never who. */
  ws_sign_in_failed: { via: SignInVia; reason: SignInFailure };
  /** A desk write that went through (lib/private/desk-action.ts): which feature, which action. */
  ws_action: { feature: DeskFeature; action: DeskAction } & Partial<DeskPlace> & {
      post?: DeskPost;
    };
}
export type ServerEvent = {
  [E in keyof ServerEvents]: {
    event: E;
    properties: ServerEvents[E];
    /** `ws_action` only: the officer's pseudonymous id; none for the owner's /admin changes (D126). */
    person?: string;
  } & (E extends "ws_action"
    ? // An officer's write names its workspace; the owner's /admin change (D126, no person) names the
      // workspace it changed, and a global pause none.
      { person: string; where: EventWorkspace } | { person?: undefined; where?: EventWorkspace }
    : // `$exception` under /w/[slug] or /api/w/[slug]; `$ai_generation` for a workspace's request;
      // `discord_command_used` from a workspace's Discord server.
      { where?: EventWorkspace });
}[keyof ServerEvents];

type Wire = Record<string, string | number | boolean | null | object[]>;

/** The PostHog properties of one event, with its `workspace` and `alliance` when it has them; for the tests. */
export function wireProperties(e: ServerEvent): Wire {
  return { ...ownProperties(e), ...e.where };
}

/** `$exception`'s own properties, in PostHog's error tracking format as posthog-js and posthog-node build it. */
function exceptionProperties(p: ServerEvents["$exception"]): Wire {
  const frames = p.stack ? stackFrames(p.stack) : [];
  return {
    $exception_list: [
      {
        type: p.name,
        value: p.message,
        mechanism: { handled: p.handled, synthetic: false, type: "generic" },
        ...(frames.length > 0 && { stacktrace: { type: "raw", frames } }),
      },
    ],
    $exception_level: "error",
    kind: p.kind,
    route: p.route,
    ...(p.section && { section: p.section }),
    ...(p.release && { release: p.release }),
    ...(p.commit && { commit: p.commit }),
  };
}

function ownProperties(e: ServerEvent): Wire {
  const base: Wire = { $process_person_profile: false, $lib: "laptracker-server" };
  switch (e.event) {
    case "$exception":
      return { ...base, ...exceptionProperties(e.properties) };
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
    case "ws_sign_in_started":
      return { ...base, via: e.properties.via, silent: e.properties.silent };
    case "ws_sign_in_failed":
      return { ...base, via: e.properties.via, reason: e.properties.reason };
    case "ws_action":
      // The owner's /admin changes (D126) carry no person: the server's fixed id, `area` admin.
      if (!e.person) {
        const { feature, action } = e.properties;
        return { $lib: "laptracker-server", area: "admin", feature, action };
      }
      // On the officer's person (no `$set`): the same person the desk's page identifies.
      return {
        $lib: "laptracker-server",
        area: "workspace",
        feature: e.properties.feature,
        action: e.properties.action,
        tier: "officer",
        // Issue 516: Follow-up's records only, two closed values.
        ...(e.properties.from && { from: e.properties.from }),
        ...(e.properties.on_list !== undefined && { on_list: e.properties.on_list }),
        // D159: which catalog post, one closed value.
        ...(e.properties.post && { post: e.properties.post }),
      };
  }
}

/** `at fn (file:line:col)`, `at file:line:col`, `at async fn (…)`, `at fn (native)`. */
const FRAME = /^at (?:async )?(?:(.+?) \()?(.+?)(?::(\d+):(\d+))?\)?$/;

const fileOf = (line: string) => FRAME.exec(line.trim())?.[2]?.replace(/^file:\/\//, "");

/**
 * Each chunk's PostHog chunk id by its file. The build's posthog-cli (scripts/sourcemaps.ts) puts a snippet
 * in every server chunk that, when the chunk loads, keeps its id under the stack of an Error made there; the
 * stack's first frame is the chunk's own file. As @posthog/core's `getFilenameToChunkIdMap`.
 */
function chunkIds(): Map<string, string> {
  const injected = (globalThis as { _posthogChunkIds?: Record<string, string> })._posthogChunkIds;
  const ids = new Map<string, string>();
  for (const [stack, id] of Object.entries(injected ?? {})) {
    const file = stack.split("\n").map(fileOf).find(Boolean);
    if (file) ids.set(file, id);
  }
  return ids;
}

/**
 * Node's `at …` lines as PostHog's raw frames (the fields of @posthog/core's node parser), outermost first as
 * PostHog orders them. A frame on an absolute path outside node_modules is the app's. A frame in a chunk the
 * build uploaded a map for carries its `chunk_id`, which PostHog resolves to our file, line and function.
 */
export function stackFrames(stack: string): object[] {
  const ids = chunkIds();
  return stack
    .split("\n")
    .flatMap((line) => {
      const m = FRAME.exec(line.trim());
      if (!m) return [];
      const filename = m[2]?.replace(/^file:\/\//, "");
      const chunk = filename && ids.get(filename);
      return [
        {
          platform: "node:javascript",
          function: m[1] ?? "?",
          ...(filename && { filename }),
          ...(m[3] && { lineno: Number(m[3]), colno: Number(m[4]) }),
          in_app: !!filename?.startsWith("/") && !filename.includes("/node_modules/"),
          ...(chunk && { chunk_id: chunk }),
        },
      ];
    })
    .reverse();
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
