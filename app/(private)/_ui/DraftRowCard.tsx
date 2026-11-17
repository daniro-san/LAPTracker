"use client";

// One row of a draft under review (issue 299): what the OCR read, the member it matched (sure, doubtful,
// not found) with a picker, the value to fix, the parser's flags, and what is already known beside it:
// the Alliance Duel points saved before, or our own read for a check. A row can be dropped. 44 px controls.
import type { ViewRow } from "@/lib/private/import-view";

import { fillIn, type Words } from "./draft-known";

export interface RowState {
  uid: number | null;
  value: string;
  dropped: boolean;
}

const MATCH_TONE = {
  sure: "text-ink/70",
  doubtful: "font-semibold text-yarn",
  none: "font-semibold text-seal",
};
/** The parser's flags an officer can act on; `rank` (a rank read differently) changes nothing to save. */
const SHOWN = new Set(["gap", "order", "points"]);

function RowHead({ row, w }: { row: ViewRow; w: Words }) {
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {row.rank !== null && <span className="font-semibold tabular-nums">#{row.rank}</span>}
        <span translate="no">{fillIn(w["import.read"], { name: row.name || "—" })}</span>
        <span className={`text-body-sm ${MATCH_TONE[row.match.status]}`}>
          {w[`import.match.${row.match.status}`]}
        </span>
      </p>
      {row.flags
        .filter((f) => SHOWN.has(f))
        .map((f) => (
          <p key={f} className="mt-1 border-l-4 border-yarn pl-2 text-body-sm">
            {w[`import.flag.${f}`]}
          </p>
        ))}
    </>
  );
}

function RowInputs(props: {
  id: string;
  row: ViewRow;
  state: RowState;
  onChange: (next: RowState) => void;
  members: { uid: number; name: string }[];
  w: Words;
  readOnly: boolean;
}) {
  const { id, row, state, w } = props;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="block text-body-sm" htmlFor={`${id}-m`}>
        {w["import.member"]}
        <select
          id={`${id}-m`}
          value={state.uid ?? ""}
          disabled={props.readOnly}
          onChange={(e) =>
            props.onChange({ ...state, uid: e.target.value ? Number(e.target.value) : null })
          }
          className="mt-1 block min-h-11 w-full border border-rule bg-paper px-2"
        >
          <option value="">{w["import.pickMember"]}</option>
          {row.suggestions.length > 0 && (
            <optgroup label={w["import.match.doubtful"]}>
              {row.suggestions.map((s) => (
                <option key={`s${s.uid}`} value={s.uid}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
          {props.members.map((m) => (
            <option key={m.uid} value={m.uid}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-body-sm" htmlFor={`${id}-v`}>
        {w["import.value"]}
        <input
          id={`${id}-v`}
          inputMode="numeric"
          value={state.value}
          disabled={props.readOnly}
          onChange={(e) => props.onChange({ ...state, value: e.target.value.replace(/\D/g, "") })}
          className="mt-1 block min-h-11 w-full border border-rule bg-paper px-2 tabular-nums"
        />
      </label>
    </div>
  );
}

export function DraftRowCard(props: {
  row: ViewRow;
  state: RowState;
  onChange: (next: RowState) => void;
  members: { uid: number; name: string }[];
  w: Words;
  /** What is known for the picked member: "saved before: …", "we read …", a note on a mismatch. */
  known: (uid: number | null, value: number | null) => string[];
  readOnly: boolean;
}) {
  const { row, state, w } = props;
  const value = state.value === "" ? null : Number(state.value);
  const id = `row-${row.rank ?? "n"}-${row.name.replace(/\W/g, "")}`;
  return (
    <li className={`border border-rule px-3 py-3 ${state.dropped ? "opacity-60" : ""}`}>
      <RowHead row={row} w={w} />
      {!state.dropped && <RowInputs id={id} {...props} />}
      {!state.dropped && (
        <p className="mt-1 text-body-sm text-ink/80 tabular-nums">
          {props.known(state.uid, value).join(" · ")}
        </p>
      )}
      {!props.readOnly && (
        <button
          type="button"
          onClick={() => props.onChange({ ...state, dropped: !state.dropped })}
          className="mt-1 inline-flex min-h-11 items-center text-body-sm font-medium underline underline-offset-4"
        >
          {state.dropped ? w["import.dropped"] : w["import.drop"]}
        </button>
      )}
    </li>
  );
}
