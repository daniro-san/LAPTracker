"use client";

// "Add a theft" (issue 321), quick on a phone: who took it and the member it was taken from
// (TheftFormFields.tsx), the report's server day and time with the viewer's own clock beside it, what was
// taken, and an optional note. Every control is 44 px or more.
import { useState, type FormEvent } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { serverInstant } from "@/lib/schedule";

import { postTheft, viewerClock } from "./theft-client";
import type { TheftWords } from "./theft-data";
import { AttackerField, VictimField, type Attacker, type Member } from "./TheftFormFields";
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
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(time);
  const at = valid ? serverInstant(day, time, { SERVER_TZ: serverZone }).getTime() : NaN;
  return (
    <fieldset className="mt-4">
      <legend className="font-semibold">{t["thefts.form.when"]}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        <label className="flex flex-col text-body-sm">
          {t["thefts.form.day"]}
          <input
            type="date"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="drawn-field min-h-11 px-3"
          />
        </label>
        <label className="flex flex-col text-body-sm">
          {t["thefts.form.time"]}
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value.slice(0, 5))}
            className="drawn-field min-h-11 px-3"
          />
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

function Stolen(props: {
  t: TheftWords;
  value: "quest_rewards" | null;
  onChange: (v: "quest_rewards" | null) => void;
}) {
  const { t, value, onChange } = props;
  return (
    <fieldset className="mt-4 grid gap-1.5">
      <legend className="mb-1 font-semibold">{t["thefts.form.stolen"]}</legend>
      <RadioField
        name="theft-stolen"
        checked={value !== null}
        onChange={() => onChange("quest_rewards")}
        label={t["thefts.stolen.quest_rewards"]}
      />
      <RadioField
        name="theft-stolen"
        checked={value === null}
        onChange={() => onChange(null)}
        label={t["thefts.stolen.none"]}
      />
    </fieldset>
  );
}

/** The form's state and its one write; "" or the error to show. */
function useTheftForm(props: FormProps) {
  const [attacker, setAttacker] = useState<Attacker | null>(null);
  const [victim, setVictim] = useState<Member | null>(null);
  const [day, setDay] = useState(props.start.day);
  const [time, setTime] = useState(props.start.time);
  const [stolen, setStolen] = useState<"quest_rewards" | null>("quest_rewards");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { slug, t } = props;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!attacker) return setError(t["thefts.e.pick"]);
    setBusy(true);
    const who =
      "typed" in attacker ? { name: attacker.typed, tag: attacker.tag } : { uid: attacker.uid };
    const body = {
      action: "add",
      attacker: who,
      victimUid: victim?.uid ?? null,
      day,
      time,
      stolen,
      note,
    };
    const r = await postTheft(slug, body);
    setBusy(false);
    if (r === "ok") return props.onSaved();
    setError(t[`thefts.e.${r}` as keyof TheftWords] ?? t["thefts.e.failed"]);
  };
  const fields = { attacker, setAttacker, victim, setVictim, day, setDay, time, setTime };
  return { ...fields, stolen, setStolen, note, setNote, busy, error, submit };
}

export function TheftForm(props: FormProps) {
  const { slug, t, onClose } = props;
  const f = useTheftForm(props);
  return (
    <Sheet labelledBy="theft-add-title" onCancel={onClose}>
      <form onSubmit={(e) => void f.submit(e)} className="max-h-[80dvh] overflow-y-auto">
        <h2
          id="theft-add-title"
          tabIndex={-1}
          data-initial-focus
          className="font-display text-display-md"
        >
          {t["thefts.add"]}
        </h2>
        <div className="mt-4">
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
        <Stolen t={t} value={f.stolen} onChange={f.setStolen} />
        <label htmlFor="theft-note" className="mt-4 block font-semibold">
          {t["thefts.note"]}
        </label>
        <textarea
          id="theft-note"
          value={f.note}
          maxLength={500}
          rows={2}
          onChange={(e) => f.setNote(e.target.value)}
          className="drawn-field mt-1 w-full px-3 py-2"
        />
        {/* Pinned to the bottom of the sheet, so Save is in reach at 360 px without scrolling. */}
        <div className="sticky bottom-0 mt-2 border-t border-rule bg-paper pt-2 pb-1">
          <p role="status" className="min-h-6 text-body-sm font-semibold">
            {f.error}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={f.busy} className={buttonClass("primary")}>
              {t["thefts.form.save"]}
            </button>
            <button type="button" onClick={onClose} className={buttonClass("secondary")}>
              {t["thefts.form.cancel"]}
            </button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
