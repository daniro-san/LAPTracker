"use client";

// The officers' first-use steps (issue 312), shown as plain cards in a sheet: they open by themselves until
// they are skipped or finished once on this browser (a cookie, no table), and again from the "?" in the
// header on every workspace screen. The steps are data (lib/private/first-use.ts); the format is pending
// a persona review, so this shell stays plain.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { WORKSPACE_INTRO_COOKIE } from "@/lib/private/cookies";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { FIRST_USE_STEPS, SOURCES, type FirstUseStep } from "@/lib/private/first-use";

import { SourceBadge } from "./SourceBadge";

function Visual({ step, t, howTo }: { step: FirstUseStep; t: WorkspaceDictionary; howTo: string }) {
  if (step.visual === "sources")
    return (
      <ul className="mt-3 flex flex-wrap gap-2">
        {SOURCES.map(({ source, key }) => (
          <li key={key}>
            <SourceBadge source={source} label={t[key]} />
          </li>
        ))}
      </ul>
    );
  if (step.visual === "how-to")
    return (
      <a
        href={howTo}
        className="mt-2 inline-flex min-h-11 items-center py-2 font-semibold underline underline-offset-4"
      >
        {t["signin.howto"]}
      </a>
    );
  return null;
}

export function FirstUse({
  t,
  seen,
  howTo,
}: {
  t: WorkspaceDictionary;
  /** The cookie says they were skipped or finished on this browser. */
  seen: boolean;
  /** The how-to page's address. */
  howTo: string;
}) {
  const [open, setOpen] = useState(!seen);
  const [index, setIndex] = useState(0);
  const step = FIRST_USE_STEPS[index] as FirstUseStep;
  const last = index === FIRST_USE_STEPS.length - 1;
  const close = () => {
    document.cookie = `${WORKSPACE_INTRO_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    setIndex(0);
  };
  const counter = t["intro.step"]
    .replace("{n}", String(index + 1))
    .replace("{total}", String(FIRST_USE_STEPS.length));
  return (
    <>
      <button
        type="button"
        aria-label={t["shell.help"]}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="min-h-11 min-w-11 rounded-xs border border-wax-paper/50 text-lg font-semibold"
      >
        ?
      </button>
      {open && (
        <Sheet labelledBy="first-use-title" onCancel={close}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-sm text-ink/70">{counter}</p>
            {!last && (
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-2 py-2 font-semibold underline underline-offset-4"
              >
                {t["intro.skip"]}
              </button>
            )}
          </div>
          <h2 id="first-use-title" className="mt-1 font-display text-display-md">
            {t[step.title]}
          </h2>
          {step.body.map((k) => (
            <p key={k} className="mt-3">
              {t[k]}
            </p>
          ))}
          <Visual step={step} t={t} howTo={howTo} />
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
              onClick={last ? close : () => setIndex(index + 1)}
              className={buttonClass("primary", "flex-1")}
            >
              {last ? t["intro.done"] : t["intro.next"]}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
