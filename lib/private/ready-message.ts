// A ready message to a member (issue 460, D140), pure and browser-safe: Follow-up's panel shows it, and
// the member card's "Copy a hello" (issue 516) is to call the same builder. Fixed sentences in the member's
// language (READY_MESSAGE): a hello (a welcome for a new member), one line for the first reason to check
// in, the Alliance Help coins tip, the facts still to ask by name, and a warm end (never a thanks for the
// tip alone, which would read as praise for doing better). Copied by an officer,
// never sent by the app. People first (D75): no number, no "you didn't", a missing fact is a question.
import { fill } from "../copy";
import type { WorkspaceLanguage } from "./dictionary";
import { READY_MESSAGE, type ReadyWords } from "./dictionary.ready";
import type { AskFact } from "./members-list";

/** The first language among `codes` the messages are written in; null when none is. */
export function messageLanguage(codes: readonly (string | null)[]): WorkspaceLanguage | null {
  for (const raw of codes) {
    const c = (raw ?? "").toLowerCase();
    if (c.startsWith("pt")) return "pt-BR";
    if (c.startsWith("fr")) return "fr";
    if (c.startsWith("en")) return "en";
  }
  return null;
}

export interface MessageInput {
  name: string;
  /** A new member: the hello is a welcome. */
  isNew: boolean;
  /** The reasons to check in, as Follow-up lists them; the first one picks the line. */
  reasons: readonly ("idle" | "might" | "kvk")[];
  /** Alliance Help coins below 1,000 most days (D140). */
  tip: boolean;
  toAsk: readonly AskFact[];
}

/** "a, b and c" in the message's language. */
function listOf(items: string[], and: string) {
  const last = items.pop() as string;
  return items.length ? `${items.join(", ")} ${and} ${last}` : last;
}

export function readyMessage(w: ReadyWords, m: MessageInput): string {
  const reason = m.reasons[0];
  const parts = [
    fill(m.isNew ? w.welcome : w.hello, { name: m.name }),
    ...(reason ? [w[reason]] : []),
    ...(m.tip ? [w.coins] : []),
    ...(m.toAsk.length > 0
      ? [
          fill(w.ask, {
            list: listOf(
              m.toAsk.map((f) => w[f]),
              w.and,
            ),
          }),
        ]
      : []),
    reason ? w.easy : m.toAsk.length > 0 ? w.thanks : w.fun,
  ];
  return parts.join(" ");
}

/** The words of a language. */
export const readyWords = (language: WorkspaceLanguage): ReadyWords => READY_MESSAGE[language];
