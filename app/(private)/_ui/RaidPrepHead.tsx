"use client";

// Raid prep's head above the tiles (issue 474, D137; issue 585): the summary card (the answer from the
// newest check, the Shield marks' counts, the Discord summary's state, "Mark ✓ the n seen with a shield"),
// then "To remind: n", "Copy n names" and "Copy one message" for those still to remind, and the switch that shows the optional Squads off the wall pair on
// every tile. Beside each of the two counts of people, "Show the n ›" puts exactly them in the grid (drilldown,
// 2026-11-22). Counts, times and names only; nothing here is sent anywhere by the page.
import { useRef, useState } from "react";

import { track, type RaidPrepSet } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { PREP_MESSAGE } from "@/lib/private/dictionary.raidprep";
import { fill, plural } from "@/lib/words";

import type { PrepHeadView } from "./prep-data";
import { remindAll, remindNames } from "./prep-message";
import type { MarkRowView, RollSheetWords } from "./roll-call-data";
import type { useMarks } from "./use-marks";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/**
 * The Shield marks in numbers that add up, the chips' own counts: "Shield marks: 98 of 99 · ✓ 86 · ✗ 12 ·
 * 1 to mark" (issue 585, first glance).
 */
function marksLine(c: Record<"todo" | "yes" | "no" | "all", number>, words: RollSheetWords) {
  const n = { marked: c.all - c.todo, total: c.all, yes: c.yes, no: c.no, todo: c.todo };
  return fill(words[c.todo === 0 ? "roll.prep.marks.done" : "roll.prep.marks"], n);
}

/** Sets the grid's members: the set, the line above it ("The 21 to remind") and which set it is. */
export type ShowSet = (rows: readonly MarkRowView[], label: string, kind: RaidPrepSet) => void;

/** The singular or plural form for `n` in the officer's language, filled with `n`. */
const counted = (n: number, one: string, other: string, language: string) =>
  fill(plural(n, { one, other }, language), { n });

/** "Show the 21 ›": a visible label, not a hidden tap on the count (drilldown panel review). */
function ShowChip(props: {
  kind: RaidPrepSet;
  rows: readonly MarkRowView[];
  line: { one: string; other: string };
  words: RollSheetWords;
  language: string;
  onShow: ShowSet;
}) {
  const { words } = props;
  const n = props.rows.length;
  const said = (one: string, other: string) => counted(n, one, other, props.language);
  return (
    <button
      type="button"
      onClick={() => props.onShow(props.rows, said(props.line.one, props.line.other), props.kind)}
      className={chip()}
    >
      {said(words["roll.prep.show.one"], words["roll.prep.show"])}
      <span aria-hidden="true">›</span>
    </button>
  );
}

/**
 * "Check by hand: 24" and "Show the 24 ›" (issue 726): the members whose map nearest the reset does not
 * vouch for 00:00 ST, live (an officer's own mark takes one off); null before any reading.
 */
function HandLine(props: {
  rows: MarkRowView[];
  words: RollSheetWords;
  language: string;
  onShow: ShowSet;
}) {
  const { rows, words } = props;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-body-sm font-semibold tabular-nums">
        {rows.length === 0
          ? words["roll.prep.hand.none"]
          : fill(words["roll.prep.hand"], { n: rows.length })}
      </span>
      {rows.length > 0 && (
        <ShowChip
          kind="hand"
          rows={rows}
          line={{ one: words["roll.prep.hand.shown.one"], other: words["roll.prep.hand.shown"] }}
          words={words}
          language={props.language}
          onShow={props.onShow}
        />
      )}
    </p>
  );
}

/** The card at the top: the answer first, the Shield marks' counts, the summary's state, "Mark ✓ the n". */
export function TrackerBar(props: {
  page: { head: PrepHeadView; words: RollSheetWords; slug: string; language: string };
  sets: {
    /** Who "Mark ✓ the n seen with a shield" marks (`toAccept`): its n, "Show the n ›" and its writes. */
    accept: MarkRowView[];
    /** "Check by hand" (issue 726), live; null before any reading. */
    hand: MarkRowView[] | null;
  };
  counts: Record<"todo" | "yes" | "no" | "all", number>;
  m: ReturnType<typeof useMarks>;
  onShow: ShowSet;
}) {
  const { head, words, slug, language } = props.page;
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (head.answer === null) return null;
  const acceptable = props.sets.accept.map((row) => row.uid);
  const accept = async () => {
    setBusy(true);
    const written = await props.m.bulk({ action: "accept", uids: acceptable });
    setBusy(false);
    if (!written) return;
    track("ws_roll_call_marked", { how: "tracker", roll_call: "raid_prep" });
    setDone(fill(words["roll.prep.accepted"], { n: written.length }));
  };
  return (
    // The answer to "are our shields recorded for this raid?" leads; the marks' counts follow it.
    <section aria-label={words["roll.prep.shield"]} className="drawn-card mt-3 px-3 py-2">
      <p className="font-semibold tabular-nums">{head.answer}</p>
      {head.next && <p className="text-body-sm">{head.next}</p>}
      <p className="text-body-sm tabular-nums">{marksLine(props.counts, words)}</p>
      {props.sets.hand && (
        <HandLine rows={props.sets.hand} words={words} language={language} onShow={props.onShow} />
      )}
      {head.discord && (
        <p className="flex flex-wrap items-center gap-x-3 text-body-sm text-ink/80">
          <span>{head.discord.text}</span>
          {head.discord.settings && (
            <a href={`/w/${slug}/settings`} className={LINK}>
              {words["roll.prep.discord.settings"]}
            </a>
          )}
        </p>
      )}
      {acceptable.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void accept()} className={chip()}>
            {counted(
              acceptable.length,
              words["roll.prep.accept.one"],
              words["roll.prep.accept"],
              language,
            )}
          </button>
          <ShowChip
            kind="accept"
            rows={props.sets.accept}
            line={{
              one: words["roll.prep.accept.shown.one"],
              other: words["roll.prep.accept.shown"],
            }}
            words={words}
            language={language}
            onShow={props.onShow}
          />
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm font-semibold text-plum">
          {done}
        </p>
      )}
    </section>
  );
}

