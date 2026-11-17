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
};

export function markWord(mark: Mark, kind: RollKind, t: WorkspaceDictionary): string {
  if (mark === "assumed") return t["roll.assumed"];
  return t[`roll.${mark}.${SET[kind]}` as RollKey];
}

/** "No problem seen for the rest", "The rest did not join", "The rest took part". */
export const restLabel = (kind: RollKind, t: WorkspaceDictionary) =>
  t[`roll.rest.${REST[kind]}` as RollKey];

/** "KvK shield", the Calendar's own title ("Undead Siege · Lv.4", "Elixir Scramble · Team A"), "Plunders". */
export function callTitle(
  o: { kind: RollKind; variant: string | null; placed: Placed | null },
  t: WorkspaceDictionary,
): string {
  if (o.kind === "shield") return t["roll.kind.shield"];
  if (o.placed) return titleOf(o.placed.entry, t);
  if (o.kind === "elixir" && o.variant) return titleOf({ ...o, level: null, title: null }, t);
  return t[`roll.kind.${o.kind}` as RollKey];
}

/** "Shield up 12 · No shield 2 · No problem seen 70 · Not set 10 · Away 3": zero "no problem seen" and away left out. */
export function tallyLine(tally: Tally, kind: RollKind, t: WorkspaceDictionary): string {
  const part = (word: string, n: number) => fill(t["roll.count"], { word, n });
  return [
    part(markWord("yes", kind, t), tally.yes),
    part(markWord("no", kind, t), tally.no),
    ...(tally.assumed > 0 ? [part(t["roll.assumed"], tally.assumed)] : []),
    part(t["roll.notSet"], tally.notSet),
    ...(tally.away > 0 ? [part(t["roll.away"], tally.away)] : []),
  ].join(" · ");
}

/** "Ana marked “Did not join” just now. …", or that the mark was cleared: the 409's sentence. */
export function staleSaid(
  newest: MarkRow | null,
  kind: RollKind,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  now: Date,
): string {
  const mark = (newest?.mark ?? null) as Mark | null;
  return fill(t[mark ? "roll.conflict" : "roll.conflict.cleared"], {
    name: newest?.by ? isolate(newest.by) : t["calendar.conflict.someone"],
    mark: mark ? markWord(mark, kind, t) : "",
    ago: agoText(newest?.at.toISOString() ?? null, now, language, t["calendar.conflict.justNow"]),
  });
}
