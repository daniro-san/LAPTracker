"use client";

// Translate and Improve writing (issues 305, 363), side by side under the text of the tab in view, and
// "Shorten to 1,000" while that text is over the board's limit (D113): then it is the main action, first and
// across the row on a phone, first of three from 640 px.
// Each is a two-line button that keeps its size while it works: Translate says where it goes ("to PT and
// FR", or "from EN" for an empty tab); Improve writing shows the tone and opens a small sheet of the six
// tones, where one tap asks for the draft; Fit says it keeps the key points. Under them: why they are off,
// the last error, or that the other languages' text becomes a draft (D81). The buttons, the tones and the
// line under them are shared with Start here (LanguageEditorParts.tsx, D116).
import { fill } from "@/lib/copy";
import type { WorkspaceKey } from "@/lib/private/dictionary";
import { DRAFT_LIMIT, NOTICE_LIMIT } from "@/lib/private/notice-rules";

import { ActionButton, ActionNote, AI_REASON_ID, ImproveButton } from "./LanguageEditorParts";
import { LANGUAGE_CODE } from "./languages";
import { canFit, translatePlan } from "./notice-draft";
import type { Editor, EditorProps } from "./notice-editor-state";

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

export function NoticeActions({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const language = e.active;
  const { plan, reason, where, replaces } = actionsOf(p, e);
  const off = reason !== null || e.busy !== null;
  const described = reason ? { "aria-describedby": AI_REASON_ID } : {};
  const over = canFit(e.draft, language);
  return (
    <>
      <div
        className={`mt-3 grid grid-cols-2 gap-2 ${over ? "sm:max-w-xl sm:grid-cols-3" : "sm:max-w-md"}`}
      >
        <ActionButton
          t={t}
          working={e.busy === "translate"}
          name={t["notices.translate"]}
          detail={where}
          disabled={off || plan === null}
          {...described}
          onClick={() => plan && void e.translate(plan.from, plan.to)}
        />
        <ImproveButton
          t={t}
          working={e.busy === "improve"}
          disabled={off || e.draft.values[language].trim() === ""}
          described={described}
          onImprove={(tone) => void e.improve(language, tone)}
        />
        {over && (
          <ActionButton
            t={t}
            working={e.busy === "fit"}
            name={fill(t["notices.fit"], {
              limit: new Intl.NumberFormat(p.viewer).format(NOTICE_LIMIT),
            })}
            detail={t["notices.fit.detail"]}
            disabled={off}
            {...described}
            onClick={() => void e.fit(language)}
            primary
            // The main action while the text is over: first, across the row on a phone.
            className="order-first col-span-2 sm:col-span-1"
          />
        )}
      </div>
      <ActionNote t={t} reason={reason} message={e.aiMessage} replaces={replaces} />
    </>
  );
}
