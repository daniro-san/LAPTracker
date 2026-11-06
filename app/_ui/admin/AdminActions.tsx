"use client";

// "Run something now" (plan Phase 4, #91): the current event by name with its Rename (D39), the
// Rehearse / Before / After wax seals (DESIGN.md `seal-button`) each with its cost, and the manual round.
// Each seal asks for a confirmation that names its cost, sends the PIN as x-edit-pin and shows the
// outcome in words, never as a raw error. The poller lives in AdminShell (RunWatch); this only shows
// the "finished" line it hands over.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { SealButton } from "@/lib/brand/components/SealButton";
import { copy, fill } from "@/lib/copy";

import {
  createRound,
  post,
  renameEvent,
  saveRound,
  SNAPSHOTS,
  type Action,
  type CurrentEventView,
  type RoundView,
  type RunningView,
} from "./actions";
import { ConfirmSheet } from "./ConfirmSheet";
import { ManualSection } from "./ManualSection";
import { describe, Result, RunningNotice } from "./outcome";
import { CostTag } from "./parts";
import { PinSheet, savedPin } from "./PinSheet";
import { useRunFinished } from "./RunWatch";

const t = copy.admin.run;

/**
 * `beforeAtText` is the event's before_at, shown when the API says the phase is not due yet.
 * `manual` is the newest manual round, or null when none exists.
 */
export function AdminActions({
  beforeAtText,
  current,
  manual,
  running,
}: {
  beforeAtText: string;
  current: CurrentEventView;
  manual: RoundView | null;
  /** Snapshots running now, as words (phase, event, start time); empty when idle. */
  running: RunningView[];
}) {
  const router = useRouter();
  const [message, setMessage] = useResult();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const { asking, ask, answer } = useAsk();
  const locked = running.length > 0;
  const off = busy ?? (locked ? "running" : null);

  async function send(action: Action, pin: string, force = action.force === true) {
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
      <CurrentEvent
        current={current}
        busy={busy}
        onRename={(id, name) => void start(renameEvent(id, name))}
      />
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-6">{SNAPSHOTS.map(seal)}</ul>
      <ManualSection
        manual={manual}
        busy={off}
        seal={seal}
        onStart={(a) => void start(a)}
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

/** The outcome line: set by a press, or by RunWatch when a run it watched has ended. */
function useResult() {
  const finished = useRunFinished();
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (finished) setMessage(finished.text);
  }, [finished]);
  return [message, setMessage] as const;
}

/** A yes/no question in the confirm sheet, answered through a promise. */
function useAsk() {
  const [asking, setAsking] = useState<{ text: string; resolve: (yes: boolean) => void } | null>(
    null,
  );
  const ask = (text: string) => new Promise<boolean>((resolve) => setAsking({ text, resolve }));
  const answer = (yes: boolean) => {
    asking?.resolve(yes);
    setAsking(null);
  };
  return { asking, ask, answer };
}

/** The current event by name and time, and its Rename (free) once the scheduler has made its row. */
function CurrentEvent({
  current,
  busy,
  onRename,
}: {
  current: CurrentEventView;
  busy: string | null;
  onRename: (eventId: number, name: string) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const id = current.id;
  return (
    <div role="group" aria-labelledby="current-event" className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="mr-auto min-w-0">
          <span id="current-event" className={LABEL}>
            {t.event}
          </span>
          <p className="break-words font-subhead text-display-sm">{current.name}</p>
          <p className="text-body-sm text-ink/70">{current.atText}</p>
        </div>
        {id !== null && name === null && (
          <>
            <button
              type="button"
              disabled={busy !== null}
              aria-expanded={false}
              onClick={() => setName(current.name)}
              className={buttonClass("secondary", "font-semibold")}
            >
              {t.rename}
            </button>
            <CostTag>{t.free}</CostTag>
          </>
        )}
      </div>
      {id === null && (
        <p className="mt-1 text-body-sm text-ink/70">
          {fill(t.renameLater, { at: current.rowFromText })}
        </p>
      )}
      {id !== null && name !== null && (
        <RenameForm
          name={name}
          current={current.name}
          busy={busy}
          onChange={setName}
          onSubmit={() => {
            onRename(id, name.trim());
            setName(null);
          }}
        />
      )}
    </div>
  );
}

/** The new name for the current event: plain text, up to 80 characters (D28 rules). */
function RenameForm({
  name,
  current,
  busy,
  onChange,
  onSubmit,
}: {
  name: string;
  current: string;
  busy: string | null;
  onChange: (name: string | null) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="drawn-frame-soft mt-3 flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="event-name" className="font-semibold">
        {t.renameTitle}
      </label>
      <input
        id="event-name"
        value={name}
        maxLength={80}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="event-name-help"
        className="drawn-field min-h-11 w-full px-3"
      />
      <p id="event-name-help" className="text-body-sm text-ink/70">
        {t.renameHelp}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={busy !== null || name.trim() === "" || name.trim() === current}
          className={buttonClass("primary", "font-semibold")}
        >
          {busy === "event-rename" ? t.running : t.renameSave}
        </button>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={buttonClass("secondary", "font-semibold")}
        >
          {copy.admin.manual.cancel}
        </button>
      </div>
    </form>
  );
}

const LABEL = "text-label font-semibold uppercase tracking-[0.04em] text-ink/70";

/** The wax seal with its one-line help and its cost underneath, centred in its column. */
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
      {a.help && <p className="text-body-sm">{a.help}</p>}
      {a.cost && (
        <span className="mt-auto">
          <CostTag>{a.cost}</CostTag>
        </span>
      )}
    </div>
  );
}
