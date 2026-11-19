"use client";

// The siege's enemy might on the garrison page (D121): the same field as the Calendar sheet's, saved as a
// Calendar edit with the version the officer saw, so the last one saved counts and a 409 says who changed
// it first. Typed in millions ("11.5"), with "M" inside the field.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { GarrisonWords } from "@/lib/private/dictionary.garrison";
import { mightIn, millionsIn } from "@/lib/private/onboarding-parse";

import type { CalendarSheetWords } from "./calendar-data";
import { refusalText, sendCalendar } from "./calendar-send";
import { Labeled } from "./CalendarFields";
import { RefusalLine } from "./SignedOut";
import { SuffixInput } from "./SuffixInput";

export function GarrisonEnemy(props: {
  slug: string;
  entry: number;
  value: number | null;
  version: number;
  words: GarrisonWords;
  calendar: CalendarSheetWords;
}) {
  const { words, calendar } = props;
  const router = useRouter();
  const start = props.value === null ? "" : String(props.value / 1e6);
  const [text, setText] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const might = text.trim() === "" ? null : mightIn(text);
  const bad = text.trim() !== "" && might === null;
  async function save() {
    setBusy(true);
    setError(null);
    const change = { field: "enemyMight", value: might, version: props.version };
    const sent = await sendCalendar(props.slug, {
      action: "edit",
      entry: props.entry,
      week: null,
      changes: [change],
    });
    setBusy(false);
    if (!sent.ok) {
      const stale = sent.code === "stale" ? sent.conflicts[0]?.said : undefined;
      setError(stale ?? refusalText(sent.code, calendar));
    }
    router.refresh();
  }
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad) void save();
      }}
    >
      <Labeled
        id="garrison-enemy"
        label={words["garrison.enemy"]}
        error={bad ? calendar["calendar.form.enemyMightBad"] : null}
        hint={calendar["calendar.form.enemyMightHint"]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SuffixInput
            id="garrison-enemy"
            aria-describedby="garrison-enemy-note"
            aria-invalid={bad}
            inputMode="decimal"
            value={text}
            suffix={millionsIn(text) === null ? null : "M"}
            onChange={(e) => setText(e.target.value)}
            className="w-36"
          />
          <button
            type="submit"
            disabled={busy || bad || text === start}
            className={buttonClass("secondary")}
          >
            {words["garrison.enemySave"]}
          </button>
        </div>
      </Labeled>
      {error && (
        <RefusalLine text={error} className="mt-2 border-l-4 border-seal pl-3 text-body-sm" />
      )}
    </form>
  );
}
