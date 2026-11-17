"use client";

// The officers' Start here editor (D105): one tab per language, EN · PT · FR, each with the glossary, the
// rules and who to ask. Save sends only the languages changed, with the version each was opened at; a
// language another officer saved since is refused (409) and nothing is written. Marked `data-unsaved` while
// it holds changes, so Sign out asks first (D99).
import { useRef, useState, type KeyboardEvent } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { fill, isolate } from "@/lib/copy";
import type { NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/schema-board";

import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Part = keyof StartHereText;
type Texts = Record<NoticeLanguage, StartHereText>;

export interface StartHereWords {
  glossary: string;
  rules: string;
  ask: string;
  glossaryHelp: string;
  rulesHelp: string;
  askHelp: string;
  languages: string;
  save: string;
  saving: string;
  saved: string;
  failed: string;
  /** "{name} saved the {lang} text while you were editing. …" */
  conflict: string;
  someone: string;
}

const PARTS: { part: Part; rows: number }[] = [
  { part: "glossary", rows: 8 },
  { part: "rules", rows: 10 },
  { part: "ask", rows: 4 },
];

/** POST the changed languages: the save's version, or the line to show (SIGNED_OUT on 401). */
async function post(
  slug: string,
  changes: { language: NoticeLanguage; version: number; text: StartHereText }[],
  w: StartHereWords,
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
    if (!first) return { error: w.failed };
    const name = isolate(first.by ?? w.someone);
    return { error: fill(w.conflict, { name, lang: LANGUAGE_NAME[first.language] }) };
  } catch {
    return { error: w.failed };
  }
}

/** EN · PT · FR as WAI-ARIA tabs (arrow keys, Home, End), with a dot on a language that holds changes. */
function TabBar(props: {
  languages: readonly NoticeLanguage[];
  active: NoticeLanguage;
  changed: readonly NoticeLanguage[];
  label: string;
  onPick: (l: NoticeLanguage) => void;
}) {
  const { languages, active } = props;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (ev: KeyboardEvent, i: number) => {
    const next = tabAfter(ev.key, i, languages.length);
    const language = next === null ? undefined : languages[next];
    if (next === null || !language) return;
    ev.preventDefault();
    props.onPick(language);
    buttons.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={props.label} className="grid grid-cols-3 border-b border-rule">
      {languages.map((l, i) => (
        <button
          key={l}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          id={`sh-tab-${l}`}
          type="button"
          role="tab"
          aria-selected={l === active}
          aria-controls="sh-panel"
          tabIndex={l === active ? 0 : -1}
          onClick={() => props.onPick(l)}
          onKeyDown={(ev) => onKey(ev, i)}
          className="tint-button min-h-12 px-1 font-semibold aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
        >
          <span aria-hidden="true">{LANGUAGE_CODE[l]}</span>
          <span className="sr-only">{LANGUAGE_NAME[l]}</span>
          {props.changed.includes(l) && (
            <span aria-hidden="true" className="ml-1 text-plum">
              •
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** The tab in view: the glossary, the rules and who to ask, each with its help line. */
function Panel(props: {
  language: NoticeLanguage;
  text: StartHereText;
  max: Record<Part, number>;
  words: StartHereWords;
  onChange: (part: Part, value: string) => void;
}) {
  const w = props.words;
  return (
    <div
      id="sh-panel"
      role="tabpanel"
      aria-labelledby={`sh-tab-${props.language}`}
      lang={props.language}
    >
      {PARTS.map(({ part, rows }) => (
        <label key={part} className="mt-4 block">
          <span className="font-semibold">{w[part]}</span>
          <span className="block text-body-sm text-ink/75">{w[`${part}Help`]}</span>
          <textarea
            value={props.text[part]}
            maxLength={props.max[part]}
            rows={rows}
            onChange={(ev) => props.onChange(part, ev.target.value)}
            className={`${FIELD} mt-1 text-base`}
          />
        </label>
      ))}
    </div>
  );
}

export function StartHereEditor(props: {
  slug: string;
  languages: readonly NoticeLanguage[];
  first: NoticeLanguage;
  texts: Texts;
  versions: Record<NoticeLanguage, number>;
  max: Record<Part, number>;
  words: StartHereWords;
}) {
  const { words: w, languages } = props;
  const [saved, setSaved] = useState(props.texts);
  const [texts, setTexts] = useState(props.texts);
  const [versions, setVersions] = useState(props.versions);
  const [active, setActive] = useState(props.first);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const changed = languages.filter((l) =>
    PARTS.some(({ part }) => texts[l][part] !== saved[l][part]),
  );

  async function save() {
    setState("saving");
    setError(null);
    const changes = changed.map((l) => ({ language: l, version: versions[l], text: texts[l] }));
    const result = await post(props.slug, changes, w);
    if ("error" in result) {
      setError(result.error);
      setState("idle");
      return;
    }
    // Every language of one save takes the save's version.
    setSaved((x) => ({ ...x, ...Object.fromEntries(changed.map((l) => [l, texts[l]])) }));
    setVersions((v) => ({ ...v, ...Object.fromEntries(changed.map((l) => [l, result.version])) }));
    setState("saved");
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
      data-unsaved={changed.length > 0 ? "" : undefined}
      className="mt-4 max-w-2xl"
    >
      <TabBar
        languages={languages}
        active={active}
        changed={changed}
        label={w.languages}
        onPick={setActive}
      />
      <Panel
        language={active}
        text={texts[active]}
        max={props.max}
        words={w}
        onChange={(part, value) => {
          setState("idle");
          setTexts((x) => ({ ...x, [active]: { ...x[active], [part]: value } }));
        }}
      />
      {error && <RefusalLine text={error} className="mt-3 text-body-sm font-semibold" />}
      {state === "saved" && changed.length === 0 && (
        <p role="status" className="mt-3 text-body-sm">
          {w.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={changed.length === 0 || state === "saving"}
        className={buttonClass("primary", "mt-4 w-full sm:w-auto disabled:opacity-60")}
      >
        {state === "saving" ? w.saving : w.save}
      </button>
    </form>
  );
}
