// The KvK plan's message (issue 790, D161), pure: the notice draft "Make the message" makes. A heading with
// the KvK's server day and time, one line per role that has people ("Rally lead: Bramble, Quillon"), then
// the officers' note. People are named by their public name only, in name order inside a role, so a line
// never reads as a ranking (D75); a role with nobody is left out.
import { fill } from "../words";
import type { KvkPlanWords } from "./dictionary.kvk-plan";

export const ROLE_MAX = 10;
export const ROLE_NAME_MAX = 40;
export const NOTE_MAX = 500;
/** People across every role: the message stays well inside a notice's text. */
export const PEOPLE_MAX = 200;

/** The four roles a new plan suggests, as dictionary keys; officers rename, remove or add (D161). */
export const DEFAULT_ROLES = [
  "kvkPlan.role.rally",
  "kvkPlan.role.garrison",
  "kvkPlan.role.scout",
  "kvkPlan.role.shield",
] as const satisfies readonly (keyof KvkPlanWords)[];

export function planMessage(
  words: Pick<
    KvkPlanWords,
    "kvkPlan.message.title" | "kvkPlan.message.head" | "kvkPlan.message.role"
  >,
  /** The KvK's server day as the calendar writes it ("Sat, Nov 28") and its time ("12:00 ST"). */
  when: { day: string; time: string },
  roles: readonly { name: string; names: readonly string[] }[],
  note: string,
): { title: string; text: string } {
  const lines = roles
    .filter((r) => r.names.length > 0)
    .map((r) =>
      fill(words["kvkPlan.message.role"], {
        role: r.name,
        names: [...r.names].sort((a, b) => a.localeCompare(b, "en")).join(", "),
      }),
    );
  const text = [fill(words["kvkPlan.message.head"], when), ...lines];
  if (note.trim() !== "") text.push("", note.trim());
  return { title: fill(words["kvkPlan.message.title"], { day: when.day }), text: text.join("\n") };
}
