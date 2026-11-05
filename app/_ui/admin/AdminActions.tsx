"use client";

// "Rehearse", "Before snapshot", "After snapshot" (plan Phase 4): wax-seal buttons (DESIGN.md
// `seal-button`). Each asks for a confirmation that names its cost, sends the PIN as x-edit-pin and
// shows the outcome in words, never as a raw error.
import { useState } from "react";

import { SealButton } from "@/lib/brand/components/SealButton";
import { copy, fill } from "@/lib/copy";

import { ConfirmSheet } from "./ConfirmSheet";
import { PinSheet, savedPin } from "./PinSheet";
import { phaseWord, stateWord } from "./words";

interface Action {
  id: string;
  /** On the seal; `name` is the accessible name when it differs. */
  label: string;
  name?: string;
  url: string;
  confirm: string;
}

const t = copy.admin.run;

const ACTIONS: Action[] = [
  { id: "rehearse", label: t.rehearse, url: "/api/rehearsal", confirm: t.confirmRehearse },
  {
    id: "before",
    label: copy.admin.seal.before,
    name: phaseWord("before"),
    url: "/api/snapshot?phase=before",
    confirm: t.confirmBefore,
  },
  {
    id: "after",
    label: copy.admin.seal.after,
    name: phaseWord("after"),
    url: "/api/snapshot?phase=after",
    confirm: t.confirmAfter,
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
      if (body.code === "snapshot_complete" && (await ask(t.again))) {
        return await send(action, pin, true);
      }
      setMessage(describe(res.status, body, beforeAtText));
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

  return (
    <div>
      <div className="flex flex-wrap gap-4">
        {ACTIONS.map((a) => (
          <SealButton
            key={a.id}
            label={busy === a.id ? t.running : a.label}
            aria-label={busy === a.id ? undefined : a.name}
            disabled={busy !== null}
            onClick={() => void start(a)}
            className="disabled:cursor-wait disabled:opacity-70"
          />
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

function describe(status: number, body: Record<string, unknown>, beforeAtText: string): string {
  const code = typeof body.code === "string" ? body.code : null;
  if (code === "snapshot_not_due") return fill(t.notDue, { at: beforeAtText });
  if (code)
    return `${status === 409 || status === 429 ? "" : "✗ "}${t.refusals[code] ?? fill(t.refused, { code })}`;
  if (status === 201) return t.created;
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
