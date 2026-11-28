// The notice editor's state and actions (issues 304, 305, 293, 363): the draft, the language tab in view and
// the one the officer last wrote in, Translate and Improve writing with their own error line, Accept and Undo,
// the save with its version check, the conflict banner (shown and focused; Save brings it back), "Keep as is",
// a warning before the page is left with unsaved text, and that text kept on this device (notice-keep.ts).
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { track } from "@/lib/analytics/events";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import type { MemberLanguages } from "@/lib/private/notice-languages";
import type { PictureView } from "@/lib/private/notice-picture-rules";
import {
  isNoticeLanguage,
  NOTICE_FIELDS,
  type NoticeField,
  type NoticeLanguage,
} from "@/lib/private/notice-rules";

import {
  askDraft,
  sendDelete,
  type Conflict,
  type DraftAsk,
  type HistoryItem,
  type NoticeFields,
} from "./notice-client";
import {
  accept,
  askTab,
  changesOf,
  discard,
  settle,
  startDraft,
  withDrafts,
  withRestored,
} from "./notice-draft";
import { keepKey, readKept, restorable, writeKept } from "./notice-keep";
import { saveWithPicture, type PictureDraft } from "./notice-picture-state";
import { newRequestId } from "./request-id";

/** The three writing helps, each with its own switch (D126). */
export type AiKind = "translate" | "improve" | "fit";

export interface EditorProps {
  slug: string;
  id: number | null;
  fields: NoticeFields;
  stale: NoticeLanguage[];
  /** The saved languages that came from Translate, and those a review approved since (issue 412). */
  translated?: NoticeLanguage[] | undefined;
  reviewed?: NoticeLanguage[] | undefined;
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
  ai: boolean;
  /** The writing helps the site's owner turned off for the alliance (D126): their buttons are left out. */
  aiOff?: readonly AiKind[] | undefined;
  /** The members' game languages, counted, as a suggestion beside Translate (issue 794). */
  memberLanguages?: MemberLanguages | null | undefined;
  /** The viewer's language first. */
  languages: NoticeLanguage[];
  /** The language a stale one is updated from (the newest text). */
  source: NoticeLanguage | null;
  /** Opened from the read page's "Out of date" tag: this language is brought into view. */
  focus?: NoticeLanguage | undefined;
  /** Opened with Edit from the read page: the tab in view there, without scrolling to it (issue 412). */
  start?: NoticeLanguage | undefined;
  /** The notice's saves, newest first (D102); none for a new notice. */
  history?: HistoryItem[] | undefined;
  /** More edits exist than `history` holds: how many of the newest it holds. */
  historyCut?: number | undefined;
  onClose?: (() => void) | undefined;
  /** Opened from a review request (D113): Save closes it as "Edited by …". */
  review?: number | undefined;
  /** The notice's saved picture (D119); none for a new notice. */
  picture?: PictureView | null | undefined;
  /** Notice pictures turned off for the alliance (D126): no picture field; a stored picture stays. */
  pictureOff?: boolean | undefined;
}

/**
 * Warns before the page is left while `dirty`, unless the returned flag says the officer chose to leave.
 * Start here uses it too (D116).
 */
export function useLeaveWarning(dirty: boolean) {
  const allowed = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowed.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, allowed]);
  return allowed;
}

/**
 * The unsaved text on this device under `key`: read once the editor is in the page (undefined until then),
 * offered back while nothing new is typed, written while the draft differs from what the editor opened with
 * (`opened`, stable between renders). `fields` are the record's keys. Start here uses it too (D116).
 */
export function useKept<F extends string>(
  key: string,
  fields: readonly F[],
  opened: Record<F, string>,
  values: Record<F, string>,
  dirty: boolean,
  put: (values: Record<F, string>) => void,
) {
  const [offer, setOffer] = useState<Record<F, string> | null | undefined>(undefined);
  useEffect(() => {
    setOffer(restorable(readKept(key), opened, fields));
  }, [key, opened, fields]);
  useEffect(() => {
    if (dirty) writeKept(key, values);
    else if (offer === null) writeKept(key, null);
  }, [key, values, dirty, offer]);
  const shown = dirty ? null : (offer ?? null);
  return {
    /** Unsaved text this device kept from an earlier visit, while nothing new is typed. */
    restorable: shown !== null,
    restore: () => {
      if (shown) put(shown);
      setOffer(null);
    },
    forget: () => writeKept(key, null),
  };
}

