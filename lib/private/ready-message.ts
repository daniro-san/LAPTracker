// A ready message to a member (issue 460, D140), pure and browser-safe: Follow-up's panel shows it, and
// the member card's "Message to send" (issue 516) calls the same builder. Fixed sentences in the member's
// language (READY_MESSAGE): a hello (a welcome for a new member), one line for the first reason to check
// in, the Alliance Help coins tip, the facts still to ask by name, and a warm end (never a thanks for the
// tip alone, which would read as praise for doing better). Copied by an officer,
// never sent by the app. People first (D75): no number, no "you didn't", a missing fact is a question.
import { fill } from "../copy";
import type { WorkspaceLanguage } from "./dictionary";
import { READY_MESSAGE, type ReadyWords } from "./dictionary.ready";
import type { WorkItem } from "./follow-up-rules";
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

/**
 * A member's message from their Follow-up work item (D140): the KvK line first after a heavy hit (#585 S5,
 * no number in it), the reasons only when they are under Check in, the tip, the facts still to ask.
 * Follow-up's panel and the member card (issue 516) both build it here.
 */
export const inputOf = (item: Pick<WorkItem, "member" | "checkIn" | "tip" | "toAsk" | "kvk">) => ({
  name: item.member.name,
  isNew: item.member.isNew,
  reasons: [
    ...(item.kvk ? (["kvk"] as const) : []),
    ...(item.checkIn ? item.member.reasons.map((r) => r.kind) : []),
  ],
  tip: item.tip,
  toAsk: item.toAsk,
});

/** The message in each language the officer can pick (the EN · PT · FR chips). */
export const readyTexts = (m: MessageInput) =>
  Object.fromEntries(
    (Object.keys(READY_MESSAGE) as WorkspaceLanguage[]).map((l) => [
      l,
      readyMessage(readyWords(l), m),
    ]),
  ) as Record<WorkspaceLanguage, string>;
