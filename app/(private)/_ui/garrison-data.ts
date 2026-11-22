// The garrison plan page's data (D121), made on the server in the officer's language: each member's
// strongest squad and the good signals as words (never a number, D76), each spare squad as a choice with
// its might, and the share's words. The client lays it out and edits the pairs.
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { GarrisonKey, GarrisonWords } from "@/lib/private/dictionary.garrison";
import type { GarrisonView } from "@/lib/private/garrison";
import type { GarrisonPair, ShareWords } from "@/lib/private/garrison-plan";
import { mightText, shareWordsOf } from "@/lib/private/garrison-words";
import { fill } from "@/lib/words";

export interface BoardMember {
  uid: number;
  name: string;
  need: "help" | "close" | "unknown";
  /** "Strongest squad 7.20M"; null with no squad data. */
  top: string | null;
  why: string[];
}

export interface BoardSpare {
  helper: number;
  squad: number;
  /** "12.1M". */
  might: string;
}

export interface BoardData {
  entry: number;
  week: string;
  rev: number;
  pairs: GarrisonPair[];
  suggested: GarrisonPair[];
  members: BoardMember[];
  spares: BoardSpare[];
  names: Record<number, string>;
  share: ShareWords;
  /** "8.00M": the enemy might the stored plan was made at, when it is not the current one. */
  madeFor: string | null;
  /** The enemy might is carried over from an earlier siege and not saved for this one. */
  carried: boolean;
}

/** Only the garrison words, for the client component. */
export const garrisonWords = (t: WorkspaceDictionary): GarrisonWords =>
  Object.fromEntries(Object.entries(t).filter(([k]) => k.startsWith("garrison."))) as GarrisonWords;

export function boardData(
  view: GarrisonView,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): BoardData {
  const members = view.members.flatMap((m): BoardMember[] =>
    m.need === "fine"
      ? []
      : [
          {
            uid: m.uid,
            name: m.name,
            need: m.need,
            top:
              m.top === null
                ? null
                : fill(t["garrison.strongest"], { might: mightText(m.top, language) }),
            why: m.good.map((g) => t[`garrison.why.${g}` as GarrisonKey]),
          },
        ],
  );
  return {
    entry: view.placed.entry.id,
    week: view.placed.week,
    rev: view.rev,
    pairs: view.pairs,
    suggested: view.suggested,
    members,
    spares: view.spares.map((s) => ({
      helper: s.helper,
      squad: s.squad,
      might: mightText(s.power, language),
    })),
    names: view.names,
    share: shareWordsOf(view, t, language),
    madeFor: view.madeFor === null ? null : mightText(view.madeFor, language),
    carried: view.carriedFrom !== null,
  };
}
