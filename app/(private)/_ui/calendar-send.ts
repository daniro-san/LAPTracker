// The Calendar tab's one write call (issue 300): a same-origin JSON POST (D71), its answer as data, and the
// officer's words for a refusal. A 409 carries, per field changed since, its version and a ready sentence.
import type { CalendarKey, CalendarWords } from "@/lib/private/dictionary.calendar";

import { SIGNED_OUT } from "./SignedOut";

export interface Stale {
  field: string;
  version: number;
  /** "Ana changed the level to “Lv.8” just now." */
  said: string;
  /** "You had “Lv.9”." */
  yours: string;
}
/** `deleted`: a delete took the whole entry (D123), so the page offers Undo. */
export type Sent = { ok: true; deleted: boolean } | { ok: false; code: string; conflicts: Stale[] };

export async function sendCalendar(slug: string, body: object): Promise<Sent> {
  try {
    const res = await fetch(`/api/w/${slug}/calendar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: string;
      conflicts?: Stale[];
      deleted?: boolean;
    };
    if (res.ok) return { ok: true, deleted: json.deleted === true };
    return { ok: false, code: json.code ?? "failed", conflicts: json.conflicts ?? [] };
  } catch {
    return { ok: false, code: "failed", conflicts: [] };
  }
}

const REFUSAL: Record<string, CalendarKey> = {
  not_found: "calendar.form.gone",
  theme_exists: "calendar.form.themeExists",
  not_in_alliance: "calendar.form.notInAlliance",
  same_person: "calendar.form.samePerson",
};

/** The sentence for a refusal other than a 409 conflict; SIGNED_OUT for a 401 (RefusalLine shows it). */
export const refusalText = (code: string, words: CalendarWords) =>
  code === SIGNED_OUT ? SIGNED_OUT : words[REFUSAL[code] ?? "calendar.form.failed"];
