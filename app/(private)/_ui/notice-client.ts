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

/** One earlier save of the notice (D102): who and when in words, and the fields it saved. */
export interface HistoryItem {
  id: number;
  /** "Rook · Tue, Nov 17 14:02 ST". */
  line: string;
  changes: { field: NoticeField; value: string }[];
}

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

/**
 * `conflicts: null`: refused for another reason; `signedOut` when it was the session (D99), `deleted` when
 * the notice is in the trash (410 notice_deleted, D118).
 */
export type SaveAnswer =
  | { ok: true; id: number }
  | { ok: false; conflicts: Conflict[] }
  | { ok: false; conflicts: null; signedOut: boolean; deleted: boolean };

/** Delete, Undo or Restore from trash (D118): "ok", or the refusal's code ("lost" when no answer came). */
export async function sendDelete(
  slug: string,
  body: { id: number; requestId: string; undo?: true; restore?: true },
): Promise<string> {
  const { status, json } = await post(`/api/w/${slug}/notices/delete`, body);
  if (status === 200) return "ok";
  if (status === 0) return "lost";
  return (json as { code?: string } | null)?.code ?? "failed";
}

export async function saveNotice(
  slug: string,
  id: number | null,
  changes: Change[],
  /** A new notice's request id (D100): one per open editor, so a retry stores one notice. */
  requestId: string,
  /** Saved from a review request (D113): the save closes it as "Edited by …", under the same id. */
  review: number | null = null,
): Promise<SaveAnswer> {
  const { status, json } = await post(`/api/w/${slug}/notices`, {
    ...(id !== null ? { id } : { requestId }),
    changes,
    ...(review !== null && { review: { id: review, requestId } }),
  });
  const body = json as { id?: number; conflicts?: Conflict[] } | null;
  if (status === 200 && typeof body?.id === "number") return { ok: true, id: body.id };
  if (status === 409) return { ok: false, conflicts: body?.conflicts ?? [] };
  return { ok: false, conflicts: null, signedOut: status === 401, deleted: status === 410 };
}

export type DraftAsk =
  | { kind: "translate"; from: NoticeLanguage; to: NoticeLanguage[]; text: string; limit?: number }
  | { kind: "improve"; language: NoticeLanguage; tone: string; text: string; limit?: number }
  | { kind: "fit"; language: NoticeLanguage; text: string };

/** A Translate, Improve writing or Fit answer: each language's draft, and those still partly untranslated. */
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
  if (status === 401) return { failed: "signedOut.text" };
  if (status === 422) return { failed: "notices.fit.failed" };
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
