"use client";

// An Elixir Scramble team's result for its week (issue 468, D103 amended): the opponent, our score and
// theirs, saved together. Won or Lost is read from the two scores as they are typed, never stored. One
// column at 360 px, fields and button 44 px tall; every field may stay empty.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import type { Occasion } from "@/lib/private/roll-call";
import { outcomeOf } from "@/lib/private/roll-call-rules";

import { sendRoll } from "./roll-call-client";
import type { RollSheetWords } from "./roll-call-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

export interface ElixirResultView {
  opponent: string;
  ourScore: string;
  theirScore: string;
}

/** An empty or whole non-negative number; undefined when the text is anything else. */
const scoreOf = (text: string): number | null | undefined => {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
};

export function ElixirResult(props: {
  slug: string;
  occasion: Occasion;
  saved: ElixirResultView;
  words: RollSheetWords;
}) {
  const { words } = props;
  const router = useRouter();
  const [v, setV] = useState(props.saved);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const our = scoreOf(v.ourScore);
  const their = scoreOf(v.theirScore);
  const outcome = our === undefined || their === undefined ? null : outcomeOf(our, their);
  const save = async () => {
    if (our === undefined || their === undefined)
      return setNote({ text: words["roll.failed"], bad: true });
    setBusy(true);
    setNote(null);
    const { status } = await sendRoll(props.slug, {
      action: "result",
      occasion: props.occasion,
      opponent: v.opponent.trim() || null,
      ourScore: our,
      theirScore: their,
    });
    setBusy(false);
    if (status === 200) {
      setNote({ text: words["roll.result.saved"], bad: false });
      router.refresh();
    } else setNote({ text: status === 401 ? SIGNED_OUT : words["roll.failed"], bad: true });
  };
  const field = (key: keyof ElixirResultView, label: string, numeric: boolean) => (
    <label className="block min-w-0">
      <span className="block text-body-sm font-semibold">{label}</span>
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        min={numeric ? 0 : undefined}
        maxLength={numeric ? undefined : 40}
        autoComplete="off"
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
        className={FIELD}
      />
    </label>
  );
  return (
    <section aria-labelledby="rc-result" className="mt-6 border-t border-rule pt-3">
      <h2 id="rc-result" className="font-subhead text-display-sm">
        {words["roll.result.head"]}
      </h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {field("opponent", words["roll.result.opponent"], false)}
        {field("ourScore", words["roll.result.our"], true)}
        {field("theirScore", words["roll.result.their"], true)}
      </div>
      <p className="mt-2 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
        {outcome ? (
          <Tag tone={outcome === "won" ? "progress" : "neutral"}>
            {words[`roll.result.${outcome}`]}
          </Tag>
        ) : (
          <span className="text-ink/75">{words["roll.result.hint"]}</span>
        )}
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
          {words["roll.result.save"]}
        </Button>
      </p>
      {note &&
        (note.bad ? (
          <RefusalLine text={note.text} className="mt-1 text-seal" />
        ) : (
          <p role="status" className="mt-1 text-body-sm">
            {note.text}
          </p>
        ))}
    </section>
  );
}
