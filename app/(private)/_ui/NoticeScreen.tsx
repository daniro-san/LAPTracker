"use client";

// One notice (issue 304): read it in each language with one Copy per language, for pasting into the game or
// Discord, or edit it. A language that may be out of date carries an "Out of date" tag, which opens the editor
// at that language; "Update from …" and "Keep as is" are there, behind the editor's save and its checks.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { NoticeLanguage } from "@/lib/private/notice-rules";

import { CopyButton } from "./CopyButton";
import { LANGUAGE_NAME } from "./languages";
import { Counter, OutOfDateTag, OverLimit } from "./NoticeBits";
import { NoticeEditor, type EditorProps } from "./NoticeEditor";

export interface ScreenProps extends Omit<EditorProps, "focus" | "onClose" | "id"> {
  id: number;
  /** Server-made lines: who wrote it and who changed it last, and the members flag and end date. */
  meta: { written: string; changed: string; flags: string[] };
}

function LanguageText({
  p,
  language,
  onEdit,
}: {
  p: ScreenProps;
  language: NoticeLanguage;
  onEdit: () => void;
}) {
  const { t } = p;
  const field = p.fields[language];
  const name = LANGUAGE_NAME[language];
  return (
    <section aria-labelledby={`read-${language}`} className="mt-5 border-t border-rule pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <h2 id={`read-${language}`} className="font-subhead text-display-sm">
            {name}
          </h2>
          {p.stale.includes(language) && (
            <OutOfDateTag
              label={fill(t["notices.outOfDate.aria"], { lang: name })}
              onOpen={onEdit}
              t={t}
            />
          )}
        </span>
        <Counter text={field.value} t={t} />
      </div>
      {field.value === "" ? (
        <p className="mt-2 text-ink/70">{t["notices.missing"]}</p>
      ) : (
        <>
          <div lang={language} translate="no" className="mt-2 break-words whitespace-pre-wrap">
            {field.value}
          </div>
          <OverLimit text={field.value} t={t} />
          <div className="mt-3">
            <CopyButton
              text={field.value}
              labels={{
                copy: fill(t["notices.copy"], { lang: name }),
                copied: t["members.copied"],
                failed: t["members.copyFailed"],
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}

export function NoticeScreen(p: ScreenProps) {
  /** null: reading. A language: editing, opened at it. true: editing from the top. */
  const [editing, setEditing] = useState<NoticeLanguage | true | null>(null);
  const { t } = p;
  if (editing) {
    return (
      <>
        <h1 className="font-display text-display-lg">{t["notices.edit.title"]}</h1>
        <NoticeEditor
          {...p}
          focus={editing === true ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-display-lg break-words">{p.fields.title.value}</h1>
      <p className="mt-2 text-body-sm text-ink/80">{p.meta.written}</p>
      <p className="text-body-sm text-ink/80">{p.meta.changed}</p>
      <ul className="mt-2 flex flex-wrap gap-2 text-body-sm">
        {p.meta.flags.map((flag) => (
          <li key={flag} className="border border-rule px-2 py-0.5">
            {flag}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={buttonClass("secondary", "mt-4")}
      >
        {t["notices.edit"]}
      </button>
      {p.languages.map((language) => (
        <LanguageText
          key={language}
          p={p}
          language={language}
          onEdit={() => setEditing(language)}
        />
      ))}
    </>
  );
}
