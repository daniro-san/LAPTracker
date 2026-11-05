"use client";

// "Rehearse", "Before snapshot", "After snapshot" (plan Phase 4): wax-seal buttons (DESIGN.md
// `seal-button`). Each asks for a confirmation that names its cost, sends the PIN as x-edit-pin and
// shows the outcome in words, never as a raw error.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SealButton } from "@/lib/brand/components/SealButton";
import { copy } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import {
  createRound,
  manualSnapshots,
  post,
  saveRound,
  SNAPSHOTS,
  type Action,
  type RunningView,
} from "./actions";
import { ConfirmSheet } from "./ConfirmSheet";
import { ManualSection } from "./ManualSection";
import { describe, Result, RunningNotice } from "./outcome";
import { PinSheet, savedPin } from "./PinSheet";
import { useRunWatch } from "./useRunWatch";

const t = copy.admin.run;

/**
 * `beforeAtText` is the event's before_at, shown when the API says the phase is not due yet.
 * `manual` is the newest manual event, or null when none exists.
 */
export function AdminActions({
  beforeAtText,
  manual,
  running,
  latest,
}: {
  beforeAtText: string;
  manual: ManualEventStatus | null;
  /** Snapshots running now, as words (phase, event, start time); empty when idle. */
  running: RunningView[];
  /** The newest finished run, shown when a running one ends. */
  latest: { event: string; phase: "before" | "after"; status: string } | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [asking, setAsking] = useState<{ text: string; resolve: (yes: boolean) => void } | null>(
    null,
  );
  useRunWatch(running, latest, setMessage);
  const locked = running.length > 0;
  const off = busy ?? (locked ? "running" : null);
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
      <ActionSeal action={a} busy={busy} off={off} onStart={() => void start(a)} />
    </li>
  );

  return (
    <div>
      {locked && <RunningNotice running={running} />}
      {message && <Result message={message} />}
      <SnapshotsGroup seals={SNAPSHOTS.map(seal)} />
      <ManualSection
        manual={manual}
        busy={off}
        seals={manual && manualSnapshots(manual.id).map(seal)}
        onCreate={(options) => void start(createRound(options))}
        onSave={(id, change) => void start(saveRound(id, change))}
      />
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

/** The wax seal with its one-line help and cost underneath, centred in its column. */
function ActionSeal({
  action: a,
  busy,
  off,
  onStart,
}: {
  action: Action;
  busy: string | null;
  /** Why every seal is off: this tab is sending something, or a run is in progress. */
  off: string | null;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <SealButton
        label={busy === a.id ? t.running : a.label}
        aria-label={busy === a.id ? undefined : a.name}
        disabled={off !== null}
        onClick={onStart}
        className="shrink-0 disabled:cursor-wait disabled:opacity-70"
      />
      {a.help && <p className="text-sm">{a.help}</p>}
      {a.cost && <p className="mt-auto text-sm font-semibold text-plum">{a.cost}</p>}
    </div>
  );
}
