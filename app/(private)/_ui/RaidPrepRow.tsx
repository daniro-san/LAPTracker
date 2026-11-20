"use client";

// One member on Raid prep (issue 474, D137): the name, the tracker's line with the map scan's time on both
// clocks, the Shield pair and the Squads off the wall pair (each ✓ / ✗, 48 px, the same button again
// clears), and the ready private message in the member's language with only the parts not yet ✓. The
// tracker's line is a hint (D75): "not seen yet" is never shown as a ✗.
import { useState } from "react";

import { chip, FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill, isolate } from "@/lib/copy";
import { PREP_MESSAGE } from "@/lib/private/dictionary.raidprep";
import type { Mark } from "@/lib/private/roll-call-rules";

import type { CalendarSheetWords } from "./calendar-data";
import type { PrepRowView, PrepTrackerView } from "./prep-data";
import { prepMessage, shieldDone } from "./prep-message";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import { Times } from "./YourTime";

function Pair(props: {
  label: string;
  name: string;
  mark: Mark | null;
  words: { yes: string; no: string; assumed?: string };
  button: string;
  onTap: (tapped: "yes" | "no") => void;
}) {
  // Every mark shows its word, "no problem seen" too (it has no button of its own), as RollCallMarks does.
  const said = props.mark ? props.words[props.mark] : undefined;
  return (
    <div className="min-w-0">
      <p className="text-body-sm text-ink/80">{props.label}</p>
      {said && <Tag tone={props.mark === "yes" ? "progress" : "neutral"}>{said}</Tag>}
      <div className="mt-0.5 flex gap-3">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={props.mark === v}
            aria-label={fill(props.button, { word: props.words[v], name: isolate(props.name) })}
            onClick={() => props.onTap(v)}
            className={`${chip(props.mark === v)} min-h-12 min-w-12 shrink-0 justify-center text-[22px]`}
          >
            <span aria-hidden="true">{v === "yes" ? "✓" : "✗"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrackerLines({ tr, times }: { tr: PrepTrackerView; times: CalendarSheetWords }) {
  return (
    <>
      <p className="text-body-sm">
        <span className={tr.on ? "text-ink/80" : "font-semibold text-yarn"}>{tr.text}</span>
        {tr.map && (
          <>
            {" · "}
            <Times st={tr.map.st} at={tr.map.at} day={tr.map.day} words={times} />
          </>
        )}
      </p>
      {tr.detail && <p className="text-body-sm text-ink/75">{tr.detail}</p>}
      {tr.lost && <p className="text-body-sm font-semibold text-yarn">{tr.lost}</p>}
      {tr.mayEnd && <Tag tone="attention">{tr.mayEnd}</Tag>}
    </>
  );
}

function MessageBox(props: { text: string; head: string; words: RollSheetWords }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <details className="mt-1" onToggle={() => setCopied(false)}>
      <summary className="flex min-h-11 cursor-pointer items-center text-body-sm font-semibold text-plum underline underline-offset-4">
        {props.words["roll.prep.message"]}
      </summary>
      <p className="text-body-sm text-ink/80">{props.head}</p>
      <textarea readOnly value={props.text} rows={3} className={`${FIELD} mt-1 text-[16px]`} />
      <button type="button" onClick={() => void copy()} className={`${chip()} mt-1`}>
        {props.words[copied ? "roll.prep.copied" : "roll.prep.copy"]}
      </button>
    </details>
  );
}

/** The row's message and its heading ("Message for Ana, in Portuguese"). */
function messageOf(
  prep: PrepRowView | undefined,
  name: string,
  when: "reset" | "kvk",
  done: { shield: boolean; wall: boolean; seen: boolean },
  words: RollSheetWords,
) {
  const text = prepMessage(PREP_MESSAGE[prep?.language ?? "en"], name, when, done);
  const head = fill(words["roll.prep.messageFor"], {
    name: isolate(name),
    language: prep?.languageName ?? "",
  });
  return { text, head };
}

export function RaidPrepRow(props: {
  row: MarkRowView;
  prep: PrepRowView | undefined;
  shield: Mark | null;
  wall: Mark | null;
  note: string | undefined;
  when: "reset" | "kvk";
  words: RollSheetWords;
  marks: MarkWords;
  times: CalendarSheetWords;
  onShield: (tapped: "yes" | "no") => void;
  onWall: (tapped: "yes" | "no") => void;
}) {
  const { row, prep, words } = props;
  const done = {
    shield: shieldDone(props.shield),
    wall: props.wall === "yes",
    seen: prep?.tracker?.on ?? false,
  };
  const message = messageOf(prep, row.name, props.when, done, words);
  return (
    <li className="border-t border-rule py-2">
      <p translate="no" className="truncate font-semibold">
        <bdi>{row.name}</bdi>
      </p>
      {prep?.tracker && <TrackerLines tr={prep.tracker} times={props.times} />}
      {props.note && <p className="text-body-sm font-semibold text-yarn">{props.note}</p>}
      <div className="mt-1 grid max-w-md grid-cols-2 gap-3">
        <Pair
          label={words["roll.prep.shield"]}
          name={row.name}
          mark={props.shield}
          words={props.marks}
          button={words["roll.button"]}
          onTap={props.onShield}
        />
        <Pair
          label={words["roll.prep.wall"]}
          name={row.name}
          mark={props.wall}
          words={{ yes: words["roll.prep.wall.yes"], no: words["roll.prep.wall.no"] }}
          button={words["roll.button"]}
          onTap={props.onWall}
        />
      </div>
      {done.shield && done.wall ? (
        <p className="mt-1 text-body-sm text-ink/75">{words["roll.prep.allSet"]}</p>
      ) : (
        <MessageBox text={message.text} head={message.head} words={words} />
      )}
    </li>
  );
}
