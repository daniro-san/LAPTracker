"use client";

// One member's tile on Raid prep (issue 474, D137; a grid tile since issue 412, compact since issue 585):
// the name and the Shield's word beside its ✓ / ✗ pair (44 px, the same button again clears), the tracker's
// checkpoints, one line each with its map scan's server time ("Night check: shield seen (map from 22:33
// ST)"), the Squads off the wall pair only when the page shows it or the member has a wall mark, and one footer line: the ready private message in the member's
// language with only the parts not yet ✓. The tracker's line is a hint (D75). A mark the tick wrote from
// the tracker's reading says "from the tracker" beside it (D137, 2026-11-21).
import { useState, type ReactNode } from "react";

import { chip, FIELD } from "@/lib/brand/components/controls";
import { fill, isolate } from "@/lib/copy";
import { PREP_MESSAGE } from "@/lib/private/dictionary.raidprep";
import type { Mark } from "@/lib/private/roll-call-rules";

import type { PrepRowView, PrepTrackerView } from "./prep-data";
import { prepMessage, shieldDone } from "./prep-message";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import { tileClass } from "./RollCallGrid";
import { MarkLine } from "./RollCallMarks";

/** One part's words beside its ✓ / ✗ pair: the top line (the name, or the part's label), then its mark. */
function Pair(props: {
  top: ReactNode;
  name: string;
  mark: Mark | null;
  words: { yes: string; no: string; assumed?: string };
  button: string;
  notSet: string;
  /** "from the tracker", beside the mark the tick wrote. */
  source?: string | null;
  onTap: (tapped: "yes" | "no") => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {props.top}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <MarkLine mark={props.mark} words={props.words} notSet={props.notSet} />
          {props.source && <span className="text-label text-ink/75">{props.source}</span>}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={props.mark === v}
            aria-label={fill(props.button, { word: props.words[v], name: isolate(props.name) })}
            onClick={() => props.onTap(v)}
            className={`${chip(props.mark === v)} min-h-11 min-w-11 justify-center text-[22px]`}
          >
            <span aria-hidden="true">{v === "yes" ? "✓" : "✗"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The tracker's checkpoints that happened, one line each: "Night check: shield seen" and, muted, "map from
 * 22:33 ST". The time is labelled as the member's map scan, never the check's, so the card above never
 * seems to disagree (issue 585, first glance). "No shield seen" is in yarn, and bold only while the
 * Shield is not marked yet (panel review, issue 585).
 */
function TrackerLine({ tr, marked }: { tr: PrepTrackerView; marked: boolean }) {
  const notSeen = marked ? "text-yarn" : "font-semibold text-yarn";
  return (
    <div className="mt-0.5 text-body-sm">
      {tr.checks.map((c) => (
        <p key={c.text}>
          <span className={c.on ? "text-ink/80" : notSeen}>{c.text}</span>{" "}
          {/* In brackets, so it wraps as a unit on a narrow tile (four columns at 1280). */}
          <span className="text-label whitespace-nowrap text-ink/75">{`(${c.scan})`}</span>
        </p>
      ))}
    </div>
  );
}

function MessageBox(props: { text: string; head: string; name: string; words: RollSheetWords }) {
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
    <details onToggle={() => setCopied(false)}>
      <summary className="flex min-h-11 cursor-pointer items-center text-body-sm font-semibold text-plum underline underline-offset-4">
        {props.words["roll.prep.message"]}
        {/* Each tile's "Message" is named for screen readers: "Message for Ana" (panel review, issue 585). */}
        <span className="sr-only">{` ${fill(props.words["roll.prep.messageTo"], { name: isolate(props.name) })}`}</span>
      </summary>
      {/* The heading is the box's visible label (issue 585). */}
      <label className="block">
        <span className="block text-body-sm text-ink/80">{props.head}</span>
        <textarea readOnly value={props.text} rows={3} className={`${FIELD} mt-1 text-[16px]`} />
      </label>
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

/** The optional Squads off the wall pair, under a hairline (issue 585: only when needed). */
function WallPart(props: {
  name: string;
  mark: Mark | null;
  words: RollSheetWords;
  onTap: (tapped: "yes" | "no") => void;
}) {
  const { words } = props;
  return (
    <div className="mt-1 border-t border-rule pt-1">
      <Pair
        top={<p className="truncate text-body-sm text-ink/80">{words["roll.prep.wall"]}</p>}
        name={props.name}
        mark={props.mark}
        words={{ yes: words["roll.prep.wall.yes"], no: words["roll.prep.wall.no"] }}
        button={words["roll.button"]}
        notSet={words["roll.notSet"]}
        onTap={props.onTap}
      />
    </div>
  );
}

/** The Shield's words: the morning check's ✗ is a reading, "No shield seen · from the tracker" (D137). */
const trackerWords = (fromTracker: boolean, marks: MarkWords, words: RollSheetWords) =>
  fromTracker
    ? {
        words: { ...marks, no: words["roll.prep.noShieldSeen"] },
        source: words["roll.prep.fromTracker"],
      }
    : { words: marks, source: null };

export function RaidPrepRow(props: {
  row: MarkRowView;
  prep: PrepRowView | undefined;
  shield: Mark | null;
  wall: Mark | null;
  /** The page shows the Squads off the wall pair; a member with a wall mark shows it anyway. */
  showWall: boolean;
  /** The Shield ✓ is still the tick's (no officer wrote it since): "from the tracker". */
  fromTracker: boolean;
  note: string | undefined;
  when: "reset" | "kvk";
  words: RollSheetWords;
  marks: MarkWords;
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
    // Tinted once the Shield is marked: the counted part, as the chips and "Marked (n)" (issue 585).
    <li className={tileClass(props.shield !== null)}>
      <Pair
        top={
          <p translate="no" className="truncate font-semibold">
            <bdi>{row.name}</bdi>
          </p>
        }
        name={row.name}
        mark={props.shield}
        {...trackerWords(props.fromTracker, props.marks, words)}
        button={words["roll.button"]}
        notSet={words["roll.notSet"]}
        onTap={props.onShield}
      />
      {prep?.tracker && <TrackerLine tr={prep.tracker} marked={props.shield !== null} />}
      {props.note && <p className="text-body-sm font-semibold text-yarn">{props.note}</p>}
      {(props.showWall || props.wall !== null) && (
        <WallPart name={row.name} mark={props.wall} words={words} onTap={props.onWall} />
      )}
      {done.shield && done.wall ? (
        <p className="mt-1 text-body-sm text-ink/75">{words["roll.prep.allSet"]}</p>
      ) : (
        <MessageBox text={message.text} head={message.head} name={row.name} words={words} />
      )}
    </li>
  );
}
