// The notice editor's unsaved text, kept on this device (ADV-5): iOS Safari never warns before a page is
// left, so what the officer typed is written to localStorage, one entry per notice, and offered back
// ("Restore unsaved text") when the editor opens again. It is removed on Save, on Discard, and every entry
// on sign-out, so the next officer on a shared phone is not offered someone else's text. Storage can
// be full, blocked or missing (a private window): every read and write is wrapped and then does nothing.
// Start here keeps its texts the same way, under the same prefix, so sign-out clears them too (D116).
import { NOTICE_FIELDS, type NoticeField } from "@/lib/private/notice-rules";

type Values<F extends string = NoticeField> = Record<F, string>;

const PREFIX = "lap:notice:";

export const keepKey = (slug: string, id: number | null | "start-here") =>
  `${PREFIX}${slug}:${id ?? "new"}`;

/** The kept notice entries among a storage's keys. */
export const keptKeys = (keys: readonly (string | null)[]) =>
  keys.filter((k): k is string => k !== null && k.startsWith(PREFIX));

/** The kept values when they can be read and differ from what the editor opens with; else null. */
/** `fields`: the record's keys, the notice's fields unless given. */
export function restorable<F extends string = NoticeField>(
  kept: string | null,
  opened: Values<F>,
  fields: readonly F[] = NOTICE_FIELDS as readonly string[] as readonly F[],
): Values<F> | null {
  if (!kept) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(kept);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (!fields.every((f) => typeof record[f] === "string")) return null;
  const values = Object.fromEntries(fields.map((f) => [f, record[f]])) as Values<F>;
  return fields.some((f) => values[f] !== opened[f]) ? values : null;
}

export function readKept(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Removes every kept notice text on this device (sign-out). */
export function forgetAllKept() {
  try {
    const store = window.localStorage;
    const keys = keptKeys(Array.from({ length: store.length }, (_, i) => store.key(i)));
    for (const key of keys) store.removeItem(key);
  } catch {
    // Nothing to do: storage that cannot be read holds nothing kept.
  }
}

/** Keeps `values`, or removes the entry when null. */
export function writeKept(key: string, values: Record<string, string> | null) {
  try {
    if (values) window.localStorage.setItem(key, JSON.stringify(values));
    else window.localStorage.removeItem(key);
  } catch {
    // Nothing to do: without storage the text is simply not kept.
  }
}
