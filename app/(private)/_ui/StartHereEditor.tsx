"use client";

// The officers' Start here editor (D105), built on the notices editor's parts (LanguageEditorParts.tsx, D116):
// the EN · PT · FR tabs with their state, "may be out of date" with "Update from …" and "Keep as is", the
// draft's mark with Accept and Undo, Translate and Improve writing under the text, and the sticky save bar.
// Each tab holds the glossary, the rules and who to ask. Translate and Improve writing send each part of the
// language that has text through the notices' draft route; nothing is saved until Save. Save sends only the
// languages changed (and the source of a translation, start-here-draft.ts), each with the version it was
// opened at; a language another officer saved since is refused (409) and nothing is written. Marked
// `data-unsaved` while it holds changes, so Sign out asks first (D99); `data-notice-editor` hides the bottom
// tabs, as in the notices editor, so the save bar is never under them.
import { FIELD } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { fill } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import { DRAFT_LIMIT, type NoticeLanguage } from "@/lib/private/notice-rules";

import { SaveBar } from "./EditorSaveBar";
import {
  ActionButton,
  ActionNote,
  AI_REASON_ID,
  DraftMark,
  ImproveButton,
  LanguageTabs,
} from "./LanguageEditorParts";
import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";
import { smallButton, StaleLine } from "./NoticeBits";
import { RefusalLine } from "./SignedOut";
import {
  newestSaved,
  PARTS,
  shDirty,
  shDraftKind,
  shTabState,
  shTranslatePlan,
  written,
  type Part,
  type ShDraft,
  type Texts,
} from "./start-here-draft";
import { useStartHere, type StartHere } from "./start-here-editor-state";

export interface StartHereProps {
  slug: string;
  /** False without the translator's key (D81): Translate and Improve writing are off and say why. */
  ai: boolean;
  languages: readonly NoticeLanguage[];
  first: NoticeLanguage;
  texts: Texts;
  versions: Record<NoticeLanguage, number>;
  max: Record<Part, number>;
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
}

const ROWS: Record<Part, number> = { glossary: 8, rules: 10, ask: 4 };

