"use client";

// The notice editor (issues 304, 305, 293): the title, the three languages, "show to members" and the end
// date. Translate and Improve writing fill drafts in the page; nothing is saved until the officer presses
// Save. A save sends only the fields that changed, each with the version the officer was looking at; when
// someone else saved one first, the server refuses (409) and the field shows their text, to keep or replace.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { Notice } from "@/lib/brand/components/Notice";
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
import { changesOf, omit, settle, startDraft, withDrafts, type Draft } from "./notice-draft";
import { ConflictBox, smallButton } from "./NoticeBits";
import { LanguageField } from "./NoticeLanguageField";

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
  /** The language to translate a stale one from (newest text). */
  source: NoticeLanguage | null;
  /** Run once on opening: the read view's "Translate from …". */
  start?: { from: NoticeLanguage; to: NoticeLanguage[] } | undefined;
  onClose?: (() => void) | undefined;
}

function useEditor(p: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => startDraft(p.fields));
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<WorkspaceKey | null>(null);
  const run = async (label: string, ask: DraftAsk) => {
    setBusy(label);
    setMessage(null);
    const answer = await askDraft(p.slug, ask);
    setBusy(null);
    if ("failed" in answer) return setMessage(answer.failed);
    setDraft((d) => withDrafts(d, answer.drafts, ask));
    if (ask.kind === "translate") track("ws_notice_translated");
  };
  const save = async () => {
    if (draft.values.title.trim() === "") return setMessage("notices.noTitle");
    const changes = changesOf(draft);
    if (changes.length === 0) return p.onClose?.();
    setBusy("save");
    setMessage(null);
    const answer = await saveNotice(p.slug, p.id, changes);
    setBusy(null);
    if (answer.ok) {
      if (p.id === null) router.push(`/w/${p.slug}/notices/${answer.id}`);
      else router.refresh();
      return;
    }
    setConflicts(answer.conflicts ?? []);
    setMessage(answer.conflicts ? "notices.conflict.head" : "notices.saveFailed");
  };
  return {
    draft,
    conflicts,
    busy,
    message,
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
        from: omit(d.from, language),
      })),
    resolve: (c: Conflict, keep: "theirs" | "mine") => {
      setDraft((d) => settle(d, c, keep));
      setConflicts((all) => all.filter((x) => x.field !== c.field));
    },
  };
}

type Editor = ReturnType<typeof useEditor>;

export function NoticeEditor(p: EditorProps) {
  const e = useEditor(p);
  const { draft, t } = { draft: e.draft, t: p.t };
  const started = useRef(false);
  useEffect(() => {
    if (!p.start || started.current) return;
    started.current = true;
    void e.translate(p.start.from, p.start.to);
  });
  const conflictOf = (field: NoticeField) => e.conflicts.find((c) => c.field === field) ?? null;
  const box = (field: NoticeField) => {
    const c = conflictOf(field);
    return (
      c && (
        <ConflictBox
          conflict={c}
          t={t}
          language={p.viewer}
          onTheirs={() => e.resolve(c, "theirs")}
          onMine={() => e.resolve(c, "mine")}
        />
      )
    );
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void e.save();
      }}
    >
      {!p.ai && <p className="mt-2 text-body-sm text-ink/75">{t["notices.ai.off"]}</p>}
      <label htmlFor="notice-title" className="mt-3 block font-semibold">
        {t["notices.title"]}
      </label>
      {box("title")}
      <input
        id="notice-title"
        value={draft.values.title}
        maxLength={200}
        onChange={(ev) => e.set("title", ev.target.value)}
        className="mt-1 block min-h-11 w-full border border-rule bg-paper px-3"
      />
      {p.languages.map((language) => (
        <LanguageField
          key={language}
          language={language}
          others={p.languages.filter((l) => l !== language)}
          value={draft.values[language]}
          onChange={(v) => e.set(language, v)}
          t={t}
          viewer={p.viewer}
          ai={p.ai}
          busy={e.busy}
          stale={
            p.stale.includes(language) && draft.values[language] === draft.base[language]
              ? { from: p.source }
              : null
          }
          drafted={draft.undo[language] !== undefined}
          conflict={conflictOf(language)}
          onTranslate={(from, to) => void e.translate(from, to)}
          onImprove={(tone) => void e.improve(language, tone)}
          onUndo={() => e.undo(language)}
          onConflict={(keep) => {
            const c = conflictOf(language);
            if (c) e.resolve(c, keep);
          }}
        />
      ))}
      <Flags draft={draft} set={e.set} t={t} box={box} />
      <Actions p={p} e={e} />
    </form>
  );
}

function Actions({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  return (
    // Sticky above the tabs, with the last message in it, so Save and what went wrong stay in view.
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[5] -mx-4 mt-4 border-t border-rule bg-paper px-4 py-2 sm:-mx-6 sm:px-6">
      {e.message && (
        <Notice tone="fail" className="mb-2">
          {t[e.message]}
        </Notice>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={e.busy !== null}
          className={buttonClass("primary", "flex-1 sm:flex-none")}
        >
          {e.busy === "save" ? t["notices.saving"] : t["notices.save"]}
        </button>
        {p.onClose ? (
          <button type="button" onClick={p.onClose} className={buttonClass("secondary")}>
            {t["notices.cancel"]}
          </button>
        ) : (
          <a href={`/w/${p.slug}/notices`} className={buttonClass("secondary")}>
            {t["notices.cancel"]}
          </a>
        )}
      </div>
    </div>
  );
}

function Flags({
  draft,
  set,
  t,
  box,
}: {
  draft: Draft;
  set: (field: NoticeField, value: string) => void;
  t: WorkspaceDictionary;
  box: (field: NoticeField) => ReactNode;
}) {
  return (
    <div className="mt-6 space-y-4 border-t border-rule pt-4">
      <div>
        {box("for_members")}
        <CheckField
          label={t["notices.show"]}
          help={t["notices.show.help"]}
          checked={draft.values.for_members === "true"}
          onChange={(ev) => set("for_members", String(ev.target.checked))}
        />
      </div>
      <div>
        <label htmlFor="notice-ends" className="block font-semibold">
          {t["notices.endsOn"]}
        </label>
        <p className="text-body-sm text-ink/70">{t["notices.endsOn.help"]}</p>
        {box("ends_on")}
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="notice-ends"
            type="date"
            value={draft.values.ends_on}
            onChange={(ev) => set("ends_on", ev.target.value)}
            className="min-h-11 border border-rule bg-paper px-3"
          />
          {draft.values.ends_on && (
            <button type="button" onClick={() => set("ends_on", "")} className={smallButton()}>
              {t["notices.clear"]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
