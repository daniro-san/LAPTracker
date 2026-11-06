// The admin area's building blocks (#91, DESIGN.md `admin-section`, `status-fact`, `cost-tag`,
// `live-indicator`): a framed section (flat 1 px rule, no shadow, no rounded corner) with its title row,
// a labelled fact, a run state as a chip, the cost beside an action, and the header's live candle.
import type { ReactNode } from "react";

import { LABEL } from "@/app/_ui/StatTable";
import { Chip, type ChipTone } from "@/lib/brand/components/Chip";
import { LiveCandle } from "@/lib/brand/components/LiveCandle";
import { DroppedStitch, Hourglass, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy } from "@/lib/copy";

/** A page section in a 1 px frame: title (and an optional state or note on the right), help, body. */
export function AdminSection({
  id,
  title,
  aside,
  help,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-6 border border-rule">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-3 sm:px-6">
        <h2 id={id} className="font-subhead text-display-md">
          {title}
        </h2>
        {aside && <div className="ml-auto">{aside}</div>}
        {help && <p className="basis-full text-body-sm text-ink/70">{help}</p>}
      </div>
      <div className="px-4 py-4 sm:px-6">{children}</div>
    </section>
  );
}

/** One status fact: small-caps label, the value at body size with its state chip, an optional note. */
export function Fact({
  label,
  value,
  chip,
  note,
}: {
  label: string;
  value: ReactNode;
  chip?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-rule py-3 first:pt-0 last:border-0 last:pb-0 sm:border-0 sm:p-0">
      <span className={LABEL}>{label}</span>
      <span className="flex flex-wrap items-center gap-2 break-words text-base font-medium tabular-nums">
        {value}
        {chip}
      </span>
      {note && <span className="text-body-sm text-ink/70">{note}</span>}
    </div>
  );
}

/** What an action costs (`≈ 21 calls`, `Free`), in the soft frame beside or under it. */
export function CostTag({ children }: { children: ReactNode }) {
  return <span className={`${LABEL} drawn-frame-soft inline-block px-2 py-0.5`}>{children}</span>;
}

/** The header's live candle and its word: lit and moving while a run is in progress, dimmed when idle. */
export function LiveIndicator({ on }: { on: boolean }) {
  return (
    <span
      role="status"
      className={`ml-auto flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold ${
        on ? "live-on text-plum" : "live-off text-ink/70"
      }`}
    >
      <LiveCandle className={`size-5 shrink-0 ${on ? "" : "opacity-60"}`} />
      {on ? copy.admin.live.on : copy.admin.live.off}
    </span>
  );
}

const STATE: Record<string, { tone: ChipTone; icon: ReactNode }> = {
  complete: { tone: "ink", icon: <StitchedCheck /> },
  running: { tone: "plum", icon: <Hourglass /> },
  partial: { tone: "seal", icon: <DroppedStitch /> },
  failed: { tone: "seal", icon: <DroppedStitch /> },
};

/** A run state as a chip (`status-strip` tones): ink once done, plum while running, seal when partly
 * done or failed; the words come from the caller. */
export function StateChip({ status, children }: { status: string; children: ReactNode }) {
  const look = STATE[status] ?? { tone: "muted" as const, icon: null };
  return (
    <Chip tone={look.tone} icon={look.icon}>
      {children}
    </Chip>
  );
}