/** The notice's text kept on this device (notice-keep.ts), against the fields it opened with. */
function useNoticeKept(
  p: EditorProps,
  values: Record<NoticeField, string>,
  dirty: boolean,
  put: (values: Record<NoticeField, string>) => void,
) {
  const opened = useMemo(() => startDraft(p.fields).values, [p.fields]);
  return useKept(keepKey(p.slug, p.id), NOTICE_FIELDS, opened, values, dirty, put);
}

/** Why the last Translate or Improve writing gave no draft, and the tab it was asked from. */
interface AiMessage {
  language: NoticeLanguage;
  key: WorkspaceKey;
}

/** The conflict banner, scrolled to and focused whenever another officer's save comes back. */
function useBanner(conflicts: Conflict[]) {
  const banner = useRef<HTMLDivElement>(null);
  const showBanner = () => {
    banner.current?.scrollIntoView({ block: "start" });
    banner.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (conflicts.length > 0) showBanner();
  }, [conflicts]);
  return { banner, showBanner };
}

/** Translate, Improve writing and "Fit to 1,000" (D81, D113), each from the text in the draft. */
function aiAsks(run: (ask: DraftAsk) => Promise<void>, values: Record<NoticeField, string>) {
  return {
    translate: (from: NoticeLanguage, to: NoticeLanguage[]) =>
      run({ kind: "translate", from, to, text: values[from] }),
    improve: (language: NoticeLanguage, tone: Tone) =>
      run({ kind: "improve", language, tone, text: values[language] }),
    fit: (language: NoticeLanguage) => run({ kind: "fit", language, text: values[language] }),
  };
}

/** Translate and Fit used, and an AI button that gave no draft (D115); a signed-out answer is not counted. */
function trackAsk(ask: DraftAsk, answer: Awaited<ReturnType<typeof askDraft>>) {
  if ("failed" in answer) {
    if (answer.failed !== "signedOut.text") track("ws_notice_ai_failed", { action: ask.kind });
  } else if (ask.kind === "translate") track("ws_notice_translated");
  else if (ask.kind === "fit") track("ws_notice_fit");
}

type Busy = DraftAsk["kind"] | "save" | "restore" | null;

/**
 * The save bar's note, and "Restore from trash?" after a save found the notice deleted (D118): any officer
 * may restore it. The draft stays in the editor (and on the device), so Save then keeps the officer's text.
 */
function useSaveNote(p: EditorProps, setBusy: (busy: Busy) => void) {
  const [message, setMessage] = useState<WorkspaceKey | null>(null);
  /** The last save found the notice in the trash: the save bar offers the restore. */
  const [trashed, setTrashed] = useState(false);
  const restoreFromTrash = async () => {
    if (p.id === null) return;
    setBusy("restore");
    const body = { id: p.id, requestId: newRequestId(), restore: true as const };
    const answer = await sendDelete(p.slug, body);
    setBusy(null);
    if (answer === "ok") setTrashed(false);
    const failed = answer === "signed_out" ? "signedOut.text" : "notices.trash.failed";
    setMessage(answer === "ok" ? "notices.trash.restored" : failed);
  };
  /** A save refused for another reason than a conflict. */
  const refused = (answer: { signedOut: boolean; deleted: boolean }) => {
    setTrashed(answer.deleted);
    setMessage(answer.signedOut ? "signedOut.text" : "notices.saveFailed");
  };
  return { message, setMessage, trashed, restoreFromTrash, refused };
}

/**
 * After a save: a new notice opens its page; a saved one is read again and the editor closes. A text change
 * also remounts the screen (its key); a picture-only save does not, so the editor closes itself (D119).
 */
