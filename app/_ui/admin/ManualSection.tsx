"use client";

// The manual round (D28), on its own row under the three seals: "Start a manual round" opens the options
// inline, the round's card shows its state, its Before and After seals and the same options form to edit.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FactList } from "@/lib/brand/components/FactList";
import { copy } from "@/lib/copy";
import type { ManualEventStatus } from "@/lib/queries/admin";

import type { RoundChange, RoundOptions as Options } from "./actions";
import { RoundOptions } from "./RoundOptions";
import { stateWord } from "./words";

const t = copy.admin.run;
const m = copy.admin.manual;

export function ManualSection({
  manual,
  busy,
  seals,
  onCreate,
  onSave,
}: {
  manual: ManualEventStatus | null;
  busy: string | null;
  /** The round's Before and After seals, as list items. */
  seals: React.ReactNode;
  onCreate: (options: Options) => void;
  onSave: (eventId: number, change: RoundChange) => void;
}) {
  return (
    <div role="group" aria-labelledby="manual-group" className="mt-8 border-t border-rule pt-4">
      <h3 id="manual-group" className="mb-1 font-subhead text-lg font-semibold">
        {m.title}
      </h3>
      <p className="mb-3 text-sm">{m.help}</p>
      <CreateRound busy={busy} onCreate={onCreate} />
      <p className="mt-3 text-sm text-ink/70">{m.cost}</p>
      {manual ? (
        <RoundCard manual={manual} busy={busy} seals={seals} onSave={onSave} />
      ) : (
        <p className="mt-4 text-sm">{m.none}</p>
      )}
    </div>
  );
}

/** "Start a manual round": the button opens the options right under it; Create round sends them. */
function CreateRound({ busy, onCreate }: { busy: string | null; onCreate: (o: Options) => void }) {
  const [options, setOptions] = useState<Options | null>(null);
  if (!options) {
    return (
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
        className={buttonClass("secondary", "font-semibold")}
      >
        {busy === "manual-create" ? t.running : m.create}
      </button>
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
      <h4 id="create-title" className="font-subhead text-lg font-semibold">
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

function RoundCard({
  manual,
  busy,
  seals,
  onSave,
}: {
  manual: ManualEventStatus;
  busy: string | null;
  seals: React.ReactNode;
  onSave: (eventId: number, change: RoundChange) => void;
}) {
  const s = m.summary;
  const phase = (p: "before" | "after") => {
    const row = manual.phases.find((x) => x.phase === p);
    return row ? stateWord(row.status) : m.notRun;
  };
  const calls = manual.phases.reduce((n, p) => n + p.callsUsed, 0);
  return (
    <div className="mt-6">
      <h4 className="mb-1 font-subhead text-lg font-semibold">{s.title}</h4>
      <div className="mb-4">
        <FactList
          items={[
            { label: s.name, value: manual.name },
            { label: s.before, value: phase("before") },
            { label: s.after, value: phase("after") },
            { label: s.visibility, value: m.visibility[manual.visibility] },
            { label: s.discord, value: manual.postPublic ? s.on : s.off },
            { label: s.calls, value: String(calls) },
          ]}
        />
      </div>
      <ul className="mb-4 grid grid-cols-2 gap-2 sm:max-w-md sm:gap-6">{seals}</ul>
      <a href={`/events/${manual.id}`} className="inline-flex min-h-11 items-center underline">
        {m.open}
      </a>
      <details className="mt-2">
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
  manual: ManualEventStatus;
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
