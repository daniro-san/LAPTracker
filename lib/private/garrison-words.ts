// The garrison plan's shared text in the officer's language (D121): a heading with the siege and its day,
// the enemy might, then one line per pair with names and squad might only. The page's "Copy for the game"
// and the Discord post use the same words and the same builder (shareText), so they never differ.
import { compactLarge } from "../compact";
import { fill } from "../words";
import { calendarDates, titleOf } from "./calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "./dictionary";
import type { GarrisonView } from "./garrison";
import { shareText, type ShareWords } from "./garrison-plan";

/** A squad's or the enemy's might, compact (D78): 12.1M. */
export const mightText = (n: number, language: string) => compactLarge(n, language);

export function shareWordsOf(
  view: GarrisonView,
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
): ShareWords {
  const siege = titleOf(view.placed.entry, t);
  const day = calendarDates(language).short(view.placed.day);
  return {
    head: [
      fill(t["garrison.share.title"], { siege, day }),
      fill(t["garrison.share.enemy"], { might: mightText(view.enemyMight ?? 0, language) }),
    ],
    line: t["garrison.share.line"],
    none: t["garrison.share.none"],
  };
}

/** The whole text: what "Copy for the game" copies and what Discord gets. */
export function garrisonText(
  view: GarrisonView,
  words: ShareWords,
  language: WorkspaceLanguage,
): string {
  const power = new Map(view.spares.map((s) => [`${s.helper}:${s.squad}`, s.power]));
  return shareText(
    words,
    view.pairs,
    (uid) => view.names[uid] ?? "",
    (helper, squad) => mightText(power.get(`${helper}:${squad}`) ?? 0, language),
  );
}
