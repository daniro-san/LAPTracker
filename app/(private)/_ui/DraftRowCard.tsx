"use client";

// One row of a draft under review (issue 299): its label ("#2", the link target of "Row #2 needs a
// member"), what the OCR read, a mark only when the member is uncertain or not found, a picker with the
// closest names first (and, for a row not found, "New member: <name>", D106), the value to fix, the parser's flags, and what is already known beside it: the
// Alliance Duel points saved before, the game data for a check, a fact's previous value. A row can be
// dropped. 44 px controls.
import { chip, FIELD } from "@/lib/brand/components/controls";
import { isolate } from "@/lib/copy";
import type { ViewRow } from "@/lib/private/import-view";
import { sameName } from "@/lib/private/roster-search";
import { nameKey } from "@/lib/screenshot/name-key";

import { factText, fillIn, groupedValue, type Words } from "./draft-known";

export interface RowState {
  uid: number | null;
  /** A row not found saved to a new member by this name, as the officer fixed it (D106). */
  newName?: string | undefined;
  /** The new name's key the officer said "Add anyway" for, though a member has it (2026-11-17). */
  anyway?: string | undefined;
  value: string;
  dropped: boolean;
  /** Member update: the version to save on, after "Use mine" answered a conflict. */
  version?: number;
  /** Member update: another officer saved this fact meanwhile (D80). */
  conflict?: { value: number | null; version: number } | undefined;
  /** Member update: the officer kept the other officer's value; the row is dropped until "use mine". */
  kept?: { value: number | null; version: number } | undefined;
}

const button = chip();

/** The members who already have a new member's name, until the officer says "Add anyway" for it. */
export function takenBy<M extends { name: string }>(state: RowState, members: readonly M[]): M[] {
  const name = state.newName;
  if (name === undefined || nameKey(name) === state.anyway) return [];
  return sameName(name, members);
}
const factOr = (field: ViewRow["field"], v: number | null, sep: string) =>
  v === null ? "—" : factText(field, v, sep);

/** "AD Tech: 60% → 55%" with "Keep 60%" and "Use 55%": another officer saved a newer value (D80). After
 * Keep: "Kept 60%. Tap to use 55% instead." */
function Conflict(props: {
  row: ViewRow;
  state: RowState;
  onChange: (next: RowState) => void;
  w: Words;
  sep: string;
}) {
  const { row, state, w } = props;
  const mine = state.value === "" ? "—" : factText(row.field, Number(state.value), props.sep);
  const k = state.kept;
  if (k) {
    const theirs = factOr(row.field, k.value, props.sep);
    return (
      <button
        type="button"
        className={`mt-2 ${button}`}
        onClick={() =>
          props.onChange({ ...state, dropped: false, version: k.version, kept: undefined })
        }
      >
        {fillIn(w["shots.keptTheirs"], { theirs, mine })}
      </button>
    );
  }
  const c = state.conflict;
  if (!c) return null;
  const theirs = factOr(row.field, c.value, props.sep);
  const field = w[`shots.field.${row.field ?? ""}`] ?? "";
  return (
    <div className="mt-2 border-l-4 border-seal pl-2">
      <p className="text-body-sm">{fillIn(w["shots.conflict"], { field, theirs, mine })}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          onClick={() => props.onChange({ ...state, dropped: true, conflict: undefined, kept: c })}
        >
          {fillIn(w["shots.keepTheirs"], { theirs })}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => props.onChange({ ...state, version: c.version, conflict: undefined })}
        >
          {fillIn(w["shots.useMine"], { mine })}
        </button>
      </div>
    </div>
  );
}

/** Only an uncertain or missing member is marked; a sure match needs no word. */
const MATCH_TONE = {
  sure: null,
  doubtful: "font-semibold text-yarn",
  none: "font-semibold text-seal",
};
/** The parser's flags an officer can act on; `rank` (a rank read differently) changes nothing to save. */
const SHOWN = new Set(["gap", "order", "points"]);

function RowHead({ row, label, w }: { row: ViewRow; label: string; w: Words }) {
  const tone = MATCH_TONE[row.match.status];
  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold tabular-nums">{label}</span>
        {row.field && <span className="font-semibold">{w[`shots.field.${row.field}`]}</span>}
        <span translate="no">{fillIn(w["shots.read"], { name: isolate(row.name || "—") })}</span>
        {tone && (
          <span className={`text-body-sm ${tone}`}>{w[`shots.match.${row.match.status}`]}</span>
        )}
      </p>
      {row.flags
        .filter((f) => SHOWN.has(f))
        .map((f) => (
          <p key={f} className="mt-1 border-l-4 border-yarn pl-2 text-body-sm">
            {w[`shots.flag.${f}`]}
          </p>
        ))}
    </>
  );
}

type InputProps = {
  id: string;
  sep: string;
  row: ViewRow;
  state: RowState;
  onChange: (next: RowState) => void;
  members: { uid: number; name: string }[];
  /** New members waiting for the roster (D106). */
  pending: { uid: number; name: string }[];
  w: Words;
  readOnly: boolean;
};

const LINK =
  "mt-1 inline-flex min-h-11 items-center text-body-sm font-medium underline underline-offset-4";

