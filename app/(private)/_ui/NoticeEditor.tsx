"use client";

// The notice editor (issues 304, 305, 293): the title, the three languages, "Show to members" and the end
// date. Translate and Improve writing fill drafts in the page; nothing is saved until the officer presses
// Save. A save sends only the fields that changed, each with the version the officer was looking at; when
// someone else saved one first, the server refuses (409) and one banner at the top shows both versions.
// While the form is open the bottom tabs are hidden (Frame), so the save bar is never under them.
import { useEffect } from "react";

import { useEditor, type EditorProps } from "./notice-editor-state";
import { ConflictBanner } from "./NoticeBits";
import { Flags, SaveBar } from "./NoticeEditorParts";
import { LanguageField } from "./NoticeLanguageField";

export type { EditorProps } from "./notice-editor-state";

export function NoticeEditor(p: EditorProps) {
  const e = useEditor(p);
  const { draft } = e;
  const { t } = p;
  useEffect(() => {
    if (p.focus)
      document.getElementById(`notice-${p.focus}-label`)?.scrollIntoView({ block: "start" });
  }, [p.focus]);
  return (
    <form
      data-notice-editor=""
      onSubmit={(event) => {
        event.preventDefault();
        void e.save();
      }}
    >
      {e.conflicts.length > 0 && (
        <ConflictBanner
          conflicts={e.conflicts}
          mine={(field) => draft.values[field]}
          t={t}
          onKeepMine={() => e.resolve("mine")}
          onUseTheirs={() => e.resolve("theirs")}
          focusRef={e.banner}
        />
      )}
      <label htmlFor="notice-title" className="mt-3 block font-semibold">
        {t["notices.title"]}
      </label>
      <input
        id="notice-title"
        value={draft.values.title}
        maxLength={200}
        onChange={(ev) => e.set("title", ev.target.value)}
        className="mt-1 block min-h-11 w-full border border-rule bg-paper px-3"
      />
      {p.languages.map((language) => {
        const others = p.languages.filter((l) => l !== language);
        const stale =
          p.stale.includes(language) &&
          !draft.kept[language] &&
          draft.values[language] === draft.base[language];
        return (
          <LanguageField
            key={language}
            language={language}
            others={others}
            value={draft.values[language]}
            onChange={(v) => e.set(language, v)}
            t={t}
            viewer={p.viewer}
            ai={p.ai}
            busy={e.busy}
            stale={stale ? { from: p.source } : null}
            drafted={draft.undo[language] !== undefined}
            partly={draft.partly[language] === true}
            othersWritten={others.some((l) => draft.values[l].trim() !== "")}
            onTranslate={(from, to) => void e.translate(from, to)}
            onImprove={(tone) => void e.improve(language, tone)}
            onUndo={() => e.undo(language)}
            onKeep={() => e.keep(language)}
          />
        );
      })}
      <Flags e={e} t={t} />
      <SaveBar p={p} e={e} />
    </form>
  );
}
