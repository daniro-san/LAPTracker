// The notice editor's state and actions (issues 304, 305, 293, 363): the draft, the language tab in view and
// the one the officer last wrote in, Translate and Improve writing with their own error line, Accept and Undo,
// the save with its version check, the conflict banner (shown and focused; Save brings it back), "Keep as is",
// a warning before the page is left with unsaved text, and that text kept on this device (notice-keep.ts).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { track } from "@/lib/analytics/events";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import {
  isNoticeLanguage,
  type NoticeField,
  type NoticeLanguage,
} from "@/lib/private/notice-rules";

import {
  askDraft,
  saveNotice,
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

export interface EditorProps {
  slug: string;
  id: number | null;
  fields: NoticeFields;
  stale: NoticeLanguage[];
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
  ai: boolean;
  /** The viewer's language first. */
  languages: NoticeLanguage[];
  /** The language a stale one is updated from (the newest text). */
  source: NoticeLanguage | null;
  /** Opened from the read page's "Out of date" tag: this language is brought into view. */
  focus?: NoticeLanguage | undefined;
  /** The notice's saves, newest first (D102); none for a new notice. */
  history?: HistoryItem[] | undefined;
  /** More edits exist than `history` holds: how many of the newest it holds. */
  historyCut?: number | undefined;
  onClose?: (() => void) | undefined;
  /** Opened from a review request (D113): Save closes it as "Edited by …". */
  review?: number | undefined;
}

/** Warns before the page is left while `dirty`, unless the returned flag says the officer chose to leave. */
function useLeaveWarning(dirty: boolean) {
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
 * The unsaved text on this device: read once the editor is in the page (undefined until then), offered
 * back while nothing new is typed, written while the draft differs from the saved notice.
 */
function useKept(
  p: EditorProps,
  values: Record<NoticeField, string>,
  dirty: boolean,
  put: (values: Record<NoticeField, string>) => void,
) {
  const key = keepKey(p.slug, p.id);
  const [offer, setOffer] = useState<Record<NoticeField, string> | null | undefined>(undefined);
  useEffect(() => {
    setOffer(restorable(readKept(key), startDraft(p.fields).values));
  }, [key, p.fields]);
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

export function useEditor(p: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startDraft(p.fields));
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  // One per open editor (D100): a new notice's Save retried after a lost answer stores one notice.
  const [requestId] = useState(() => crypto.randomUUID());
  /** The action running now, if any: every AI button and Save wait for it. */
  const [busy, setBusy] = useState<DraftAsk["kind"] | "save" | null>(null);
  const [message, setMessage] = useState<WorkspaceKey | null>(null);
  const [aiMessage, setAiMessage] = useState<AiMessage | null>(null);
  const [active, setActive] = useState<NoticeLanguage>(p.focus ?? p.languages[0] ?? "en");
  /** "Restore this version" was pressed: the editor says what to do next until the draft is saved. */
  const [restored, setRestored] = useState(false);
  /** The tab the officer last typed in: where Translate fills an empty tab from. */
  const [wroteIn, setWroteIn] = useState<NoticeLanguage | null>(p.source);
  const { banner, showBanner } = useBanner(conflicts);
  const dirty = changesOf(draft).length > 0;
  const leaving = useLeaveWarning(dirty);
  const kept = useKept(p, draft.values, dirty, (values) => setDraft((d) => ({ ...d, values })));
  const run = async (ask: DraftAsk) => {
    setBusy(ask.kind);
    setAiMessage(null);
    const answer = await askDraft(p.slug, ask);
    setBusy(null);
    if ("failed" in answer) return setAiMessage({ language: askTab(ask), key: answer.failed });
    setDraft((d) => withDrafts(d, answer.drafts, ask, answer.partly));
    if (ask.kind === "translate") track("ws_notice_translated");
  };
  const save = async () => {
    if (conflicts.length > 0) return showBanner();
    if (draft.values.title.trim() === "") return setMessage("notices.noTitle");
    const changes = changesOf(draft);
    if (changes.length === 0) return p.onClose?.();
    setBusy("save");
    setMessage(null);
    const answer = await saveNotice(p.slug, p.id, changes, requestId, p.review ?? null);
    setBusy(null);
    if (answer.ok) {
      leaving.current = true;
      kept.forget();
      if (p.id === null) router.push(`/w/${p.slug}/notices/${answer.id}`);
      else router.refresh();
      return;
    }
    if (answer.conflicts) setConflicts(answer.conflicts);
    else setMessage(answer.signedOut ? "signedOut.text" : "notices.saveFailed");
  };
  return {
    draft,
    conflicts,
    busy,
    message,
    /** The error shows only on the tab it was asked from, even when the answer comes after a switch. */
    aiMessage: aiMessage?.language === active ? aiMessage.key : null,
    active,
    setActive,
    wroteIn,
    banner,
    dirty,
    leaving,
    save,
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
