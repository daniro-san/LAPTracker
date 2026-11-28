"use client";

// "Days you are away" on a member's own page (issue 829, D154 amended): their first and last day away
// (server days), saved as their own report and cleared any time. The roll call and Follow-up leave them out
// on those days; nothing here is a status an officer set. A saved range shows as one line with Clear.
// Every control is 44 px or more; never in replay (ph-no-capture).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { SelfReportWords } from "@/lib/private/dictionary.self-report";
import type { OwnAway } from "@/lib/private/self-report";
import { fill } from "@/lib/words";

type Line = { text: string; alert: boolean } | null;
type Done = "self.away.saved" | "self.away.cleared";

interface Props {
  slug: string;
  words: SelfReportWords;
  away: OwnAway | null;
  /** The two days as dates in the member's language ("Sat, Nov 29"), for the saved line. */
  shown: { from: string; until: string } | null;
  /** Today's server day, the first day the picker offers. */
  today: string;
}

const REFUSALS: Record<string, "self.away.past" | "self.away.far"> = {
  past: "self.away.past",
  far: "self.away.far",
};

/** The two days, the request and its answer's line; the page is read again after a save or a clear. */
function useAway(props: Props) {
  const { words: w } = props;
  const router = useRouter();
  const [from, setFrom] = useState(props.away?.from ?? props.today);
  const [until, setUntil] = useState(props.away?.until ?? "");
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<Line>(null);
  const post = async (body: object, done: Done) => {
    setBusy(true);
    const res = await fetch(`/api/w/${props.slug}/me/away`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const error = (await res?.json().catch(() => null)) as { code?: string } | null;
    setBusy(false);
    if (res?.ok) {
      if (done === "self.away.cleared") {
        setFrom(props.today);
        setUntil("");
      }
      setLine({ text: w[done], alert: false });
      return router.refresh();
    }
    // The link is no longer approved, they left, or another tab wrote: the page says why once read again.
    if (res?.status === 403 || res?.status === 409) return router.refresh();
    setLine({ text: w[REFUSALS[error?.code ?? ""] ?? "self.failed"], alert: true });
  };
  return { from, setFrom, until, setUntil, busy, line, post };
}

function DayInput(props: {
  label: string;
  value: string;
  min?: string | undefined;
  bad: boolean;
  onChange: (day: string) => void;
}) {
  return (
    <label className="mt-2 block text-body-sm">
      {props.label}
      <input
        type="date"
        value={props.value}
        min={props.min}
        aria-invalid={props.bad || undefined}
        onChange={(e) => props.onChange(e.target.value)}
        className={`${FIELD} mt-1 block min-h-11 max-w-56`}
      />
    </label>
  );
}

export function MeAway(props: Props) {
  const { words: w } = props;
  const { from, setFrom, until, setUntil, busy, line, post } = useAway(props);
  const bad = from !== "" && until !== "" && from > until;
  return (
    <section
      aria-labelledby="me-away"
      className="ph-no-capture drawn-card mt-4 px-4 py-4 first:mt-0"
    >
      <h2 id="me-away" className="font-subhead text-display-sm">
        {w["self.away.head"]}
      </h2>
      <p className="mt-1 text-body-sm">{w["self.away.lead"]}</p>
      <p role="status" className="mt-2 text-body-sm font-semibold">
        {props.shown ? fill(w["self.away.state"], props.shown) : w["self.away.none"]}
      </p>
      <DayInput label={w["self.away.from"]} value={from} bad={bad} onChange={setFrom} />
      <DayInput
        label={w["self.away.until"]}
        value={until}
        min={from || undefined}
        bad={bad}
        onChange={setUntil}
      />
      {bad && (
        <p role="alert" className="mt-1 text-body-sm font-semibold text-seal">
          {w["self.away.bad"]}
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || bad || from === "" || until === ""}
          onClick={() => void post({ from, until }, "self.away.saved")}
          className={buttonClass("primary")}
        >
          {busy ? w["self.away.saving"] : w["self.away.save"]}
        </button>
        <Clear
          show={props.away !== null}
          busy={busy}
          words={w}
          onClear={() => void post({ clear: true }, "self.away.cleared")}
        />
      </p>
      <Answer line={line} />
    </section>
  );
}

function Clear(props: {
  show: boolean;
  busy: boolean;
  words: SelfReportWords;
  onClear: () => void;
}) {
  if (!props.show) return null;
  return (
    <button
      type="button"
      disabled={props.busy}
      onClick={props.onClear}
      className={buttonClass("secondary")}
    >
      {props.words["self.away.clear"]}
    </button>
  );
}

function Answer({ line }: { line: Line }) {
  if (!line) return null;
  return (
    <p
      role={line.alert ? "alert" : "status"}
      className={`mt-2 text-body-sm ${line.alert ? "font-semibold text-seal" : ""}`}
    >
      {line.text}
    </p>
  );
}
