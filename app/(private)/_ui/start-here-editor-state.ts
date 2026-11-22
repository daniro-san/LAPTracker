"use client";

// Start here's editor state (D105, D116): the draft (start-here-draft.ts), the tab in view and the one last
// written in, Translate and Improve writing (one request per part that has text, through the notices'
// draft route) with their own error line, and the save with its per-language version check (409 names who
// saved first). The unsaved text is kept on this device and a warning comes before the page is left, with the
// notices editor's own hooks (notice-editor-state.ts, notice-keep.ts).
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { isolate } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceKey } from "@/lib/private/dictionary";
import type { NoticeLanguage } from "@/lib/private/notice-rules";
import { fill } from "@/lib/words";

import { LANGUAGE_NAME } from "./languages";
import { askDraft, type DraftAnswer } from "./notice-client";
import { useKept, useLeaveWarning } from "./notice-editor-state";
import { keepKey } from "./notice-keep";
import { SIGNED_OUT } from "./SignedOut";
import {
  flatTexts,
  PARTS,
  SH_FIELDS,
  shAccept,
  shChanges,
  shDirty,
  shKeep,
  shSaved,
  shSet,
  shUndo,
  startShDraft,
  textsOf,
  withShDrafts,
  type Part,
  type ShDraft,
  type Texts,
} from "./start-here-draft";
import type { StartHereProps } from "./StartHereEditor";

/** POST the changed languages: the save's version, or the line to show (SIGNED_OUT on 401). */
async function post(
  slug: string,
  changes: { language: NoticeLanguage; version: number; text: Texts[NoticeLanguage] }[],
  t: WorkspaceDictionary,
): Promise<{ version: number } | { error: string }> {
  try {
    const res = await fetch(`/api/w/${slug}/start-here`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    if (res.ok) return (await res.json()) as { version: number };
    if (res.status === 401) return { error: SIGNED_OUT };
    const body = (await res.json().catch(() => ({}))) as {
      conflicts?: { language: NoticeLanguage; by: string | null }[];
    };
    const first = body.conflicts?.[0];
    if (!first) return { error: t["starthere.failed"] };
    const name = isolate(first.by ?? t["starthere.someone"]);
    return { error: fill(t["starthere.conflict"], { name, lang: LANGUAGE_NAME[first.language] }) };
  } catch {
    return { error: t["starthere.failed"] };
  }
}

/** Why the last Translate or Improve writing gave no draft, and the tab it was asked from. */
type AiMessage = { language: NoticeLanguage; key: WorkspaceKey };

/** What the save sends for `languages`: each one's text and the version it was opened at. */
const changesOf = (draft: ShDraft, languages: NoticeLanguage[]) =>
  languages.map((l) => ({ language: l, version: draft.versions[l], text: draft.values[l] }));

/** One answer per part, turned into each language's new parts. */
function byLanguage(parts: Part[], answers: DraftAnswer[]) {
  const languages = [...new Set(answers.flatMap((a) => Object.keys(a.drafts)))] as NoticeLanguage[];
  return Object.fromEntries(
    languages.map((l) => [
      l,
      Object.fromEntries(
        parts.flatMap((part, i) => {
          const text = answers[i]?.drafts[l];
          return text === undefined ? [] : [[part, text]];
        }),
      ),
    ]),
  );
}

/** The unsaved text kept on this device, offered back, and the warning before leaving (as on a notice). */
function useStartHereKept(
  p: StartHereProps,
  draft: ShDraft,
  setDraft: Dispatch<SetStateAction<ShDraft>>,
) {
  const dirty = shDirty(draft);
  const leaving = useLeaveWarning(dirty);
  const opened = useMemo(() => flatTexts(p.texts), [p.texts]);
  const values = useMemo(() => flatTexts(draft.values), [draft.values]);
  const kept = useKept(keepKey(p.slug, "start-here"), SH_FIELDS, opened, values, dirty, (v) =>
    setDraft((d) => ({ ...d, values: textsOf(v) })),
  );
  return { dirty, leaving, ...kept };
}

/** The draft, the tab in view, Translate and Improve writing, and the save. */
export function useStartHere(p: StartHereProps) {
  const [draft, setDraft] = useState(() => startShDraft(p.texts, p.versions));
  const kept = useStartHereKept(p, draft, setDraft);
  const [active, setActive] = useState(p.first);
  /** The tab the officer last typed in: where Translate fills an empty tab from. */
  const [wroteIn, setWroteIn] = useState<NoticeLanguage | null>(null);
  const [busy, setBusy] = useState<"translate" | "improve" | "save" | null>(null);
  const [aiMessage, setAiMessage] = useState<AiMessage | null>(null);
  // An error carries the line to show (SIGNED_OUT on 401).
  const [saveState, setSaveState] = useState<"idle" | "saved" | { error: string }>("idle");

  /** One draft request per part of `from` that has text; the answers go in as one draft per language. */
  async function run(
    tab: NoticeLanguage,
    from: NoticeLanguage,
    ask: (text: string, limit: number) => Parameters<typeof askDraft>[1],
    translated: NoticeLanguage | null,
  ) {
    const parts = PARTS.filter((part) => draft.values[from][part].trim() !== "");
    setBusy(translated ? "translate" : "improve");
    setAiMessage(null);
    const answers = await Promise.all(
      parts.map((part) => askDraft(p.slug, ask(draft.values[from][part], p.max[part]))),
    );
    setBusy(null);
    const failed = answers.find((a) => "failed" in a);
    if (failed && "failed" in failed) return setAiMessage({ language: tab, key: failed.failed });
    const done = answers.flatMap((a) => ("drafts" in a ? [a] : []));
    const partly = done.flatMap((a) => a.partly);
    setSaveState("idle");
    setDraft((d) => withShDrafts(d, byLanguage(parts, done), translated, partly));
  }

  async function save() {
    const languages = shChanges(draft);
    if (languages.length === 0) return;
    setBusy("save");
    const result = await post(p.slug, changesOf(draft, languages), p.t);
    setBusy(null);
    if ("error" in result) return setSaveState({ error: result.error });
    kept.forget();
    setDraft((d) => shSaved(d, languages, result.version));
    setSaveState("saved");
  }

  return {
    ...kept,
    draft,
    active,
    setActive,
    wroteIn,
    busy,
    saveState,
    save,
    aiMessage: aiMessage?.language === active ? aiMessage.key : null,
    set: (part: Part, value: string) => {
      setWroteIn(active);
      setSaveState("idle");
      setDraft((d) => shSet(d, active, part, value));
    },
    // An error belongs to the tab asked from: the one tab filled ("Update from …"), else the source.
    translate: (from: NoticeLanguage, to: NoticeLanguage[]) =>
      run(
        to[1] ? from : (to[0] ?? from),
        from,
        (text, limit) => ({ kind: "translate", from, to, text, limit }),
        from,
      ),
    improve: (language: NoticeLanguage, tone: Tone) =>
      run(
        language,
        language,
        (text, limit) => ({ kind: "improve", language, tone, text, limit }),
        null,
      ),
    accept: (l: NoticeLanguage) => setDraft((d) => shAccept(d, l)),
    undo: (l: NoticeLanguage) => setDraft((d) => shUndo(d, l)),
    keep: (l: NoticeLanguage) => {
      setSaveState("idle");
      setDraft((d) => shKeep(d, l));
    },
  };
}

export type StartHere = ReturnType<typeof useStartHere>;