/** The member: the closest names first, then everyone by name, then the new members waiting. */
function MemberSelect(props: InputProps) {
  const { id, row, state, w } = props;
  const option = (m: { uid: number; name: string }, key: string) => (
    <option key={key} value={m.uid}>
      {m.name}
    </option>
  );
  return (
    <label className="block text-body-sm" htmlFor={`${id}-m`}>
      {w["shots.member"]}
      <select
        id={`${id}-m`}
        value={state.uid ?? ""}
        disabled={props.readOnly}
        onChange={(e) =>
          props.onChange({ ...state, uid: e.target.value ? Number(e.target.value) : null })
        }
        className={`${FIELD} mt-1 block`}
      >
        <option value="">{w["shots.pickMember"]}</option>
        {row.suggestions.length > 0 && (
          <optgroup label={w["shots.closest"]}>
            {row.suggestions.map((s) => option(s, `s${s.uid}`))}
          </optgroup>
        )}
        {props.members.map((m) => option(m, String(m.uid)))}
        {props.pending.length > 0 && (
          <optgroup label={w["shots.pendingGroup"]}>
            {props.pending.map((m) => option(m, String(m.uid)))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

/** A row not found saved to a new member (D106): the name as read, to fix, and the way back. A name a
 * member already has asks first: "Pick them" (the only one, else the picker), or "Add anyway". */
function NewMemberName(props: InputProps & { name: string }) {
  const { id, state, w } = props;
  const taken = takenBy(state, props.members);
  const first = taken[0];
  return (
    <div className="text-body-sm">
      <label className="block" htmlFor={`${id}-n`}>
        {w["shots.newName"]}
        <input
          id={`${id}-n`}
          value={props.name}
          maxLength={64}
          autoComplete="off"
          translate="no"
          disabled={props.readOnly}
          onChange={(e) => props.onChange({ ...state, newName: e.target.value })}
          className={`${FIELD} mt-1 block`}
        />
      </label>
      {first && !props.readOnly ? (
        <div role="status" className="mt-2 border-l-4 border-yarn pl-2">
          <p translate="no">{fillIn(w["shots.taken"], { name: isolate(first.name) })}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              translate="no"
              className={chip(true)}
              onClick={() =>
                props.onChange({
                  ...state,
                  newName: undefined,
                  uid: taken.length === 1 ? first.uid : null,
                })
              }
            >
              {fillIn(w["shots.pickThem"], { name: isolate(first.name) })}
            </button>
            <button
              type="button"
              className={button}
              onClick={() => props.onChange({ ...state, anyway: nameKey(props.name) })}
            >
              {w["shots.addAnyway"]}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-ink/80">{w["shots.newHelp"]}</p>
      )}
      {!props.readOnly && (
        <button
          type="button"
          onClick={() => props.onChange({ ...state, newName: undefined })}
          className={LINK}
        >
          {w["shots.pickInstead"]}
        </button>
      )}
    </div>
  );
}

function RowInputs(props: InputProps) {
  const { id, row, state, w } = props;
  const offerNew = row.match.status === "none" && !props.readOnly && state.newName === undefined;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {state.newName === undefined ? (
        <div>
          <MemberSelect {...props} />
          {offerNew && (
            <button
              type="button"
              className={`mt-2 ${button}`}
              onClick={() => props.onChange({ ...state, uid: null, newName: row.name })}
            >
              <span translate="no">
                {fillIn(w["shots.newMember"], { name: isolate(row.name) })}
              </span>
            </button>
          )}
        </div>
      ) : (
        <NewMemberName {...props} name={state.newName} />
      )}
      <label className="block text-body-sm" htmlFor={`${id}-v`}>
        {w["shots.value"]}
        <input
          id={`${id}-v`}
          inputMode="numeric"
          value={state.value}
          disabled={props.readOnly}
          aria-describedby={`${id}-g`}
          onChange={(e) => props.onChange({ ...state, value: e.target.value.replace(/\D/g, "") })}
          className={`${FIELD} mt-1 block tabular-nums`}
        />
        {/* The value as the game shows it, digits grouped, to check against the picture. */}
        <span id={`${id}-g`} className="mt-1 block min-h-5 text-ink/80 tabular-nums">
          {groupedValue(state.value, props.sep)}
        </span>
      </label>
    </div>
  );
}

export function DraftRowCard(props: {
  /** "#2": the row's rank, or its place in the draft when it has none; its card is `#row-2`. */
  label: string;
  anchor: string;
  row: ViewRow;
  state: RowState;
  onChange: (next: RowState) => void;
  members: { uid: number; name: string }[];
  pending: { uid: number; name: string }[];
  w: Words;
  sep: string;
  /** What is known for the picked member: "saved before: …", "we read …", a fact's previous value. */
  known: (uid: number | null, value: number | null) => string[];
  readOnly: boolean;
}) {
  const { row, state, w } = props;
  const value = state.value === "" ? null : Number(state.value);
  const id = props.anchor;
  return (
    <li
      id={id}
      className={`scroll-mt-20 border border-rule px-3 py-3 ${state.dropped ? "opacity-60" : ""}`}
    >
      <RowHead row={row} label={props.label} w={w} />
      {!state.dropped && <RowInputs id={id} {...props} />}
      {!state.dropped && (
        <p className="mt-1 text-body-sm text-ink/80 tabular-nums">
          {props.known(state.uid, value).join(" · ")}
        </p>
      )}
      {!props.readOnly && <Conflict {...props} />}
      {!props.readOnly && !state.kept && (
        <button
          type="button"
          onClick={() => props.onChange({ ...state, dropped: !state.dropped })}
          className={LINK}
        >
          {state.dropped ? w["shots.dropped"] : w["shots.drop"]}
        </button>
      )}
    </li>
  );
}
