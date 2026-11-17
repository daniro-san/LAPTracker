// The notice editor's unsaved text, kept on this device (ADV-5): iOS Safari never warns before a page is
// left, so what the officer typed is written to localStorage, one entry per notice, and offered back
// ("Restore unsaved text") when the editor opens again. It is removed on Save and on Discard. Storage can
// be full, blocked or missing (a private window): every read and write is wrapped and then does nothing.
import { NOTICE_FIELDS, type NoticeField } from "@/lib/private/notice-rules";

type Values = Record<NoticeField, string>;

export const keepKey = (slug: string, id: number | null) => `lap:notice:${slug}:${id ?? "new"}`;

/** The kept values when they can be read and differ from what the editor opens with; else null. */
export function restorable(kept: string | null, opened: Values): Values | null {
  if (!kept) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(kept);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (!NOTICE_FIELDS.every((f) => typeof record[f] === "string")) return null;
  const values = Object.fromEntries(NOTICE_FIELDS.map((f) => [f, record[f]])) as Values;
  return NOTICE_FIELDS.some((f) => values[f] !== opened[f]) ? values : null;
}

export function readKept(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Keeps `values`, or removes the entry when null. */
export function writeKept(key: string, values: Values | null) {
  try {
    if (values) window.localStorage.setItem(key, JSON.stringify(values));
    else window.localStorage.removeItem(key);
  } catch {
    // Nothing to do: without storage the text is simply not kept.
  }
}
