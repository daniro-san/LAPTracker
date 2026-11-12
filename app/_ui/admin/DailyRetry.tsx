// Today's failed daily roster read on /admin and its Retry with the cost (D60 amendment). Shown only
// while today's read is `failed`; the press goes through AdminActions' confirm and PIN flow.
import { buttonClass } from "@/lib/brand/components/Button";
import { copy } from "@/lib/copy";

import { DAILY_RETRY, type Action, type DailyFailedView } from "./actions";
import { CostTag } from "./parts";

const t = copy.admin.run;

export function DailyRetry({
  daily,
  busy,
  off,
  onStart,
}: {
  daily: DailyFailedView;
  /** The action this tab is sending, if any. */
  busy: string | null;
  /** Why every button is off: this tab is sending something, or a run is in progress. */
  off: string | null;
  onStart: (action: Action) => Promise<void>;
}) {
  return (
    <div role="group" aria-labelledby="daily-read" className="mt-6">
      <span
        id="daily-read"
        className="text-label font-semibold uppercase tracking-[0.04em] text-ink/70"
      >
        {t.daily.title}
      </span>
      <p className="break-words">{daily.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          disabled={off !== null}
          onClick={() => void onStart(DAILY_RETRY)}
          className={buttonClass("secondary", "font-semibold disabled:cursor-wait")}
        >
          {busy === DAILY_RETRY.id ? t.running : DAILY_RETRY.label}
        </button>
        <CostTag>{DAILY_RETRY.cost}</CostTag>
      </div>
    </div>
  );
}
