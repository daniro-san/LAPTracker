// What the notice screens share in the browser (issue 304): the two calls (save, draft), and a field's name
// and value in words for the conflict banner.
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import {
  isNoticeLanguage,
  type Change,
  type NoticeField,
  type NoticeLanguage,
} from "@/lib/private/notice-rules";

import { LANGUAGE_NAME } from "./languages";

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

/** A Translate or Improve writing answer: each language's draft, and those still partly untranslated. */
export interface DraftAnswer {
  drafts: Partial<Record<NoticeLanguage, string>>;
  partly: NoticeLanguage[];
}

/** The drafts by language, or the words that say why there are none. */
export async function askDraft(
  slug: string,
  ask: DraftAsk,
): Promise<DraftAnswer | { failed: WorkspaceKey }> {
  const { status, json } = await post(`/api/w/${slug}/notices/draft`, ask);
  const body = json as Partial<DraftAnswer> | null;
  if (status === 200 && body?.drafts) return { drafts: body.drafts, partly: body.partly ?? [] };
  if (status === 504) return { failed: "notices.ai.timeout" };
  if (status === 429) return { failed: "notices.ai.busy" };
  return { failed: "notices.ai.failed" };
}

/** A field's name in the conflict banner. */
export function fieldName(field: NoticeField, t: WorkspaceDictionary): string {
  if (isNoticeLanguage(field)) return LANGUAGE_NAME[field];
  if (field === "for_members") return t["notices.show"];
  if (field === "ends_on") return t["notices.endsOn"];
  return t["notices.title"];
}

/** A field's value in words: the text, on or off, a date or "none". */
export function valueWords(field: NoticeField, value: string, t: WorkspaceDictionary): string {
  if (field === "for_members") return t[value === "true" ? "notices.on" : "notices.off"];
  if (field === "ends_on") return value || t["notices.none"];
  return value;
}
