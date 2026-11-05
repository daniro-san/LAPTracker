"use client";

// "Rehearse now" and "Run BEFORE/AFTER now" (plan Phase 4). Each asks for a confirmation that names
// its cost, sends the PIN as x-edit-pin and shows the outcome in words, never as a raw error.
import { useState } from "react";

import { ConfirmSheet } from "./ConfirmSheet";
import { PinSheet, savedPin } from "./PinSheet";

interface Action {
  id: string;
  label: string;
  url: string;
  confirm: string;
}

const ACTIONS: Action[] = [
  {
    id: "rehearse",
    label: "Rehearse now",
    url: "/api/rehearsal",
    confirm: "Start a rehearsal? It uses about 45 API calls over about 50 minutes.",
  },
  {
    id: "before",
    label: "Run BEFORE now",
    url: "/api/snapshot?phase=before",
    confirm: "Run the BEFORE snapshot now? About 21 API calls, up to a minute.",
  },
  {
    id: "after",
    label: "Run AFTER now",
    url: "/api/snapshot?phase=after",
    confirm: "Run the AFTER snapshot now? About 21 API calls, up to a minute.",
  },
];

/** `before` is the event's before_at, shown when the API says the phase is not due yet. */
export function AdminActions({ beforeAtText }: { beforeAtText: string }) {
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
      const url = force ? `${action.url}&force=1` : action.url;
      const res = await fetch(url, { method: "POST", headers: { "x-edit-pin": pin } });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (
        body.code === "snapshot_complete" &&
        (await ask("This phase is already complete. Run it again?"))
      ) {
        return await send(action, pin, true);
      }
      setMessage(describe(res.status, body, beforeAtText));
    } catch {
      setMessage("✗ Could not reach the server.");
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

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy !== null}
            onClick={() => void start(a)}
            className="min-h-11 rounded-xs border border-plum px-4 font-semibold text-plum disabled:opacity-50"
          >
            {busy === a.id ? "Running…" : a.label}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="mt-3 break-words text-sm">
          {message}
        </p>
      )}
      {asking && <ConfirmSheet text={asking.text} onAnswer={answer} />}
      {pending && (
        <PinSheet
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

const REFUSALS: Record<string, string> = {
  snapshot_running: "A run is already in progress.",
  rehearsal_pending: "A rehearsal is already pending.",
  rehearsal_event_day: "Not on the event day or the day after.",
  rehearsal_before_real: "Too close to the real BEFORE (within 3 hours).",
  rehearsal_real_running: "A real run is in progress.",
  rate_limited: "Too many attempts. Wait a few minutes.",
  pin_locked: "PIN entry is locked for an hour.",
  unauthorized: "Wrong PIN. Reload and enter it again.",
};

function describe(status: number, body: Record<string, unknown>, beforeAtText: string): string {
  const code = typeof body.code === "string" ? body.code : null;
  if (code === "snapshot_not_due") return `Not due until ${beforeAtText}.`;
  if (code)
    return `${status === 409 || status === 429 ? "" : "✗ "}${REFUSALS[code] ?? `Refused: ${code}.`}`;
  if (status === 201) return "✓ Rehearsal created. The next ticks run it.";
  const failed = Array.isArray(body.failed) ? body.failed.length : 0;
  const stale = Array.isArray(body.stale) ? body.stale.length : 0;
  return `✓ ${String(body.phase)} ${String(body.status)}: ${String(body.calls_used)} calls, ${stale} stale, ${failed} failed (not fetched included). Snapshot ${String(body.snapshot_id)}.`;
}
