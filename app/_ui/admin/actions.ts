// The /admin run buttons as data (plan Phase 4, D28): what each one calls, what it asks first and what
// it sends. The component that presses them is AdminActions.
import { copy, fill } from "@/lib/copy";

import { forgetPin } from "./PinSheet";
import { phaseWord } from "./words";

export interface Action {
  id:
    | "rehearse"
    | "before"
    | "after"
    | "manual-create"
    | "manual-rename"
    | "manual-settings"
    | "manual-before"
    | "manual-after"
    | "event-rename"
    | "daily-retry";
  /** One line under a snapshot button, and what it costs. */
  help?: string;
  cost?: string;
  /** On the seal; `name` is the accessible name when it differs. */
  label: string;
  name?: string;
  url: string;
  /** Asked before the call; none for a form the owner has just filled in. */
  confirm?: string;
  /** JSON sent with the request (the manual round's options). */
  body?: string;
  /** Sent right after this one succeeds (a rename, then the settings). */
  next?: Action;
  /** Sent with `force=1` from the first press: a done phase run again (D28, issue 157). */
  force?: boolean;
}

const t = copy.admin.run;
const m = copy.admin.manual;

export const SNAPSHOTS: Action[] = [
  {
    id: "before",
    label: copy.admin.seal.before,
    name: phaseWord("before"),
    help: t.snapshots.before,
    cost: t.snapshots.costOne,
    url: "/api/snapshot?phase=before",
    confirm: t.confirmBefore,
  },
  {
    id: "after",
    label: copy.admin.seal.after,
    name: phaseWord("after"),
    help: t.snapshots.after,
    cost: t.snapshots.costOne,
    url: "/api/snapshot?phase=after",
    confirm: t.confirmAfter,
  },
  {
    id: "rehearse",
    label: t.rehearse,
    help: t.snapshots.rehearse,
    cost: t.snapshots.costRehearse,
    url: "/api/rehearsal",
    confirm: t.confirmRehearse,
  },
];

/** The presses that run a read now (snapshots, the daily retry): the header's candle is lit while one
 * waits for its answer, before the poller sees the run. */
export const RUN_ACTIONS: ReadonlySet<string> = new Set<Action["id"]>([
  "before",
  "after",
  "manual-before",
  "manual-after",
  "daily-retry",
]);

/** Today's failed daily roster read, read again (D60 amendment). */
export const DAILY_RETRY: Action = {
  id: "daily-retry",
  label: t.daily.retry,
  cost: t.daily.cost,
  url: "/api/daily-read/retry",
  confirm: t.daily.confirm,
};

/** Today's daily read when it failed, in words, for the Retry card; null hides the card. */
export interface DailyFailedView {
  text: string;
}

/** The manual event's two snapshot buttons (D28): the same route, named by `event`. */
export const manualSnapshots = (eventId: number): Action[] =>
  (["before", "after"] as const).map((phase) => ({
    id: `manual-${phase}`,
    label: copy.admin.seal[phase],
    name: phaseWord(phase),
    help: m.sealHelp[phase],
    cost: t.snapshots.costOne,
    url: `/api/snapshot?phase=${phase}&event=${eventId}`,
    confirm: phase === "before" ? m.confirmBefore : m.confirmAfter,
  }));

/** A done phase of the round run again (issue 157): its one confirmation names what it replaces (the done
 * time) and the cost, then it sends `force`, which the route still requires for a re-run (D28). */
export const recordAgain = (a: Action, at: string): Action => ({
  ...a,
  confirm: fill(m.againConfirm, { seal: a.label, at }),
  force: true,
});

/** Renames a scheduled event (D39); the form is the confirmation. Same route as a round's rename. */
export const renameEvent = (eventId: number, name: string): Action => ({
  id: "event-rename",
  label: t.renameSave,
  url: "/api/manual-event/rename",
  body: JSON.stringify({ event_id: eventId, name }),
});

/** The newest manual round as /admin shows it: each phase that ran, with its state already in words. */
export interface RoundView {
  id: number;
  name: string;
  visibility: RoundOptions["visibility"];
  postPublic: boolean;
  calls: number;
  /** `at`: when the phase finished (or started, while it runs), in words. */
  phases: { phase: "before" | "after"; status: string; text: string; at: string }[];
}

/** The current scheduled event: its row (null until the scheduler makes it) and its time in words. */
export interface CurrentEventView {
  id: number | null;
  /** The name, which Rename starts from. */
  name: string;
  /** The heading: the name without a generated name's ISO date, which `stateText` carries. */
  title: string;
  /** Its date, age and the state of its two snapshots. */
  stateText: string;
  /** When its row appears, for the "rename later" line; null once that time has passed. */
  rowFromText: string | null;
}

/** A snapshot running now, in words: "Before snapshot", the event, "Thu, 19:14 server time". */
export interface RunningView {
  phase: string;
  event: string;
  startedText: string;
}

export interface RoundOptions {
  name: string;
  visibility: "admin" | "standalone" | "history";
  postPublic: boolean;
}

/** The new round's options as the create call (D28): no confirmation, the form is the confirmation. */
export const createRound = (o: RoundOptions): Action => ({
  id: "manual-create",
  label: m.create,
  url: "/api/manual-event",
  body: JSON.stringify({
    name: o.name,
    visibility: o.visibility,
    // "Only me" and a public Discord post cannot go together.
    post_public: o.visibility === "admin" ? false : o.postPublic,
  }),
});

/** What the card's form changed: a rename (only after the Before ran) and/or the visibility and Discord setting. */
export interface RoundChange {
  name?: string;
  visibility?: RoundOptions["visibility"];
  postPublic?: boolean;
}

export const saveRound = (eventId: number, change: RoundChange): Action => {
  const { name, visibility, postPublic } = change;
  const settings: Action | undefined =
    visibility === undefined && postPublic === undefined
      ? undefined
      : {
          id: "manual-settings",
          label: m.save,
          url: "/api/manual-event/settings",
          body: JSON.stringify({
            event_id: eventId,
            ...(visibility !== undefined && { visibility }),
            ...(visibility === "admin"
              ? { post_public: false }
              : postPublic !== undefined && { post_public: postPublic }),
          }),
        };
  return name === undefined
    ? (settings as Action)
    : {
        id: "manual-rename",
        label: m.save,
        url: "/api/manual-event/rename",
        body: JSON.stringify({ event_id: eventId, name }),
        ...(settings && { next: settings }),
      };
};

/** `stale`: read a partial snapshot's stale rows again (D63), sent after the owner said yes. */
export async function post(action: Action, pin: string, force: boolean, stale = false) {
  const url = `${action.url}${force ? "&force=1" : ""}${stale ? "&stale=1" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-edit-pin": pin,
      ...(action.body !== undefined && { "content-type": "application/json" }),
    },
    body: action.body ?? null,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // A refused PIN is never sent again: the next press asks for it, and the page reload that follows
  // every press shows the PIN card when the session ended too (the PIN changed).
  if (res.status === 401) forgetPin();
  return { res, body };
}
