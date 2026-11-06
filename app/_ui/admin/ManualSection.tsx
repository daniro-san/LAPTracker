"use client";

// The manual round (D28), under the three seals: the round's card says each phase's state and what to
// press next (#91), shows its Before and After seals and the same options form to edit; "Start a manual
// round" (free) opens the options inline under it. A done phase is a secondary "Record again", and a
// round with both phases done reads as complete (issue 157).
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { copy, fill } from "@/lib/copy";

import {
  manualSnapshots,
  recordAgain,
  type Action,
  type RoundChange,
  type RoundOptions as Options,
  type RoundView,
} from "./actions";
import { CostTag, StateChip } from "./parts";
import { RoundOptions } from "./RoundOptions";
import { phaseWord } from "./words";

const t = copy.admin.run;
const m = copy.admin.manual;

/** What the section offers in each state (issue 157): a phase that is done is a secondary "Record again"
 * (only `complete` needs `force`, D28; a partial or failed phase keeps its seal as the next step), and
 * "Start a manual round" is the primary action when there is no round or the round is complete. */
export function roundPlan(manual: RoundView | null) {
  const done = (phase: "before" | "after") =>
    manual?.phases.some((p) => p.phase === phase && p.status === "complete") ?? false;
  const again = { before: done("before"), after: done("after") };
  const complete = again.before && again.after;
  return { complete, again, create: !manual || complete ? "primary" : "secondary" } as const;
}

export function ManualSection({
  manual,
  busy,
  seal,
  onStart,
  onCreate,
  onSave,
}: {
  manual: RoundView | null;
  busy: string | null;
  /** A snapshot action as its wax seal, a list item. */
  seal: (a: Action) => React.ReactNode;
  onStart: (a: Action) => void;
  onCreate: (options: Options) => void;
  onSave: (eventId: number, change: RoundChange) => void;
}) {
  const plan = roundPlan(manual);
  return (
    <div role="group" aria-labelledby="manual-group" className="mt-8 border-t border-rule pt-4">
      <h3 id="manual-group" className="font-subhead text-display-sm">
        {m.title}
      </h3>
      <p className="text-body-sm text-ink/70">{m.help}</p>
      <p className="mb-3 text-body-sm text-ink/70">{m.cost}</p>
      {manual ? (
        <RoundCard
          manual={manual}
          plan={plan}
          busy={busy}
          seal={seal}
          onStart={onStart}
          onSave={onSave}
        />
      ) : (
        <p className="mb-3">{m.none}</p>
      )}
      <CreateRound busy={busy} variant={plan.create} onCreate={onCreate} />
    </div>
  );
}

/** "Start a manual round": the button opens the options right under it; Create round sends them. */
function CreateRound({
  busy,
  variant,
  onCreate,
}: {
  busy: string | null;
  variant: "primary" | "secondary";
  onCreate: (o: Options) => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  if (!options) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy !== null}
          aria-expanded={false}
          onClick={() =>
            setOptions({
              name: `Manual round ${new Date().toISOString().slice(0, 10)}`,
              visibility: "standalone",
              postPublic: false,
            })
          }
          className={buttonClass(variant, "font-semibold")}
        >
          {busy === "manual-create" ? t.running : m.create}
        </button>
        <CostTag>{t.free}</CostTag>
      </div>
    );
  }
  return (
    <form
      aria-labelledby="create-title"
      className="drawn-frame-soft flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(options);
        setOptions(null);
      }}
    >
      <h4 id="create-title" className="font-subhead text-display-sm">
        {m.createTitle}
      </h4>
      <RoundOptions
        idPrefix="create"
        value={options}
        onChange={setOptions}
        disabled={busy !== null}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={busy !== null || options.name.trim() === ""}
          className={buttonClass("primary", "font-semibold")}
        >
          {m.createNow}
        </button>
        <button
          type="button"
          onClick={() => setOptions(null)}
          className={buttonClass("secondary", "font-semibold")}
        >
          {m.cancel}
        </button>
      </div>
    </form>
  );
}

const LABEL = "text-label font-semibold uppercase tracking-[0.04em] text-ink/70";

/** A phase's state in words that say what to do next: "Not started: press Before", "Done 14:02". */
function PhaseChip({ manual, phase }: { manual: RoundView; phase: "before" | "after" }) {
  const row = manual.phases.find((x) => x.phase === phase);
  if (!row) {
    return <Chip tone="muted">{fill(m.phaseState.none, { seal: copy.admin.seal[phase] })}</Chip>;
  }
  return <StateChip status={row.status}>{row.text}</StateChip>;
}