/** The officers' language's words for the one message; English for any other. */
const officersMessage = (language: string) =>
  language === "pt-BR" || language === "fr" ? PREP_MESSAGE[language] : PREP_MESSAGE.en;

/** How long a chip says what it copied before it reads its own label again. */
const COPIED_MS = 3_000;

/**
 * Which chip just copied, for about 3 s, and only for the list it copied: a mark that changes the names
 * brings the labels back at once (panel review, issue 585).
 */
function useCopied(key: string) {
  const [copied, setCopied] = useState<{ what: "names" | "message"; key: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = (what: "names" | "message") => {
    setCopied({ what, key });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), COPIED_MS);
  };
  return { copied: copied?.key === key ? copied.what : null, done };
}

/**
 * "Copy n names" and "Copy one message" for those still to remind, plain text for Discord: names only,
 * never a reading or a mark. The message is in the officers' language. Then the switch that shows the
 * optional Squads off the wall pair on every tile.
 */
export function RemindBar(props: {
  /** Still to remind (`toRemind`): the count, the copies and "Show the n ›" read this one list. */
  rows: MarkRowView[];
  language: string;
  when: "reset" | "kvk";
  wall: boolean;
  onWall: () => void;
  onShow: ShowSet;
  words: RollSheetWords;
}) {
  const { words, language: lang } = props;
  const names = props.rows.map((row) => row.name);
  const n = names.length;
  const { copied, done } = useCopied(names.join("\n"));
  const copy = async (what: "names" | "message") => {
    const text =
      what === "names"
        ? remindNames(names)
        : remindAll(officersMessage(props.language), names, props.when);
    try {
      await navigator.clipboard.writeText(text);
      done(what);
    } catch {
      // Nothing was copied: the chip keeps its label.
    }
  };
  const said = {
    names: counted(n, words["roll.prep.copiedNames.one"], words["roll.prep.copiedNames"], lang),
    message: words["roll.prep.copiedMessage"],
  };
  const namesLabel = counted(
    n,
    words["roll.prep.copyNames.one"],
    words["roll.prep.copyNames"],
    lang,
  );
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {/* The count those copies hold, said before them (issue 585, first glance). */}
      <span className="text-body-sm font-semibold tabular-nums">
        {n === 0 ? words["roll.prep.remind.none"] : fill(words["roll.prep.remind"], { n })}
      </span>
      {n > 0 && (
        <>
          <ShowChip
            kind="remind"
            rows={props.rows}
            line={{
              one: words["roll.prep.remind.shown.one"],
              other: words["roll.prep.remind.shown"],
            }}
            words={words}
            language={props.language}
            onShow={props.onShow}
          />
          <button type="button" onClick={() => void copy("names")} className={chip()}>
            {copied === "names" ? said.names : namesLabel}
          </button>
          <button type="button" onClick={() => void copy("message")} className={chip()}>
            {copied === "message" ? said.message : words["roll.prep.copyMessage"]}
          </button>
        </>
      )}
      <button
        type="button"
        aria-pressed={props.wall}
        onClick={props.onWall}
        className={chip(props.wall)}
      >
        {words["roll.prep.wall.toggle"]}
      </button>
      <span role="status" className="sr-only">
        {copied ? said[copied] : ""}
      </span>
    </div>
  );
}

/** "How this works" lines: the tracker's two (while the check is on), the wall's and the copy's. */
export const prepNotes = (head: PrepHeadView, words: RollSheetWords) => [
  ...(head.answer === null
    ? []
    : [
        ...(head.hint ? [head.hint] : []),
        words["roll.prep.hand.help"],
        words["roll.prep.acceptHelp"],
      ]),
  words["roll.prep.wall.help"],
  words["roll.prep.copyHelp"],
];
