"use client";

// Translate and Improve writing (issues 305, 363), side by side under the text of the tab in view. Each is a
// two-line button that keeps its size while it works: Translate says where it goes ("to PT and FR", or "from
// EN" for an empty tab); Improve writing shows the tone and opens a small sheet of the six tones, where one tap
// asks for the draft. Under them: why they are off, the last error, or that the other languages' text becomes
// a draft (D81).
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import type { WorkspaceKey } from "@/lib/private/dictionary";
import { DRAFT_LIMIT } from "@/lib/private/notice-rules";

import { LANGUAGE_CODE } from "./languages";
import { translatePlan } from "./notice-draft";
import type { Editor, EditorProps } from "./notice-editor-state";
import { sheetWords } from "./sheet-words";

/** Improve writing's tones, in order; a Record, so tsc fails if a tone is left out. */
const TONE_WORDS: Record<Tone, WorkspaceKey> = {
  formal: "notices.tone.formal",
  warmer: "notices.tone.warmer",
  kinder: "notices.tone.kinder",
  direct: "notices.tone.direct",
  shorter: "notices.tone.shorter",
  fix: "notices.tone.fix",
};

const ACTION =
  "drawn-frame frame-button flex min-h-14 min-w-0 flex-col items-center justify-center px-2 py-1 text-center leading-tight disabled:cursor-default disabled:opacity-50";

function ToneSheet({
  p,
  tone,
  onPick,
  onClose,
}: {
  p: EditorProps;
  tone: Tone | null;
  onPick: (tone: Tone) => void;
  onClose: () => void;
}) {
  const { t } = p;
  return (
    <Sheet
      labelledBy="notice-tone-title"
      describedBy="notice-tone-help"
      onCancel={onClose}
      title={t["notices.improve"]}
      words={sheetWords(t)}
    >
      <p id="notice-tone-help" className="text-body-sm text-ink/75">
        {t["notices.tone.help"]}
      </p>
      <div role="group" aria-label={t["notices.tone.choose"]} className="mt-3 grid gap-2">
        {(Object.keys(TONE_WORDS) as Tone[]).map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={each === tone}
            data-initial-focus={each === (tone ?? "formal") ? "" : undefined}
            onClick={() => onPick(each)}
            className="drawn-frame-soft tint-button flex min-h-11 items-center justify-between gap-3 px-3 text-left font-medium aria-pressed:bg-plum/10 aria-pressed:text-plum"
          >
            {t[TONE_WORDS[each]]}
            {each === tone && (
              <span aria-hidden="true" className="text-plum">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Where Translate goes from the tab in view, why both buttons are off, and whether text gets replaced. */
function actionsOf(p: EditorProps, e: Editor) {
  const { t } = p;
  const language = e.active;
  const plan = translatePlan(e.draft, language, p.languages, e.wroteIn);
  const shown = plan ?? { from: language, to: p.languages.filter((l) => l !== language) };
  const codes = new Intl.ListFormat(p.viewer, { type: "conjunction" }).format(
    shown.to.map((l) => LANGUAGE_CODE[l]),
  );
  const longest = Math.max(e.draft.values[language].length, e.draft.values[shown.from].length);
  const reason: WorkspaceKey | null = !p.ai
    ? "notices.ai.off"
    : longest > DRAFT_LIMIT
      ? "notices.ai.tooLong"
      : null;
  return {
    plan,
    reason,
    where:
      shown.from === language
        ? fill(t["notices.translate.to"], { list: codes })
        : fill(t["notices.translate.from"], { lang: LANGUAGE_CODE[shown.from] }),
    /** Translate would turn text already in the other languages into drafts. */
    replaces: plan?.from === language && plan.to.some((l) => e.draft.values[l].trim() !== ""),
  };
}

/** One of the two buttons: its name (or "Working…") over a smaller second line, at a size that never moves. */
function ActionButton({
  working,
  name,
  detail,
  t,
  ...rest
}: {
  working: boolean;
  name: string;
  detail: ReactNode;
  t: EditorProps["t"];
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-busy={working} {...rest} className={ACTION}>
      <span className="font-semibold">{working ? t["notices.working"] : name}</span>
      <span className="text-[13px] text-ink/75">{detail}</span>
    </button>
  );
}

/** Under the buttons: why they are off, else the last error, else that other text becomes a draft. */
function ActionNote({
  p,
  e,
  reason,
  replaces,
}: {
  p: EditorProps;
  e: Editor;
  reason: WorkspaceKey | null;
  replaces: boolean;
}) {
  const { t } = p;
  if (reason)
    return (
      <p id="notice-ai-reason" className="mt-1 text-body-sm text-ink/75">
        {fill(t[reason], { limit: DRAFT_LIMIT })}
      </p>
    );
  if (e.aiMessage)
    return (
      <p role="alert" className="mt-1 text-body-sm font-semibold text-seal">
        {t[e.aiMessage]}
      </p>
    );
  return replaces ? (
    <p className="mt-1 text-body-sm text-ink/70">{t["notices.translateNote"]}</p>
  ) : null;
}

export function NoticeActions({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const [tone, setTone] = useState<Tone | null>(null);
  const [picking, setPicking] = useState(false);
  const language = e.active;
  const { plan, reason, where, replaces } = actionsOf(p, e);
  const off = reason !== null || e.busy !== null;
  const described = reason ? { "aria-describedby": "notice-ai-reason" } : {};
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <ActionButton
          t={t}
          working={e.busy === "translate"}
          name={t["notices.translate"]}
          detail={where}
          disabled={off || plan === null}
          {...described}
          onClick={() => plan && void e.translate(plan.from, plan.to)}
        />
        <ActionButton
          t={t}
          working={e.busy === "improve"}
          name={t["notices.improve"]}
          detail={
            <>
              {tone
                ? fill(t["notices.tone.current"], { tone: t[TONE_WORDS[tone]] })
                : t["notices.tone.choose"]}{" "}
              <span aria-hidden="true">▾</span>
            </>
          }
          disabled={off || e.draft.values[language].trim() === ""}
          aria-haspopup="dialog"
          aria-expanded={picking}
          {...described}
          onClick={() => setPicking(true)}
        />
      </div>
      <ActionNote p={p} e={e} reason={reason} replaces={replaces} />
      {picking && (
        <ToneSheet
          p={p}
          tone={tone}
          onClose={() => setPicking(false)}
          onPick={(chosen) => {
            setTone(chosen);
            setPicking(false);
            void e.improve(language, chosen);
          }}
        />
      )}
    </>
  );
}