/** A done phase, run again: muted, under its phase's name, with its cost (not the red seal). */
function RecordAgain({
  action: a,
  busy,
  onStart,
}: {
  action: Action;
  busy: string | null;
  onStart: () => void;
}) {
  return (
    <li className="flex flex-1 flex-col items-center gap-1 text-center">
      <span className={LABEL}>{a.label}</span>
      <button
        type="button"
        disabled={busy !== null}
        aria-label={busy === a.id ? undefined : fill(m.againName, { phase: a.name ?? a.label })}
        onClick={onStart}
        className="inline-flex min-h-11 cursor-pointer items-center px-2 font-medium text-ink/80 underline disabled:cursor-wait disabled:opacity-70"
      >
        {busy === a.id ? t.running : m.again}
      </button>
      <span className="mt-auto">
        <CostTag>{a.cost}</CostTag>
      </span>
    </li>
  );
}

function RoundCard({
  manual,
  plan,
  busy,
  seal,
  onStart,
  onSave,
}: {
  manual: RoundView;
  plan: ReturnType<typeof roundPlan>;
  busy: string | null;
  seal: (a: Action) => React.ReactNode;
  onStart: (a: Action) => void;
  onSave: (eventId: number, change: RoundChange) => void;
}) {
  const s = m.summary;
  const open = (
    <a
      href={`/events/${manual.id}`}
      className={
        plan.complete
          ? buttonClass("secondary", "mb-4 font-semibold")
          : "inline-flex min-h-11 items-center underline"
      }
    >
      {m.open}
    </a>
  );
  const snapshots = manualSnapshots(manual.id).map((a) => {
    const phase = a.id === "manual-before" ? "before" : "after";
    const row = manual.phases.find((p) => p.phase === phase);
    if (!plan.again[phase] || !row) return seal(a);
    const again = recordAgain(a, row.at);
    return <RecordAgain key={a.id} action={again} busy={busy} onStart={() => onStart(again)} />;
  });
  return (
    <div className="mb-4 border border-rule p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className={LABEL}>{s.title}</p>
        {plan.complete && <StateChip status="complete">{m.complete}</StateChip>}
      </div>
      <p className="mb-1 break-words font-subhead text-display-sm">{manual.name}</p>
      {(["before", "after"] as const).map((p) => (
        <div
          key={p}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2"
        >
          <span className="font-medium">{phaseWord(p)}</span>
          <PhaseChip manual={manual} phase={p} />
        </div>
      ))}
      <div className="mb-4">
        <FactList
          items={[
            { label: s.visibility, value: m.visibility[manual.visibility] },
            { label: s.discord, value: manual.postPublic ? s.on : s.off },
            { label: s.calls, value: String(manual.calls) },
          ]}
        />
      </div>
      {plan.complete && <div>{open}</div>}
      <ul className="mb-4 grid grid-cols-2 gap-2 sm:max-w-md sm:gap-6">{snapshots}</ul>
      {!plan.complete && open}
      <details className="mt-1">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-plum underline">
          {m.options}
        </summary>
        <EditRound
          key={`${manual.id}|${manual.name}|${manual.visibility}|${manual.postPublic}`}
          manual={manual}
          busy={busy}
          onSave={onSave}
        />
      </details>
    </div>
  );
}

/** The card's options: the same fields as the create form; only what changed is sent. */
function EditRound({
  manual,
  busy,
  onSave,
}: {
  manual: RoundView;
  busy: string | null;
  onSave: (eventId: number, change: RoundChange) => void;
}) {
  const [options, setOptions] = useState<Options>({
    name: manual.name,
    visibility: manual.visibility,
    postPublic: manual.postPublic,
  });
  const canRename = manual.phases.length > 0;
  const change: RoundChange = {
    ...(canRename && options.name.trim() !== manual.name && { name: options.name.trim() }),
    ...(options.visibility !== manual.visibility && { visibility: options.visibility }),
    ...(options.postPublic !== manual.postPublic && { postPublic: options.postPublic }),
  };
  const changed = Object.keys(change).length > 0;
  return (
    <form
      className="mt-2 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(manual.id, change);
      }}
    >
      <RoundOptions
        idPrefix="edit"
        value={options}
        onChange={setOptions}
        disabled={busy !== null}
        nameDisabled={!canRename}
      />
      <button
        type="submit"
        disabled={!changed || busy !== null || options.name.trim() === ""}
        className={buttonClass("primary", "font-semibold sm:self-start")}
      >
        {busy === "manual-rename" || busy === "manual-settings" ? t.running : m.save}
      </button>
    </form>
  );
}
