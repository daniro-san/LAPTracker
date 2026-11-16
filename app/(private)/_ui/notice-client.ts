// What the notice screens share in the browser (issue 304): the two calls (save, draft), each language's
// short code and own name, and "n minutes ago" for a conflict.
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import type { Change, NoticeField, NoticeLanguage } from "@/lib/private/notice-rules";

/** The code on buttons ("Translate into PT · FR") and each language's name in itself, for headings. */
export const LANGUAGE_CODE: Record<NoticeLanguage, string> = { en: "EN", "pt-BR": "PT", fr: "FR" };
export const LANGUAGE_NAME: Record<NoticeLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  fr: "Français",
};

/** The notice's fields as the page sent them: each value and its version. */
export type NoticeFields = Record<NoticeField, { value: string; version: number }>;

/** A field someone else saved first, as the 409 carries it. */
export interface Conflict {
  field: NoticeField;
  value: string;
  version: number;
  by: string | null;
  at: string;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  } catch {
    return { status: 0, json: null };
  }
}

export type SaveAnswer =
  { ok: true; id: number } | { ok: false; conflicts: Conflict[] } | { ok: false; conflicts: null };

export async function saveNotice(
  slug: string,
  id: number | null,
  changes: Change[],
): Promise<SaveAnswer> {
  const { status, json } = await post(`/api/w/${slug}/notices`, {
    ...(id !== null && { id }),
    changes,
  });
  const body = json as { id?: number; conflicts?: Conflict[] } | null;
  if (status === 200 && typeof body?.id === "number") return { ok: true, id: body.id };
  return { ok: false, conflicts: status === 409 ? (body?.conflicts ?? []) : null };
}

export type DraftAsk =
  | { kind: "translate"; from: NoticeLanguage; to: NoticeLanguage[]; text: string }
  | { kind: "improve"; language: NoticeLanguage; tone: string; text: string };

/** The drafts by language, or the words that say why there are none. */
export async function askDraft(
  slug: string,
  ask: DraftAsk,
): Promise<{ drafts: Partial<Record<NoticeLanguage, string>> } | { failed: WorkspaceKey }> {
  const { status, json } = await post(`/api/w/${slug}/notices/draft`, ask);
  const drafts = (json as { drafts?: Partial<Record<NoticeLanguage, string>> } | null)?.drafts;
  if (status === 200 && drafts) return { drafts };
  if (status === 504) return { failed: "notices.ai.timeout" };
  if (status === 429) return { failed: "notices.ai.busy" };
  return { failed: "notices.ai.failed" };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "2 minutes ago", "há 2 minutos", "il y a 2 minutes". */
export function ago(at: string, language: WorkspaceLanguage, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  const [unit, size] = UNITS.find(([, s]) => seconds >= s) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
    -Math.floor(seconds / size),
    unit,
  );
}

/** A conflict's value in words: the text, on or off, a date or "none". */
export function conflictValue(c: Conflict, t: WorkspaceDictionary): string {
  if (c.field === "for_members") return t[c.value === "true" ? "notices.on" : "notices.off"];
  if (c.field === "ends_on") return c.value || t["notices.none"];
  return c.value;
}