/** "PT is missing Who to ask": a part written in another language but empty in this one. */
function Missing({ d, p }: { d: ShDraft; p: StartHereProps }) {
  const { t, languages } = p;
  const lines = languages.flatMap((l) => {
    const gaps = PARTS.filter(
      (part) =>
        d.values[l][part].trim() === "" && languages.some((o) => d.values[o][part].trim() !== ""),
    ).map((part) => `“${t[`board.start.${part}`]}”`);
    return gaps.length === 0
      ? []
      : [fill(t["starthere.missing"], { lang: LANGUAGE_CODE[l], parts: gaps.join(", ") })];
  });
  if (lines.length === 0) return null;
  return (
    <ul className="mt-2 text-body-sm text-ink/80">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

type Editor = StartHere;

/** The tab in view: out of date, the draft's mark, and the three parts with their help lines. */
function Panel({ p, e }: { p: StartHereProps; e: Editor }) {
  const { t } = p;
  const { draft: d, active: language } = e;
  const source = newestSaved(d);
  const drafted = d.parts[language] ?? [];
  return (
    <div id="sh-panel" role="tabpanel" aria-labelledby={`sh-tab-${language}`}>
      {shTabState(d, language) === "stale" && (
        <StaleLine t={t}>
          {p.ai && source && source !== language && (
            <button
              type="button"
              disabled={e.busy !== null}
              onClick={() => void e.translate(source, [language])}
              className={smallButton("text-plum")}
            >
              {fill(t["notices.updateFrom"], { lang: LANGUAGE_NAME[source] })}
            </button>
          )}
          <button type="button" onClick={() => e.keep(language)} className={smallButton()}>
            {t["notices.keep"]}
          </button>
        </StaleLine>
      )}
      <DraftMark
        t={t}
        viewer={p.viewer}
        kind={shDraftKind(d, language)}
        partly={d.partly[language] === true}
        onAccept={() => e.accept(language)}
        onUndo={() => e.undo(language)}
      />
      <div lang={language}>
        {PARTS.map((part) => (
          <label key={part} className="mt-4 block">
            <span className="font-semibold">{t[`board.start.${part}`]}</span>
            <span className="block text-body-sm text-ink/75">{t[`starthere.${part}.help`]}</span>
            <textarea
              value={d.values[language][part]}
              maxLength={p.max[part]}
              rows={ROWS[part]}
              onChange={(ev) => e.set(part, ev.target.value)}
              className={`${FIELD} mt-1 text-base ${
                drafted.includes(part) ? "bg-plum/10 ring-2 ring-plum" : ""
              }`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Translate and Improve writing under the text, as in the notices editor, and the line under them. */
function Actions({ p, e }: { p: StartHereProps; e: Editor }) {
  const { t, languages } = p;
  const { draft: d, active: language } = e;
  const plan = shTranslatePlan(d, language, languages, e.wroteIn);
  const shown = plan ?? { from: language, to: languages.filter((l) => l !== language) };
  const codes = new Intl.ListFormat(p.viewer, { type: "conjunction" }).format(
    shown.to.map((l) => LANGUAGE_CODE[l]),
  );
  const longest = Math.max(
    ...PARTS.flatMap((part) => [
      d.values[language][part].length,
      d.values[shown.from][part].length,
    ]),
  );
  const reason: WorkspaceKey | null = !p.ai
    ? "notices.ai.off"
    : longest > DRAFT_LIMIT
      ? "notices.ai.tooLong"
      : null;
  const off = reason !== null || e.busy !== null;
  const described = reason ? { "aria-describedby": AI_REASON_ID } : {};
  const replaces = plan?.from === language && plan.to.some((l) => written(d.values[l]));
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <ActionButton
          t={t}
          working={e.busy === "translate"}
          name={t["notices.translate"]}
          detail={
            shown.from === language
              ? fill(t["notices.translate.to"], { list: codes })
              : fill(t["notices.translate.from"], { lang: LANGUAGE_CODE[shown.from] })
          }
          disabled={off || plan === null}
          {...described}
          onClick={() => plan && void e.translate(plan.from, plan.to)}
        />
        <ImproveButton
          t={t}
          working={e.busy === "improve"}
          disabled={off || !written(d.values[language])}
          described={described}
          onImprove={(tone) => void e.improve(language, tone)}
        />
      </div>
      <ActionNote t={t} reason={reason} message={e.aiMessage} replaces={replaces} />
    </>
  );
}

export function StartHereEditor(p: StartHereProps) {
  const { t } = p;
  const e = useStartHere(p);
  const dirty = shDirty(e.draft);
  const { saveState } = e;
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void e.save();
      }}
      data-notice-editor=""
      data-unsaved={dirty ? "" : undefined}
      className="max-w-2xl"
    >
      <LanguageTabs
        id="sh"
        t={t}
        languages={p.languages}
        active={e.active}
        stateOf={(l) => shTabState(e.draft, l)}
        onPick={e.setActive}
      />
      <Missing d={e.draft} p={p} />
      <Panel p={p} e={e} />
      <Actions p={p} e={e} />
      <SaveBar
        t={t}
        viewer={p.viewer}
        drafts={Object.keys(e.draft.undo).length}
        saving={e.busy === "save"}
        busy={e.busy !== null}
        note={
          typeof saveState === "object" ? (
            <RefusalLine text={saveState.error} className="mb-2 text-body-sm font-semibold" />
          ) : (
            saveState === "saved" &&
            !dirty && (
              <Notice tone="ok" className="mb-2">
                {t["starthere.saved"]}
              </Notice>
            )
          )
        }
        ask={dirty}
        onLeave={() => window.location.assign(`/w/${p.slug}/board`)}
      />
    </form>
  );
}
