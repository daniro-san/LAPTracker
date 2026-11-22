"use client";

// The officers' first-use cards (issue 312, the persona panel's format): three static cards that open by
// themselves until they are skipped or finished once on this browser (a cookie, no table). "?" in the
// header shows the same cards again in a sheet that does not block the page, with Replay to walk them.
import { Fragment, useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics/events";
import { buttonClass } from "@/lib/brand/components/Button";
import { HelpMark } from "@/lib/brand/components/HelpMark";
import { Sheet } from "@/lib/brand/components/Sheet";
import { WORKSPACE_INTRO_COOKIE } from "@/lib/private/cookies";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { FIRST_USE_STEPS, SOURCES, type FirstUseStep } from "@/lib/private/first-use";
import { fill } from "@/lib/words";

import { SourceBadge } from "./SourceBadge";

function Visual({ step, t }: { step: FirstUseStep; t: WorkspaceDictionary }) {
  if (step.visual === "only")
    return (
      <p className="mt-2">
        <span className="inline-flex items-center rounded-xs border border-current px-2 text-[12px] leading-5 font-semibold text-plum">
          {t["intro.only"]}
        </span>
      </p>
    );
  if (step.visual === "sources")
    return (
      <ul className="mt-2 flex flex-wrap gap-2">
        {SOURCES.map(({ source, key }) => (
          <li key={key}>
            <SourceBadge source={source} label={t[key]} />
          </li>
        ))}
      </ul>
    );
  return null;
}

/** A card's paragraphs, with its visual under the first one. */
function CardBody({ step, t }: { step: FirstUseStep; t: WorkspaceDictionary }) {
  return step.body.map((k, i) => (
    <Fragment key={k}>
      <p className="mt-3">{t[k]}</p>
      {i === 0 && <Visual step={step} t={t} />}
    </Fragment>
  ));
}

/** The first visit: one card at a time, in the blocking sheet. Skip, Start and Escape all close it. */
function Cards({
  t,
  onClose,
}: {
  t: WorkspaceDictionary;
  /** "done" from the last card's button; "skipped" from Skip or Escape. */
  onClose: (how: "done" | "skipped") => void;
}) {
  const [index, setIndex] = useState(0);
  const step = FIRST_USE_STEPS[index] as FirstUseStep;
  const last = index === FIRST_USE_STEPS.length - 1;
  const counter = fill(t["intro.step"], { n: index + 1, total: FIRST_USE_STEPS.length });
  return (
    <Sheet labelledBy="first-use-title" onCancel={() => onClose("skipped")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-ink/70">{counter}</p>
        {!last && (
          <button
            type="button"
            onClick={() => onClose("skipped")}
            className="min-h-11 px-2 py-2 font-semibold underline underline-offset-4"
          >
            {t["intro.skip"]}
          </button>
        )}
      </div>
      <h2 id="first-use-title" className="mt-1 font-display text-display-md">
        {t[step.title]}
      </h2>
      <CardBody step={step} t={t} />
      <div className="mt-6 flex items-center gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            className={buttonClass("secondary", "flex-1")}
          >
            {t["intro.back"]}
          </button>
        )}
        <button
          type="button"
          data-initial-focus
          onClick={last ? () => onClose("done") : () => setIndex(index + 1)}
          className={buttonClass("primary", "flex-1")}
        >
          {last ? t["intro.done"] : t["intro.next"]}
        </button>
      </div>
    </Sheet>
  );
}

/** "?": the same three cards in one sheet at the bottom; the page stays usable behind it. */
function Help({
  t,
  onReplay,
  onClose,
}: {
  t: WorkspaceDictionary;
  onReplay: () => void;
  onClose: () => void;
}) {
  // Focus the sheet itself, so it opens at its title, not scrolled down to a button.
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => sheet.current?.focus(), []);
  return (
    <section
      ref={sheet}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="help-title"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-x-0 bottom-0 z-40 max-h-[55dvh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-rule bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md sm:border"
    >
      <h2 id="help-title" className="font-display text-display-md">
        {t["shell.help"]}
      </h2>
      {FIRST_USE_STEPS.map((step) => (
        <div key={step.title} className="mt-4 border-t border-rule pt-3">
          <h3 className="font-subhead text-display-sm">{t[step.title]}</h3>
          <CardBody step={step} t={t} />
        </div>
      ))}
      <div className="mt-6 flex items-center gap-3">
        <button type="button" onClick={onReplay} className={buttonClass("secondary", "flex-1")}>
          {t["intro.replay"]}
        </button>
        <button type="button" onClick={onClose} className={buttonClass("primary", "flex-1")}>
          {t["intro.close"]}
        </button>
      </div>
    </section>
  );
}

export function FirstUse({
  t,
  seen,
}: {
  t: WorkspaceDictionary;
  /** The cookie says the cards were skipped or finished on this browser. */
  seen: boolean;
}) {
  const [mode, setMode] = useState<"closed" | "cards" | "help">(seen ? "closed" : "cards");
  const [replayed, setReplayed] = useState(false);
  const finish = (how: "done" | "skipped") => {
    // A first use only (D77): walking the cards again from "?" → Replay is not counted.
    if (!replayed) track(how === "done" ? "ws_first_use_done" : "ws_first_use_skipped");
    document.cookie = `${WORKSPACE_INTRO_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    setMode("closed");
  };
  return (
    <>
      <button
        type="button"
        aria-label={t["shell.help"]}
        aria-expanded={mode === "help"}
        onClick={() => setMode(mode === "help" ? "closed" : "help")}
        className="grid min-h-11 min-w-11 place-items-center"
      >
        <HelpMark className="size-[22px]" />
      </button>
      {mode === "cards" && <Cards t={t} onClose={finish} />}
      {mode === "help" && (
        <Help
          t={t}
          onReplay={() => {
            setReplayed(true);
            setMode("cards");
          }}
          onClose={() => setMode("closed")}
        />
      )}
    </>
  );
}
