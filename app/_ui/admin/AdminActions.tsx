"use client";

// "Rehearse", "Before snapshot", "After snapshot" (plan Phase 4): wax-seal buttons (DESIGN.md
// `seal-button`). Each asks for a confirmation that names its cost, sends the PIN as x-edit-pin and
// shows the outcome in words, never as a raw error.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SealButton } from "@/lib/brand/components/SealButton";
import { copy, fill } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import { ConfirmSheet } from "./ConfirmSheet";
import { ManualSection } from "./ManualSection";
import { PinSheet, savedPin } from "./PinSheet";
import { phaseWord, stateWord } from "./words";

interface Action {
  id:
    | "rehearse"
    | "before"
    | "after"
    | "manual-create"
    | "manual-rename"
    | "manual-settings"
    | "manual-before"
    | "manual-after";
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
}

const t = copy.admin.run;
const m = copy.admin.manual;

const SNAPSHOTS: Action[] = [
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

/** The manual event's two snapshot buttons (D28): the same route, named by `event`. */
const manualSnapshots = (eventId: number): Action[] =>
  (["before", "after"] as const).map((phase) => ({
    id: `manual-${phase}`,
    label: copy.admin.seal[phase],
    name: phaseWord(phase),
    help: m.sealHelp[phase],
    cost: t.snapshots.costOne,
    url: `/api/snapshot?phase=${phase}&event=${eventId}`,
    confirm: phase === "before" ? m.confirmBefore : m.confirmAfter,
  }));

export interface RoundOptions {
  name: string;
  visibility: "admin" | "standalone" | "history";
  postPublic: boolean;
}

/** The new round's options as the create call (D28): no confirmation, the form is the confirmation. */
const createRound = (o: RoundOptions): Action => ({
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

const saveRound = (eventId: number, change: RoundChange): Action => {
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

async function post(action: Action, pin: string, force: boolean) {
  const res = await fetch(force ? `${action.url}&force=1` : action.url, {
    method: "POST",
    headers: {
      "x-edit-pin": pin,
      ...(action.body !== undefined && { "content-type": "application/json" }),
    },
    body: action.body ?? null,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body };
}

/**
 * `beforeAtText` is the event's before_at, shown when the API says the phase is not due yet.
 * `manual` is the newest manual event, or null when none exists.
 */
export function AdminActions({
  beforeAtText,
  manual,
}: {
  beforeAtText: string;
  manual: ManualEventStatus | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [asking, setAsking] = useState<{ text: string; resolve: (yes: boolean) => void } | null>(
    null,
  );
  const ask = (text: string) => new Promise<boolean>((resolve) => setAsking({ text, resolve }));
  const answer = (yes: boolean) => {
    asking?.resolve(yes);
    setAsking(null);
  };

  async function send(action: Action, pin: string, force = false) {
    setBusy(action.id);
    setMessage(null);
    try {
      const { res, body } = await post(action, pin, force);
      if (body.code === "snapshot_complete" && (await ask(t.again))) {
        return await send(action, pin, true);
      }
      if (res.ok && action.next) return await send(action.next, pin);
      setMessage(describe(res.status, body, beforeAtText));
      router.refresh();
    } catch {
      setMessage(t.offline);
    } finally {
      setBusy(null);
    }
  }

  async function start(action: Action) {
    if (action.confirm && !(await ask(action.confirm))) return;
    const pin = savedPin();
    if (pin) void send(action, pin);
    else setPending(action);
  }

  const seal = (a: Action) => (
    <li key={a.id} className="flex">
      <ActionSeal action={a} busy={busy} onStart={() => void start(a)} />
    </li>
  );

  return (
    <div>
      <SnapshotsGroup seals={SNAPSHOTS.map(seal)} />
      <ManualSection
        manual={manual}
        busy={busy}
        seals={manual && manualSnapshots(manual.id).map(seal)}
        onCreate={(options) => void start(createRound(options))}
        onSave={(id, change) => void start(saveRound(id, change))}
      />
      {message && (
        <p role="status" className="mt-3 break-words text-sm">
          {message}
        </p>
      )}
      {asking && <ConfirmSheet text={asking.text} onAnswer={answer} />}
      {pending && (
        <PinSheet
          onCancel={() => setPending(null)}
          onUnlocked={(pin) => {
            const action = pending;
            setPending(null);
            void send(action, pin);
          }}
        />
      )}
    </div>
  );
}

/** Before, After and Rehearse side by side, each with its own line and cost (one row at 360 px). */
function SnapshotsGroup({ seals }: { seals: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby="snapshot-group" className="mt-4">
      <h3 id="snapshot-group" className="mb-3 font-subhead text-lg font-semibold">
        {t.snapshots.title}
      </h3>
      <ul className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-6">{seals}</ul>
    </div>
  );
}

/** The answer of a rename or settings call (it carries an event id and no snapshot id). */
function manualOutcome(body: Record<string, unknown>): string | null {
  if (body.event_id === undefined || body.snapshot_id !== undefined) return null;
  return body.name === undefined ? m.saved : m.renamed;
}

function describe(status: number, body: Record<string, unknown>, beforeAtText: string): string {
  const code = typeof body.code === "string" ? body.code : null;
  if (code === "snapshot_not_due") return fill(t.notDue, { at: beforeAtText });
  if (code)
    return `${status === 409 || status === 429 ? "" : "✗ "}${t.refusals[code] ?? fill(t.refused, { code })}`;
  if (status === 201) return body.event_id === undefined ? t.created : m.created;
  const manual = manualOutcome(body);
  if (manual) return manual;
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return fill(t.result, {
    phase: body.phase === "before" || body.phase === "after" ? phaseWord(body.phase) : "",
    status: stateWord(String(body.status)),
    calls: String(body.calls_used),
    stale: count(body.stale),
    failed: count(body.failed),
    id: String(body.snapshot_id),
  });
}

/** The wax seal with its one-line help and cost underneath, centred in its column. */
function ActionSeal({
  action: a,
  busy,
  onStart,
}: {
  action: Action;
  busy: string | null;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <SealButton
        label={busy === a.id ? t.running : a.label}
        aria-label={busy === a.id ? undefined : a.name}
        disabled={busy !== null}
        onClick={onStart}
        className="shrink-0 disabled:cursor-wait disabled:opacity-70"
      />
      {a.help && <p className="text-sm">{a.help}</p>}
      {a.cost && <p className="mt-auto text-sm font-semibold text-plum">{a.cost}</p>}
    </div>
  );
}
