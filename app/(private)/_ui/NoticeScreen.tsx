"use client";

// One notice (issue 304): read it in each language with one Copy per language, for pasting into the game or
// Discord, or edit it. A language that may be out of date says so, with "Translate from …" (opens the
// editor and translates) and "Keep as is" (saves it unchanged, which clears the line).
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { NoticeLanguage } from "@/lib/private/notice-rules";

import { CopyButton } from "./CopyButton";
import { saveNotice, LANGUAGE_CODE, LANGUAGE_NAME } from "./notice-client";
import { Counter, smallButton, StaleLine } from "./NoticeBits";
import { NoticeEditor, type EditorProps } from "./NoticeEditor";

export interface ScreenProps extends Omit<EditorProps, "start" | "onClose" | "id"> {
  id: number;
  /** Server-made lines: who wrote it and who changed it last, and the members flag and end date. */
  meta: { written: string; changed: string; flags: string[] };
}

function LanguageText({
  p,
  language,
  onTranslate,
}: {
  p: ScreenProps;
  language: NoticeLanguage;
  onTranslate: (from: NoticeLanguage) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { t } = p;
  const field = p.fields[language];
  const keep = async () => {
    setBusy(true);
    await saveNotice(p.slug, p.id, [
      { field: language, value: field.value, version: field.version },
    ]);
    router.refresh();
  };
  return (
    <section aria-labelledby={`read-${language}`} className="mt-5 border-t border-rule pt-3">
      <div className="flex items-start justify-between gap-3">
        <h2 id={`read-${language}`} className="font-subhead text-display-sm">
          {LANGUAGE_NAME[language]}
        </h2>
        <Counter text={field.value} t={t} />
      </div>
      {p.stale.includes(language) && (
        <StaleLine t={t}>
          {p.ai && p.source && (
            <button
              type="button"
              onClick={() => p.source && onTranslate(p.source)}
              className={smallButton("text-plum")}
            >
              {fill(t["notices.translateFrom"], { lang: LANGUAGE_CODE[p.source] })}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void keep()}
            className={smallButton()}
          >
            {t["notices.keep"]}
          </button>
        </StaleLine>
      )}
      {field.value === "" ? (
        <p className="mt-2 text-ink/70">{t["notices.missing"]}</p>
      ) : (
        <>
          <div lang={language} translate="no" className="mt-2 break-words whitespace-pre-wrap">
            {field.value}
          </div>
          <div className="mt-3">
            <CopyButton
              text={field.value}
              labels={{
                copy: fill(t["notices.copy"], { lang: LANGUAGE_CODE[language] }),
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
  const [editing, setEditing] = useState<EditorProps["start"] | true | null>(null);
  const { t } = p;
  if (editing) {
    return (
      <>
        <h1 className="font-display text-display-lg">{t["notices.edit"]}</h1>
        <NoticeEditor
          {...p}
          start={editing === true ? undefined : editing}
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
          onTranslate={(from) => setEditing({ from, to: [language] })}
        />
      ))}
    </>
  );
}
