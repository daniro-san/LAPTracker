// The manual round's read-only parts (D28, D55): each phase's state chip, the facts about the round, and
// a complete round as one closed line that opens to them.
import { buttonClass } from "@/lib/brand/components/Button";
import { Chip } from "@/lib/brand/components/Chip";
import { FactList } from "@/lib/brand/components/FactList";
import { copy, fill } from "@/lib/copy";

import type { RoundView } from "./actions";
import { StateChip } from "./parts";
import { phaseWord } from "./words";

const m = copy.admin.manual;

/** A phase's state in words that say what to do next: "Not started: press Before", "Done 14:02". */
function PhaseChip({ manual, phase }: { manual: RoundView; phase: "before" | "after" }) {
  const row = manual.phases.find((x) => x.phase === phase);
  if (!row) {
    return <Chip tone="muted">{fill(m.phaseState.none, { seal: copy.admin.seal[phase] })}</Chip>;
  }
  return <StateChip status={row.status}>{row.text}</StateChip>;
}

/** The round's two phases with their state, then who can see it, the Discord post and the calls used. */
export function RoundFacts({ manual }: { manual: RoundView }) {
  const s = m.summary;
  return (
    <>
      {(["before", "after"] as const).map((p) => (
        <div
          key={p}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2"
        >
          <span className="font-medium">{phaseWord(p)}</span>
          <PhaseChip manual={manual} phase={p} />
        </div>
      ))}
      <div className="mb-4">
        <FactList
          items={[
            { label: s.visibility, value: m.visibility[manual.visibility] },
            { label: s.discord, value: manual.postPublic ? s.on : s.off },
            { label: s.calls, value: String(manual.calls) },
          ]}
        />
      </div>
    </>
  );
}

/** A complete round, closed (D55): one line with its name and "Round complete" that opens to the same
 * phases and facts and the link to its page. Nothing in it records or edits. */
export function ClosedRound({ manual }: { manual: RoundView }) {
  return (
    <details className="group/round mb-4 border border-rule">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 break-words font-subhead text-display-sm">{manual.name}</span>
        <StateChip status="complete">{m.complete}</StateChip>
        <span
          aria-hidden="true"
          className="ml-auto transition-transform duration-150 group-open/round:rotate-180 motion-reduce:transition-none"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-rule px-4 pb-4">
        <RoundFacts manual={manual} />
        <a href={`/events/${manual.id}`} className={buttonClass("secondary", "font-semibold")}>
          {m.open}
        </a>
      </div>
    </details>
  );
}
