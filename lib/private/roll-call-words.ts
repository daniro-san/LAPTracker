// The Roll call tab's words (issue 298), made on the server: an occasion's title, each mark's word for its
// kind (a shield is "up", a team member "joined", a siege "took part"), what "the rest" says, and the
// counts line. "Not set" is said as it is, never as a "no" (D75).
import { fill, isolate } from "../copy";
import type { MarkRow } from "../repo/roll-call";
import type { Placed } from "./calendar-model";
import { agoText, titleOf } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import type { RollKey } from "./dictionary.rollcall";
import { REST, type Mark, type RollKind, type Tally } from "./roll-call-rules";

/** The word set each kind's ✓ and ✗ use. */
const SET: Record<RollKind, "shield" | "join" | "did"> = {
  shield: "shield",
  elixir: "join",
  raid: "did",
  plunder: "did",
  cheese: "did",
};

export function markWord(mark: Mark, kind: RollKind, t: WorkspaceDictionary): string {
  if (mark === "assumed") return t["roll.assumed"];
  return t[`roll.${mark}.${SET[kind]}` as RollKey];
}

/**
 * "The rest" in words, with its count and its default: the button ("Mark the other 57 as took part") and
 * the line after it ("57 marked as took part"), as templates with {n}. Null for plunders (none).
 */
export function restWords(kind: RollKind, t: WorkspaceDictionary) {
  const mark = REST[kind];
  if (mark === null) return null;
  return {
    button: t[`roll.rest.${mark}` as RollKey],
    done: t[`roll.rest.done.${mark}` as RollKey],
  };
}

/**
 * "Raid Shield", the Calendar's own title ("Undead Siege · Lv.4", "Cheese Trap I · Lv.7", "Elixir Scramble ·
 * Team A"), else the kind ("Cheese Trap", "Plunders").
 */
export function callTitle(
  o: { kind: RollKind; variant: string | null; placed: Placed | null },
  t: WorkspaceDictionary,
): string {
  if (o.kind === "shield") return t["roll.kind.shield"];
  if (o.placed) return titleOf(o.placed.entry, t);
  if (o.kind === "elixir" && o.variant) return titleOf({ ...o, level: null, title: null }, t);
  return t[`roll.kind.${o.kind}` as RollKey];
}

/**
 * The counts, each its own unit (shown without a break inside): "2 of 58 marked", "Shield up 1",
 * "No shield 1", "No problem seen 0" only when above zero, "Not set 56", "Away 3" only when above zero.
 * "Not set" is always its own count, never part of the ✗ one (D75).
 */
export function tallyParts(tally: Tally, kind: RollKind, t: WorkspaceDictionary): string[] {
  const part = (word: string, n: number) => fill(t["roll.count"], { word, n });
  const marked = tally.yes + tally.no + tally.assumed;
  return [
    fill(t["roll.progress"], { n: marked, total: marked + tally.notSet }),
    part(markWord("yes", kind, t), tally.yes),
    part(markWord("no", kind, t), tally.no),
    ...(tally.assumed > 0 ? [part(t["roll.assumed"], tally.assumed)] : []),
    part(t["roll.notSet"], tally.notSet),
    ...(tally.away > 0 ? [part(t["roll.away"], tally.away)] : []),
  ];
}

/** "Ana marked “Did not join” just now. …", or that the mark was cleared: the 409's sentence. */
export function staleSaid(
  newest: MarkRow | null,
  kind: RollKind,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  now: Date,
  /** D137: Raid prep's squads off the wall mark has its own words. */
  part: "main" | "wall" = "main",
): string {
  const mark = (newest?.mark ?? null) as Mark | null;
  const word = (m: Mark) =>
    part === "wall" && m !== "assumed" ? t[`roll.prep.wall.${m}`] : markWord(m, kind, t);
  return fill(t[mark ? "roll.conflict" : "roll.conflict.cleared"], {
    // D137 (2026-11-21): the tick's fill writes with no officer, as the tracker; Accept on its officer's name.
    name: newest?.by
      ? isolate(newest.by)
      : newest?.tracker
        ? t["roll.prep.trackerName"]
        : t["calendar.conflict.someone"],
    mark: mark ? word(mark) : "",
    ago: agoText(newest?.at.toISOString() ?? null, now, language, t["calendar.conflict.justNow"]),
  });
}
