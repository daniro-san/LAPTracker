"use client";

// "Rehearse", "Before snapshot", "After snapshot" (plan Phase 4): wax-seal buttons (DESIGN.md
// `seal-button`). Each asks for a confirmation that names its cost, sends the PIN as x-edit-pin and
// shows the outcome in words, never as a raw error.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { SealButton } from "@/lib/brand/components/SealButton";
import { copy, fill } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import { ConfirmSheet } from "./ConfirmSheet";
import { PinSheet, savedPin } from "./PinSheet";
import { phaseWord, stateWord } from "./words";

interface Action {
  id: "rehearse" | "before" | "after" | "manual-create" | "manual-before" | "manual-after";
  /** One line under a snapshot button. */
  help?: string;
  /** On the seal; `name` is the accessible name when it differs. */
  label: string;
  name?: string;
  url: string;
  confirm: string;
  /** JSON sent with the request (the manual event's name). */
  body?: string;
}

const t = copy.admin.run;
const m = copy.admin.manual;

const REHEARSE: Action = {
  id: "rehearse",
  label: t.rehearse,
  url: "/api/rehearsal",
  confirm: t.confirmRehearse,
};

const SNAPSHOTS: Action[] = [
  {
    id: "before",
    label: copy.admin.seal.before,
    name: phaseWord("before"),
    help: t.snapshots.before,
    url: "/api/snapshot?phase=before",
    confirm: t.confirmBefore,
  },
  {
    id: "after",
    label: copy.admin.seal.after,
    name: phaseWord("after"),
    help: t.snapshots.after,
    url: "/api/snapshot?phase=after",
    confirm: t.confirmAfter,
  },
];

/** The manual event's two snapshot buttons (D28): the same route, named by `event`. */
const manualSnapshots = (eventId: number): Action[] =>
  (["before", "after"] as const).map((phase) => ({
    id: `manual-${phase}`,
    label: copy.admin.seal[phase],
    name: phaseWord(phase),
    url: `/api/snapshot?phase=${phase}&event=${eventId}`,
    confirm: phase === "before" ? m.confirmBefore : m.confirmAfter,
  }));

const createAction = (name: string): Action => ({
  id: "manual-create",
  label: m.create,
  url: "/api/manual-event",
  confirm: m.confirmCreate,
  body: JSON.stringify({ name }),
});

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
      setMessage(describe(res.status, body, beforeAtText));
      router.refresh();
    } catch {
      setMessage(t.offline);
    } finally {
      setBusy(null);
    }
  }

  async function start(action: Action) {
    if (!(await ask(action.confirm))) return;
    const pin = savedPin();
    if (pin) void send(action, pin);
    else setPending(action);
  }

  const seal = (a: Action) => (
    <ActionSeal key={a.id} action={a} busy={busy} onStart={() => void start(a)} />
  );

  return (
    <div>
      {seal(REHEARSE)}
      <SnapshotsGroup seal={seal} />
      <ManualSection
        manual={manual}
        busy={busy}
        seal={seal}
        onCreate={(name) => void start(createAction(name))}
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

function SnapshotsGroup({ seal }: { seal: (a: Action) => React.ReactNode }) {
  return (
    <div role="group" aria-labelledby="snapshot-group" className="mt-6">
      <h3 id="snapshot-group" className="mb-2 font-subhead text-lg font-semibold">
        {t.snapshots.title}
      </h3>
      <ul className="flex flex-col gap-4">
        {SNAPSHOTS.map((a) => (
          <li key={a.id} className="flex items-center gap-4">
            {seal(a)}
            <p className="text-sm">{a.help}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink/70">{t.snapshots.cost}</p>
    </div>
  );
}

/** The manual event (D28): a name field, its cost, and Before/After buttons for the newest one. */
function ManualSection({
  manual,
  busy,
  seal,
  onCreate,
}: {
  manual: ManualEventStatus | null;
  busy: string | null;
  seal: (a: Action) => React.ReactNode;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div role="group" aria-labelledby="manual-group" className="mt-8">
      <h3 id="manual-group" className="mb-1 font-subhead text-lg font-semibold">
        {m.title}
      </h3>
      <p className="mb-3 text-sm">{m.help}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name);
        }}
      >
        <label htmlFor="manual-name" className="text-sm font-semibold">
          {m.nameLabel}
        </label>
        <input
          id="manual-name"
          type="text"
          maxLength={80}
          autoComplete="off"
          placeholder={m.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="drawn-field min-h-11 px-3"
        />
        <button
          type="submit"
          disabled={name.trim() === "" || busy !== null}
          className={buttonClass("secondary", "font-semibold")}
        >
          {busy === "manual-create" ? t.running : m.create}
        </button>
      </form>
      <p className="mt-3 text-sm text-ink/70">{m.cost}</p>
      {manual ? (
        <div className="mt-4">
          <p className="break-words font-medium">{fill(m.current, { name: manual.name })}</p>
          <ul className="my-2 text-sm">
            {(["before", "after"] as const).map((phase) => {
              const p = manual.phases.find((x) => x.phase === phase);
              return (
                <li key={phase}>
                  {fill(m.phase, {
                    phase: phaseWord(phase),
                    state: p ? stateWord(p.status) : m.notRun,
                  })}
                </li>
              );
            })}
          </ul>
          <ul className="mb-2 flex flex-col gap-4">
            {manualSnapshots(manual.id).map((a) => (
              <li key={a.id}>{seal(a)}</li>
            ))}
          </ul>
          <a href={`/events/${manual.id}`} className="inline-flex min-h-11 items-center underline">
            {m.open}
          </a>
        </div>
      ) : (
        <p className="mt-3 text-sm">{m.none}</p>
      )}
    </div>
  );
}

function describe(status: number, body: Record<string, unknown>, beforeAtText: string): string {
  const code = typeof body.code === "string" ? body.code : null;
  if (code === "snapshot_not_due") return fill(t.notDue, { at: beforeAtText });
  if (code)
    return `${status === 409 || status === 429 ? "" : "✗ "}${t.refusals[code] ?? fill(t.refused, { code })}`;
  if (status === 201) return body.event_id === undefined ? t.created : m.created;
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
    <SealButton
      label={busy === a.id ? t.running : a.label}
      aria-label={busy === a.id ? undefined : a.name}
      disabled={busy !== null}
      onClick={onStart}
      className="shrink-0 disabled:cursor-wait disabled:opacity-70"
    />
  );
}
