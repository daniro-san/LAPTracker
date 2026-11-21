// Raid prep's ready private message (issue 474, D137), pure: in the member's language, only the parts not
// yet done, then "bring your troops home". The Shield part is done when it is ✓ or "no problem seen" (the
// shield's "the rest", D103); when the tracker saw a shield, it asks to check it is still on. The one
// message for everyone still to remind (issue 585) is the same request, to many, names first.
import { fill } from "@/lib/copy";
import { escapeDiscord } from "@/lib/discord-format";
import type { PrepMessageWords } from "@/lib/private/dictionary.raidprep";
import type { Mark } from "@/lib/private/roll-call-rules";

type Words = Record<
  "text" | "reset" | "kvk" | "shield" | "check" | "wall" | "home" | "and",
  string
>;

/** The Shield mark asks nothing more: ✓ Shield up, or "no problem seen". */
export const shieldDone = (mark: Mark | null) => mark === "yes" || mark === "assumed";

export function prepMessage(
  w: Words,
  name: string,
  when: "reset" | "kvk",
  done: { shield: boolean; wall: boolean; seen: boolean },
): string {
  const shield = done.seen ? w.check : w.shield;
  const parts = [...(done.shield ? [] : [shield]), ...(done.wall ? [] : [w.wall]), w.home];
  const last = parts.pop() as string;
  const list = parts.length ? `${parts.join(", ")} ${w.and} ${last}` : last;
  return fill(w.text, { name, when: w[when], parts: list });
}

/**
 * Still to remind (issue 585), in the rows' order: the Shield ✗, or not set and not seen with a shield by
 * the tracker. Those it saw did the job; "Mark ✓ the n seen with a shield" is for them. The caller passes the
 * members asked, so away members are never in it.
 */
export const toRemind = (
  rows: { uid: number; name: string }[],
  markOf: (uid: number) => Mark | null,
  seenOn: (uid: number) => boolean,
) =>
  rows
    .filter((row) => {
      const mark = markOf(row.uid);
      return mark === "no" || (mark === null && !seenOn(row.uid));
    })
    .map((row) => row.name);

/**
 * The names to paste into Discord: typed in game, so they show literally and ping nobody (`@everyone`,
 * mentions and markdown escaped as the summary's are).
 */
export const remindNames = (names: string[]) => names.map(escapeDiscord).join(", ");

/** One message for all of them, in the officers' language: "Aster, Briar: before the reset, please …". */
export const remindAll = (w: PrepMessageWords, names: string[], when: "reset" | "kvk") =>
  prepMessage({ ...w, ...w.all }, remindNames(names), when, {
    shield: false,
    wall: false,
    seen: false,
  });
