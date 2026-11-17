// The notice editor's state and actions (issues 304, 305, 293): the draft, Translate and Improve writing, the
// save with its version check, the conflict banner (shown and focused; Save brings it back), "Keep as is", and
// a warning before the page is left with unsaved text.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { track } from "@/lib/analytics/events";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import type { NoticeField, NoticeLanguage } from "@/lib/private/notice-rules";

import {
  askDraft,
  saveNotice,
  type Conflict,
  type DraftAsk,
  type NoticeFields,
} from "./notice-client";
import { changesOf, omit, settle, startDraft, withDrafts } from "./notice-draft";

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
  onClose?: (() => void) | undefined;
}

/** Warns before the page is left while `dirty`, unless `allowed` says the officer chose to leave. */
function useLeaveWarning(dirty: boolean, allowed: { current: boolean }) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowed.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, allowed]);
}

export function useEditor(p: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startDraft(p.fields));
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<WorkspaceKey | null>(null);
  const banner = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const dirty = changesOf(draft).length > 0;
  useLeaveWarning(dirty, leaving);
  const showBanner = () => {
    banner.current?.scrollIntoView({ block: "start" });
    banner.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (conflicts.length > 0) showBanner();
  }, [conflicts]);
  const run = async (label: string, ask: DraftAsk) => {
    setBusy(label);
    setMessage(null);
    const answer = await askDraft(p.slug, ask);
    setBusy(null);
    if ("failed" in answer) return setMessage(answer.failed);
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
    const answer = await saveNotice(p.slug, p.id, changes);
    setBusy(null);
    if (answer.ok) {
      leaving.current = true;
      if (p.id === null) router.push(`/w/${p.slug}/notices/${answer.id}`);
      else router.refresh();
      return;
    }
    if (answer.conflicts) setConflicts(answer.conflicts);
    else setMessage("notices.saveFailed");
  };
  return {
    draft,
    conflicts,
    busy,
    message,
    banner,
    dirty,
    leaving,
    save,
    set: (field: NoticeField, value: string) =>
      setDraft((d) => ({ ...d, values: { ...d.values, [field]: value } })),
    translate: (from: NoticeLanguage, to: NoticeLanguage[]) =>
      run(`translate:${to.length === 1 ? to[0] : from}`, {
        kind: "translate",
        from,
        to,
        text: draft.values[from],
      }),
    improve: (language: NoticeLanguage, tone: Tone) =>
      run(`improve:${language}`, { kind: "improve", language, tone, text: draft.values[language] }),
    undo: (language: NoticeLanguage) =>
      setDraft((d) => ({
        ...d,
        values: { ...d.values, [language]: d.undo[language] ?? d.values[language] },
        undo: omit(d.undo, language),
        partly: omit(d.partly, language),
        from: omit(d.from, language),
      })),
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
