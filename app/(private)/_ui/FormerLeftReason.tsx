"use client";

// Why a former member left (issue 469, D107 amendment 2026-11-27): on the former member's sheet, the saved
// reason and note, and a picker (Left · Joined another alliance · Removed by officers · Inactive · Unknown)
// with an optional note. A save is the fact's next version; a stale one is refused with the newer reason,
// which the picker then starts from. Also the view's counts by month and reason: numbers, never names.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";
import { RadioField } from "@/lib/brand/components/RadioField";
import { LEFT_NOTE_MAX, LEFT_REASONS, type LeftReason } from "@/lib/private/fact-fields";
import { fill } from "@/lib/words";

import { HEAD, SECTION } from "./FollowUpMessage";
import type { FormerRow, LeftMonthLine, LifecycleWords } from "./member-lifecycle-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Left = FormerRow["left"];

function Picker(props: {
  slug: string;
  uid: number;
  left: Left;
  words: LifecycleWords;
  onDone: () => void;
}) {
  const { words: t } = props;
  const router = useRouter();
  const [base, setBase] = useState(props.left.version);
  const [reason, setReason] = useState(props.left.reason);
  const [note, setNote] = useState(props.left.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Another officer saved first: start from theirs, so the next Save is a choice made on it. */
  const takeNewer = (newer: { version: number; value: LeftReason | null }) => {
    setBase(newer.version);
    setReason(newer.value?.reason ?? null);
    setNote(newer.value?.note ?? "");
    const theirs = newer.value ? t[`former.reason.${newer.value.reason}`] : t["former.why.none"];
    setError(fill(t["former.why.conflict"], { reason: theirs }));
  };
  const save = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/w/${props.slug}/members/${props.uid}/left-reason`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: base, reason, note }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 200) {
      router.refresh();
      props.onDone();
    } else if (res?.status === 409) takeNewer(await res.json());
    else setError(res?.status === 401 ? SIGNED_OUT : t["former.why.failed"]);
  };
  return (
    <div className="mt-2">
      <fieldset>
        <legend className="sr-only">{t["former.why"]}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEFT_REASONS.map((r) => (
            <RadioField
              key={r}
              name={`left-reason-${props.uid}`}
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              label={t[`former.reason.${r}`]}
            />
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block">
        <span className={`block ${HEAD}`}>{t["former.why.note"]}</span>
        <textarea
          rows={2}
          maxLength={LEFT_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="drawn-field mt-1 w-full px-3 py-2"
        />
      </label>
      {error && <RefusalLine text={error} className="mt-2 text-body-sm text-seal" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={!reason || busy}>
          {busy ? t["former.why.saving"] : t["former.why.save"]}
        </Button>
        <Button variant="secondary" onClick={props.onDone} disabled={busy}>
          {t["former.why.cancel"]}
        </Button>
      </div>
    </div>
  );
}

/** The sheet's "Why they left": the saved line, or "Not recorded yet", and the way to set or change it. */
export function LeftReasonSection(props: { slug: string; row: FormerRow; words: LifecycleWords }) {
  const { row, words: t } = props;
  const [open, setOpen] = useState(false);
  return (
    <section className={SECTION} aria-labelledby={`left-head-${row.uid}`}>
      <h3 id={`left-head-${row.uid}`} className={HEAD}>
        {t["former.why"]}
      </h3>
      {!open && (
        <>
          <p className={row.left.text ? "mt-1" : "mt-1 text-ink/75"}>
            {row.left.text ?? t["former.why.none"]}
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => setOpen(true)}>
            {row.left.text ? t["former.why.change"] : t["former.why.record"]}
          </Button>
        </>
      )}
      {open && (
        <Picker
          slug={props.slug}
          uid={row.uid}
          left={row.left}
          words={t}
          onDone={() => setOpen(false)}
        />
      )}
    </section>
  );
}

/** "Who left, by month": each month's total and its counts by reason (no reason saved is Unknown). */
export function LeftMonths({
  months,
  words: t,
}: {
  months: LeftMonthLine[];
  words: LifecycleWords;
}) {
  if (months.length === 0) return null;
  return (
    <section aria-labelledby="left-months" className="drawn-card mt-3 px-4 py-3">
      <h2 id="left-months" className="font-semibold">
        {t["former.months"]}
      </h2>
      <ul className="mt-1">
        {months.map((m) => (
          <li key={m.month} className="border-t border-rule py-1.5 first:border-t-0">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-semibold">{m.label}</span>
              <span className="text-body-sm tabular-nums">{m.total}</span>
            </span>
            <span className="block text-body-sm tabular-nums text-ink/80">{m.counts}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
