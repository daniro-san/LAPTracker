"use client";

// What the two language editors share (D116): the notices editor (issues 304, 305, 363, D113) and Start here
// (D105). The language tabs are LanguageTabs.tsx; here: a
// draft's mark with Accept and Undo; the two-line Translate / Improve writing / Fit buttons; Improve writing's
// sheet of tones; and the line under the buttons. The sticky save bar is EditorSaveBar.tsx. Each editor keeps
// its own state and save; these parts only draw it, so both look and behave the same. Every control is 44 px
// or more; nothing is hover-only.
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import { DRAFT_LIMIT, NOTICE_LIMIT } from "@/lib/private/notice-rules";

import { smallButton } from "./NoticeBits";
import { sheetWords } from "./sheet-words";
import { SignedOutNote } from "./SignedOut";

export type DraftKind = "translate" | "improve" | "fit" | "restore";

/** A draft in the tab in view: where it came from, Accept and Undo, and "Partly untranslated". */
export function DraftMark(props: {
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
  kind: DraftKind | null;
  partly: boolean;
  onAccept: () => void;
  onUndo: () => void;
}) {
  const { t, kind } = props;
  if (!kind) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-1 basis-48 items-center gap-2 text-body-sm font-semibold text-plum">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-plum" />
          {fill(t[`notices.draft.${kind}`], {
            limit: new Intl.NumberFormat(props.viewer).format(NOTICE_LIMIT),
          })}
        </p>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={props.onAccept}
            className={smallButton("border-plum font-semibold text-plum")}
          >
            {t["notices.accept"]}
          </button>
          <button type="button" onClick={props.onUndo} className={smallButton()}>
            {t["notices.undo"]}
          </button>
        </span>
      </div>
      {props.partly && (
        <p role="status" className="mt-1 text-body-sm font-semibold text-seal">
          {t["notices.draft.partly"]}
        </p>
      )}
    </div>
  );
}

/** Improve writing's tones, in order; a Record, so tsc fails if a tone is left out. */
export const TONE_WORDS: Record<Tone, WorkspaceKey> = {
  formal: "notices.tone.formal",
  warmer: "notices.tone.warmer",
  kinder: "notices.tone.kinder",
  direct: "notices.tone.direct",
  shorter: "notices.tone.shorter",
  fix: "notices.tone.fix",
};

function ToneSheet(props: {
  t: WorkspaceDictionary;
  tone: Tone | null;
  onPick: (tone: Tone) => void;
  onClose: () => void;
}) {
  const { t, tone } = props;
  return (
    <Sheet
      labelledBy="notice-tone-title"
      describedBy="notice-tone-help"
      onCancel={props.onClose}
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
            onClick={() => props.onPick(each)}
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

/** The frame of a two-line action; `primary` is "Shorten to 1,000" while the text is over the limit (D113). */
const SHAPE =
  "flex min-h-14 min-w-0 flex-col items-center justify-center px-2 py-1 text-center leading-tight disabled:cursor-default disabled:opacity-50";

/** One of the buttons: its name (or "Working…") over a smaller second line, at a size that never moves. */
export function ActionButton({
  working,
  name,
  detail,
  t,
  primary = false,
  className = "",
  ...rest
}: {
  working: boolean;
  name: string;
  detail: ReactNode;
  t: WorkspaceDictionary;
  primary?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const look = primary ? "ink-button" : "drawn-frame frame-button";
  return (
    <button type="button" aria-busy={working} {...rest} className={`${look} ${SHAPE} ${className}`}>
      <span className="font-semibold">{working ? t["notices.working"] : name}</span>
      <span className={`text-[13px] ${primary ? "" : "text-ink/75"}`}>{detail}</span>
    </button>
  );
}

/**
 * Improve writing: the button that shows the tone and opens the sheet of tones, where one tap asks for the
 * draft. `disabled`/`described` as for the other buttons.
 */
export function ImproveButton(props: {
  t: WorkspaceDictionary;
  working: boolean;
  disabled: boolean;
  described: { "aria-describedby"?: string };
  onImprove: (tone: Tone) => void;
}) {
  const { t } = props;
  const [tone, setTone] = useState<Tone | null>(null);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <ActionButton
        t={t}
        working={props.working}
        name={t["notices.improve"]}
        detail={
          <>
            {tone
              ? fill(t["notices.tone.current"], { tone: t[TONE_WORDS[tone]] })
              : t["notices.tone.choose"]}{" "}
            <span aria-hidden="true">▾</span>
          </>
        }
        disabled={props.disabled}
        aria-haspopup="dialog"
        aria-expanded={picking}
        {...props.described}
        onClick={() => setPicking(true)}
      />
      {picking && (
        <ToneSheet
          t={t}
          tone={tone}
          onClose={() => setPicking(false)}
          onPick={(chosen) => {
            setTone(chosen);
            setPicking(false);
            props.onImprove(chosen);
          }}
        />
      )}
    </>
  );
}

/** The id the buttons point to while they are off. */
export const AI_REASON_ID = "notice-ai-reason";

/** Under the buttons: why they are off, else the last error, else that other text becomes a draft. */
export function ActionNote(props: {
  t: WorkspaceDictionary;
  reason: WorkspaceKey | null;
  message: WorkspaceKey | null;
  replaces: boolean;
}) {
  const { t, reason, message } = props;
  if (reason)
    return (
      <p id={AI_REASON_ID} className="mt-1 text-body-sm text-ink/75">
        {fill(t[reason], { limit: DRAFT_LIMIT })}
      </p>
    );
  if (message === "signedOut.text") return <SignedOutNote className="mt-1" />;
  if (message)
    return (
      <p role="alert" className="mt-1 text-body-sm font-semibold text-seal">
        {t[message]}
      </p>
    );
  return props.replaces ? (
    <p className="mt-1 text-body-sm text-ink/70">{t["notices.translateNote"]}</p>
  ) : null;
}
