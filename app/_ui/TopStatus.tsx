// The event page's status strip: the last-update chip (not while live), the capture window and the jump
// links under it (to "During the event" once finished, and to Movers).
import type { Dictionary } from "@/lib/copy";
import type { getEventDetail } from "@/lib/queries";

import type { Clock } from "./format";
import { LIVE_DURING_ID } from "./LiveProgress";
import { MOVERS_ID } from "./mover-lists";
import { CaptureWindow, StatusChips } from "./Status";

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

/** The status strip, the capture window and the jump links (UX review B1, S1, S3, S6). */
export function TopStatus({
  detail,
  worst,
  hasMovers,
  live,
  hasDuring,
  clock,
  copy,
}: {
  detail: Detail;
  worst: string[];
  hasMovers: boolean;
  /** The event is running: no "Last updated" chip, and the End shows when it is due. */
  live: boolean;
  /** The finished event's "During the event" section exists: a jump link to it. */
  hasDuring: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  const jump = "text-link inline-flex min-h-11 items-center px-2 text-sm font-medium";
  return (
    <>
      <StatusChips
        phases={detail.snapshots}
        stale={worst.filter((w) => w === "stale").length}
        failed={worst.filter((w) => w === "failed").length}
        live={live}
        clock={clock}
        copy={copy}
      />
      <div className="-mb-2 flex flex-wrap items-center justify-between gap-x-3">
        <CaptureWindow
          before={detail.snapshots.find((s) => s.phase === "before")}
          after={detail.snapshots.find((s) => s.phase === "after")}
          endDue={live ? detail.afterAt : null}
          clock={clock}
          copy={copy}
        />
        {(hasMovers || hasDuring) && (
          <div className="ml-auto flex flex-wrap justify-end">
            {hasDuring && (
              <a href={`#${LIVE_DURING_ID}`} className={jump}>
                {copy.ledger.liveDuring} <span aria-hidden="true">&nbsp;↓</span>
              </a>
            )}
            {hasMovers && (
              <a href={`#${MOVERS_ID}`} className={jump}>
                {copy.ledger.movers} <span aria-hidden="true">&nbsp;↓</span>
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
