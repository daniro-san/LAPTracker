"use client";

// The manual round card (D28): start a round, run Before and After from the seals passed in, rename
// the round once its Before has run.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { copy, fill } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import { phaseWord, stateWord } from "./words";

const t = copy.admin.run;
const m = copy.admin.manual;

/** The manual round (D28): create it, run Before and After when you like, rename it after the Before. */
export function ManualSection({
  manual,
  busy,
  seals,
  onCreate,
  onRename,
}: {
  manual: ManualEventStatus | null;
  busy: string | null;
  /** The Before and After buttons, as list items. */
  seals: React.ReactNode;
  onCreate: () => void;
  onRename: (eventId: number, name: string) => void;
}) {
  return (
    <div role="group" aria-labelledby="manual-group" className="mt-8">
      <h3 id="manual-group" className="mb-1 font-subhead text-lg font-semibold">
        {m.title}
      </h3>
      <p className="mb-3 text-sm">{m.help}</p>
      <button
        type="button"
        disabled={busy !== null}
        onClick={onCreate}
        className={buttonClass("secondary", "font-semibold")}
      >
        {busy === "manual-create" ? t.running : m.create}
      </button>
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
          <ul className="mb-2 flex flex-col gap-4">{seals}</ul>
          {manual.phases.length > 0 ? (
            <RenameForm manual={manual} busy={busy} onRename={onRename} />
          ) : (
            <p className="mb-2 text-sm">{m.renameLater}</p>
          )}
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

function RenameForm({
  manual,
  busy,
  onRename,
}: {
  manual: ManualEventStatus;
  busy: string | null;
  onRename: (eventId: number, name: string) => void;
}) {
  const [name, setName] = useState(manual.name);
  return (
    <form
      className="mb-2 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(manual.id, name);
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="drawn-field min-h-11 px-3"
      />
      <button
        type="submit"
        disabled={name.trim() === "" || name.trim() === manual.name || busy !== null}
        className={buttonClass("secondary", "font-semibold")}
      >
        {busy === "manual-rename" ? t.running : m.rename}
      </button>
    </form>
  );
}
