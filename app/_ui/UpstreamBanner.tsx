// A slim notice above the page while the upstream does not answer (DECISIONS D27). Renders nothing when
// all is well and when the status cannot be read; it has no controls, so there is nothing to dismiss.
import { DroppedStitch } from "@/lib/brand/components/StatusIcons";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { getUpstreamStatus } from "@/lib/queries";

import { requestClock, requestCopy } from "./locale";

export async function UpstreamBanner() {
  const status = await withPageDb((db) => getUpstreamStatus(db, new Date())).catch(() => null);
  if (!status?.down) return null;
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  return (
    <div role="status" className="border-b border-seal/40 bg-seal/10 text-ink">
      <div className="mx-auto flex max-w-[960px] items-start gap-2 px-4 py-2 text-body-sm sm:px-6">
        <span className="mt-0.5 text-seal">
          <DroppedStitch />
        </span>
        <p className="min-w-0">
          <strong className="font-semibold">{copy.upstream.title}.</strong> {copy.upstream.body}
          {status.lastFreshAt && (
            <>
              {" "}
              <span className="whitespace-nowrap">
                {fill(copy.upstream.lastFresh, { time: clock.at(status.lastFreshAt) })}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
