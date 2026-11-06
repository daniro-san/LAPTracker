// /admin's "Last rehearsal" section (#91): the verdict as a chip beside the title, the two phases with
// their due times, and each check with its mark and its word.
import type { Clock } from "@/app/_ui/format";
import { Chip } from "@/lib/brand/components/Chip";
import { DroppedStitch, StitchedCheck } from "@/lib/brand/components/StatusIcons";
import { copy, fill } from "@/lib/copy";
import type { RehearsalStatus } from "@/lib/queries/admin";

import { AdminSection } from "./parts";
import { phaseWord, stateWord } from "./words";

const t = copy.admin;

export function Rehearsal({ r, clock }: { r: RehearsalStatus | null; clock: Clock }) {
  const aside =
    r?.verdict &&
    (r.verdict.pass ? (
      <Chip tone="ink" icon={<StitchedCheck />}>
        {t.rehearsal.verdict.pass}
      </Chip>
    ) : (
      <Chip tone="seal" icon={<DroppedStitch />}>
        {t.rehearsal.verdict.fail}
      </Chip>
    ));
  return (
    <AdminSection id="rehearsal" title={t.rehearsal.title} help={t.rehearsal.help} aside={aside}>
      {!r ? (
        <p>{t.rehearsal.none}</p>
      ) : (
        <>
          <p className="break-words font-medium">
            {t.runs.rehearsal} {clock.stamp(r.eventAtUtc)}
          </p>
          <ul className="mb-3 text-body-sm">
            {(["before", "after"] as const).map((phase) => {
              const p = r.phases.find((x) => x.phase === phase);
              return (
                <li key={phase}>
                  {fill(t.rehearsal.phase, {
                    phase: phaseWord(phase),
                    state: p
                      ? `${stateWord(p.status)}${p.error ? ` (${p.error})` : ""}`
                      : t.rehearsal.notRun,
                    at: clock.stamp(phase === "before" ? r.beforeAt : r.afterAt),
                  })}
                </li>
              );
            })}
          </ul>
          {r.verdict && (
            <ul className="text-body-sm" aria-label={t.rehearsal.checks}>
              {r.verdict.lines.map((l, i) => (
                <li
                  key={i}
                  className={`flex gap-2 border-b border-rule py-1.5 ${l.ok ? "" : "text-seal"}`}
                >
                  <span aria-hidden="true" className="mt-0.5 inline-flex">
                    {l.ok ? <StitchedCheck /> : <DroppedStitch />}
                  </span>
                  {l.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminSection>
  );
}
