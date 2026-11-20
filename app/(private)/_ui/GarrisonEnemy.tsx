"use client";

// This siege's enemy might on the garrison page (D121). Each siege keeps its own value and history; a siege
// with none starts from the last one saved, and says so. Typed in millions ("11.5", "M" inside the field),
// or read from a screenshot of the siege screen ("Enemy Might: 11.5M"), which fills the field and saves
// nothing. Saved with the version the officer saw: the last one saved counts, and a 409 says it changed.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { GarrisonWords } from "@/lib/private/dictionary.garrison";
import { enemyMightIn } from "@/lib/private/garrison-plan";
import { mightIn, millionsIn } from "@/lib/private/onboarding-parse";

import { Labeled } from "./CalendarFields";
import { ReadScreenshot, type ShotWords } from "./ReadScreenshot";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";
import { SuffixInput } from "./SuffixInput";

interface Props {
  slug: string;
  entry: number;
  week: string;
  value: number | null;
  version: number;
  /** "Sat, Nov 14" when the value is carried over from an earlier siege. */
  carriedFrom: string | null;
  words: GarrisonWords;
  /** null: reading screenshots is turned off for the alliance (D126), and the button is left out. */
  shot: ShotWords | null;
}

/** Saving the enemy might typed in `text` (in millions), and what went wrong. */
function useEnemySave(props: Props, text: string) {
  const { words } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const might = text.trim() === "" ? null : mightIn(text);
  async function save() {
    setBusy(true);
    setError(null);
    const body = { action: "enemy", entry: props.entry, week: props.week, version: props.version };
    const res = await fetch(`/api/w/${props.slug}/garrison`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, value: might }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { code?: string; value?: number } | null;
    setBusy(false);
    if (!res?.ok) {
      const value = json?.value ? `${String(json.value / 1e6)}M` : "—";
      if (json?.code === SIGNED_OUT) setError(SIGNED_OUT);
      else if (json?.code === "stale") setError(fill(words["garrison.enemyStale"], { value }));
      else setError(words["garrison.failed"]);
    }
    router.refresh();
  }
  return { busy, error, setError, might, save };
}

export function GarrisonEnemy(props: Props) {
  const { words } = props;
  const start = props.value === null ? "" : String(props.value / 1e6);
  const [text, setText] = useState(start);
  const { busy, error, setError, might, save } = useEnemySave(props, text);
  const bad = text.trim() !== "" && might === null;
  const readText = (read: string) => {
    const found = enemyMightIn(read);
    if (found === null) return setError(words["garrison.enemyNotFound"]);
    setError(null);
    setText(String(found / 1e6));
  };
  // A carried-over value is not this siege's yet: Save stays on until it is saved here.
  const unchanged = text === start && props.carriedFrom === null;
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad && might !== null) void save();
      }}
    >
      <Labeled
        id="garrison-enemy"
        label={words["garrison.enemy"]}
        error={bad ? words["garrison.enemyBad"] : null}
        hint={words["garrison.enemyHint"]}
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
            disabled={busy || bad || might === null || unchanged}
            className={buttonClass("secondary")}
          >
            {words["garrison.enemySave"]}
          </button>
        </div>
      </Labeled>
      {props.carriedFrom && (
        <p className="mt-1 text-body-sm font-semibold">
          {fill(words["garrison.enemyCarried"], { date: props.carriedFrom })}
        </p>
      )}
      {props.shot && (
        <ReadScreenshot
          slug={props.slug}
          place="garrison"
          query="?text=plain"
          words={props.shot}
          link
          onText={readText}
        />
      )}
      {error && (
        <RefusalLine text={error} className="mt-2 border-l-4 border-seal pl-3 text-body-sm" />
      )}
    </form>
  );
}