function afterSave(router: ReturnType<typeof useRouter>, p: EditorProps, id: number) {
  if (p.id === null) return router.push(`/w/${p.slug}/notices/${id}`);
  router.refresh();
  p.onClose?.();
}

/** `picture`: the notice's picture held in the editor (D119), sent with Save. */
export function useEditor(p: EditorProps, picture: PictureDraft) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startDraft(p.fields));
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  // One per open editor (D100): a new notice's Save retried after a lost answer stores one notice.
  const [requestId] = useState(() => newRequestId());
  /** The action running now, if any: every AI button and Save wait for it. */
  const [busy, setBusy] = useState<Busy>(null);
  const [aiMessage, setAiMessage] = useState<AiMessage | null>(null);
  const [active, setActive] = useState<NoticeLanguage>(
    p.focus ?? p.start ?? p.languages[0] ?? "en",
  );
  /** "Restore this version" was pressed: the editor says what to do next until the draft is saved. */
  const [restored, setRestored] = useState(false);
  /** The tab the officer last typed in: where Translate fills an empty tab from. */
  const [wroteIn, setWroteIn] = useState<NoticeLanguage | null>(p.source);
  const { banner, showBanner } = useBanner(conflicts);
  const dirty = changesOf(draft).length > 0 || picture.changed;
  const leaving = useLeaveWarning(dirty);
  const note = useSaveNote(p, setBusy);
  const kept = useNoticeKept(p, draft.values, dirty, (values) =>
    setDraft((d) => ({ ...d, values })),
  );
  const run = async (ask: DraftAsk) => {
    setBusy(ask.kind);
    setAiMessage(null);
    const answer = await askDraft(p.slug, ask);
    setBusy(null);
    trackAsk(ask, answer);
    if ("failed" in answer) return setAiMessage({ language: askTab(ask), key: answer.failed });
    setDraft((d) => withDrafts(d, answer.drafts, ask, answer.partly));
  };
  const save = async () => {
    if (conflicts.length > 0) return showBanner();
    if (draft.values.title.trim() === "") return note.setMessage("notices.noTitle");
    const changes = changesOf(draft);
    if (changes.length === 0 && !picture.changed) return p.onClose?.();
    setBusy("save");
    note.setMessage(null);
    const answer = await saveWithPicture(p, picture, changes, requestId);
    setBusy(null);
    if (answer.ok) {
      leaving.current = true;
      kept.forget();
      return afterSave(router, p, answer.id);
    }
    if (answer.conflicts) return setConflicts(answer.conflicts);
    if ("picture" in answer) return note.setMessage(answer.picture);
    note.refused(answer);
  };
  return {
    draft,
    conflicts,
    busy,
    /** The error shows only on the tab it was asked from, even when the answer comes after a switch. */
    aiMessage: aiMessage?.language === active ? aiMessage.key : null,
    active,
    setActive,
    wroteIn,
    banner,
    dirty,
    leaving,
    save,
    ...note,
    ...kept,
    set: (field: NoticeField, value: string) => {
      if (isNoticeLanguage(field)) setWroteIn(field);
      setDraft((d) => ({ ...d, values: { ...d.values, [field]: value } }));
    },
    ...aiAsks(run, draft.values),
    restored,
    /** Puts an earlier version's fields in as a draft (D102); nothing is saved until Save. */
    restoreVersion: (earlier: Partial<Record<NoticeField, string>>) => {
      setDraft((d) => withRestored(d, earlier));
      setRestored(true);
    },
    accept: (language: NoticeLanguage) => setDraft((d) => accept(d, language)),
    undo: (language: NoticeLanguage) => setDraft((d) => discard(d, language)),
    keep: (language: NoticeLanguage) =>
      setDraft((d) => ({ ...d, kept: { ...d.kept, [language]: true } })),
    /** Keep mine or use theirs, for every field in the banner at once. */
    resolve: (keep: "theirs" | "mine") => {
      setDraft((d) => conflicts.reduce((next, c) => settle(next, c, keep), d));
      setConflicts([]);
    },
  };
}

export type Editor = ReturnType<typeof useEditor>;
