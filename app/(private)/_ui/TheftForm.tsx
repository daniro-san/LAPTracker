"use client";

// "Add a theft" (issue 321), quick on a phone: who took it and the member it was taken from
// (TheftFormFields.tsx), the report's server day and time with the viewer's own clock beside it, the
// theft's type, and an optional note. Every control is 44 px or more; the time is typed as 24-hour text.
import { useState, type FormEvent } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { Sheet } from "@/lib/brand/components/Sheet";
import { changedFrom } from "@/lib/brand/components/sheet-close";
import { hhmm, parseTime } from "@/lib/private/calendar-time";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { THEFT_KINDS, type TheftKind } from "@/lib/private/theft-groups";
import { serverInstant } from "@/lib/schedule";
import { fill } from "@/lib/words";

import { newRequestId } from "./request-id";
import { sheetWords } from "./sheet-words";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";
import { postTheft, viewerClock } from "./theft-client";
import type { TheftWords } from "./theft-data";
import { AttackerField, VictimField, type Attacker, type Member } from "./TheftFormFields";
import { TimeInput } from "./TimeInput";
import { useViewerZone } from "./YourTime";

type FormProps = {
  slug: string;
  t: TheftWords;
  language: WorkspaceLanguage;
  roster: readonly Member[];
  /** Now, in server time: the day and time the fields start with. */
  start: { day: string; time: string };
  serverZone: string;
  onClose: () => void;
  onSaved: () => void;
};

type WhenProps = Pick<FormProps, "t" | "language" | "serverZone"> & {
  day: string;
  time: string;
  setDay: (day: string) => void;
  setTime: (time: string) => void;
};

/** The report's day and time in server time, and the same moment on the viewer's clock. */
function When({ t, language, serverZone, day, time, setDay, setTime }: WhenProps) {
  const zone = useViewerZone();
  const minute = parseTime(time);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && minute !== null;
  const at = valid ? serverInstant(day, hhmm(minute), { SERVER_TZ: serverZone }).getTime() : NaN;
  return (
    <fieldset className="mt-4">
      <legend className="font-semibold">{t["thefts.form.when"]}</legend>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col text-body-sm">
          {t["thefts.form.day"]}
          <input
            type="date"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={`${FIELD} mt-1`}
          />
        </label>
        <label className="flex min-w-0 flex-col text-body-sm">
          {t["thefts.form.time"]}
          <TimeInput required value={time} onChange={setTime} className="mt-1" />
        </label>
      </div>
      <p className="mt-1 text-body-sm text-ink/75">{t["thefts.form.whenHelp"]}</p>
      {zone && !Number.isNaN(at) && (
        <p className="mt-1 text-body-sm text-ink/75">
          {fill(t["thefts.yours"], { time: viewerClock(at, day, zone, language) })}
        </p>
      )}
    </fieldset>
  );
}

/** The theft's type, required: game terms, the same in every language (D52). */
function Kind(props: { t: TheftWords; value: TheftKind | ""; onChange: (v: TheftKind) => void }) {
  const { t, value, onChange } = props;
  return (
    <div className="mt-4">
      <label htmlFor="theft-kind" className="font-semibold">
        {t["thefts.form.kind"]}
      </label>
      <select
        id="theft-kind"
        required
        value={value}
        onChange={(e) => onChange(e.target.value as TheftKind)}
        className={`${FIELD} mt-1 block`}
      >
        <option value="" disabled>
          —
        </option>
        {THEFT_KINDS.map((k) => (
          <option key={k} value={k}>
            {t[`thefts.kind.${k}`]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The form's state and its one write; "" or the error to show. */
function useTheftForm(props: FormProps) {
  const [attacker, setAttacker] = useState<Attacker | null>(null);
  const [victim, setVictim] = useState<Member | null>(null);
  const [day, setDay] = useState(props.start.day);
  const [time, setTime] = useState(props.start.time);
  const [kind, setKind] = useState<TheftKind | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One per open sheet (D100): a retry after a lost answer adds nothing new.
  const [requestId] = useState(() => newRequestId());
  const { slug, t } = props;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!attacker) return setError(t["thefts.e.pick"]);
    const minute = parseTime(time);
    if (minute === null) return setError(t["thefts.e.bad_time"]);
    setBusy(true);
    const who =
      "typed" in attacker ? { name: attacker.typed, tag: attacker.tag } : { uid: attacker.uid };
    const body = {
      action: "add",
      attacker: who,
      victimUid: victim?.uid ?? null,
      day,
      time: hhmm(minute),
      kind,
      note,
      requestId,
    };
    const r = await postTheft(slug, body);
    setBusy(false);
    if (r === "ok") return props.onSaved();
    if (r === SIGNED_OUT) return setError(SIGNED_OUT);
    setError(t[`thefts.e.${r}` as keyof TheftWords] ?? t["thefts.e.failed"]);
  };
  const fields = { attacker, setAttacker, victim, setVictim, day, setDay, time, setTime };
  const now = { attacker, victim, day, time, kind, note };
  const start: typeof now = { ...props.start, attacker: null, victim: null, kind: "", note: "" };
  const dirty = changedFrom(start, now);
  return { ...fields, kind, setKind, note, setNote, busy, error, submit, dirty };
}

export function TheftForm(props: FormProps) {
  const { slug, t, onClose } = props;
  const f = useTheftForm(props);
  return (
    <Sheet
      labelledBy="theft-add-title"
      onCancel={onClose}
      dirty={f.dirty}
      title={t["thefts.add"]}
      words={sheetWords(t)}
      primary={{ label: t["thefts.form.save"], form: "theft-form", disabled: f.busy }}
      note={f.error && <RefusalLine text={f.error} className="mb-2 text-body-sm font-semibold" />}
    >
      <form id="theft-form" onSubmit={(e) => void f.submit(e)}>
        <div>
          <label htmlFor="theft-attacker" className="font-semibold">
            {t["thefts.form.attacker"]}
          </label>
          <AttackerField slug={slug} t={t} value={f.attacker} onChange={f.setAttacker} />
        </div>
        <div className="mt-4">
          <label htmlFor="theft-victim" className="font-semibold">
            {t["thefts.form.victim"]}
          </label>
          <VictimField t={t} roster={props.roster} value={f.victim} onChange={f.setVictim} />
        </div>
        <When {...props} day={f.day} time={f.time} setDay={f.setDay} setTime={f.setTime} />
        <Kind t={t} value={f.kind} onChange={f.setKind} />
        <label htmlFor="theft-note" className="mt-4 block font-semibold">
          {t["thefts.note"]}
        </label>
        <textarea
          id="theft-note"
          value={f.note}
          maxLength={500}
          rows={2}
          onChange={(e) => f.setNote(e.target.value)}
          className={`${FIELD} mt-1`}
        />
      </form>
    </Sheet>
  );
}
