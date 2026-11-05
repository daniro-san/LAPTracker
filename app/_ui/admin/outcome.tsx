// What /admin says about a press and about a run in progress: the words for the API's answer, the notice
// while something runs, and the notice with the last outcome.
import { Notice, type NoticeTone } from "@/lib/brand/components/Notice";
import { copy, fill } from "@/lib/copy";

import type { RunningView } from "./actions";
import { phaseWord, stateWord } from "./words";

const t = copy.admin.run;
const m = copy.admin.manual;

/** The answer of a rename or settings call (it carries an event id and no snapshot id). */
function manualOutcome(body: Record<string, unknown>): string | null {
  if (body.event_id === undefined || body.snapshot_id !== undefined) return null;
  return body.name === undefined ? m.saved : m.renamed;
}

export const RESULT_MARK: Record<string, string> = { complete: "✓", partial: "!" };

export function describe(
  status: number,
  body: Record<string, unknown>,
  beforeAtText: string,
): string {
  const code = typeof body.code === "string" ? body.code : null;
  if (code === "snapshot_not_due") return fill(t.notDue, { at: beforeAtText });
  if (code)
    return `${status === 409 || status === 429 ? "" : "✗ "}${t.refusals[code] ?? fill(t.refused, { code })}`;
  if (status === 201) return body.event_id === undefined ? t.created : m.created;
  const manual = manualOutcome(body);
  if (manual) return manual;
  return snapshotResult(body);
}

/** The finished snapshot's outcome in words. */
function snapshotResult(body: Record<string, unknown>): string {
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return fill(t.result, {
    mark: RESULT_MARK[String(body.status)] ?? "✗",
    phase: body.phase === "before" || body.phase === "after" ? phaseWord(body.phase) : "",
    status: stateWord(String(body.status)),
    calls: String(body.calls_used),
    stale: count(body.stale),
    failed: count(body.failed),
    id: String(body.snapshot_id),
  });
}

/** What is running, when it started and why the buttons are off. */
export function RunningNotice({ running }: { running: RunningView[] }) {
  return (
    <Notice tone="busy" className="mt-3">
      <p className="font-semibold">{t.live.title}</p>
      <ul>
        {running.map((r) => (
          <li key={`${r.phase}|${r.event}`}>
            {fill(t.live.line, { phase: r.phase, event: r.event, at: r.startedText })}
          </li>
        ))}
      </ul>
      <p className="text-sm">{t.live.note}</p>
    </Notice>
  );
}

/** The outcome of the last press: its mark picks the tone, the words carry the rest. */
export function Result({ message }: { message: string }) {
  const mark = message.charAt(0);
  const tone: NoticeTone = mark === "✓" ? "ok" : mark === "✗" || mark === "!" ? "fail" : "info";
  return (
    <div ref={(el) => el?.scrollIntoView({ block: "nearest" })} className="mt-3">
      <Notice tone={tone}>{tone === "info" ? message : message.slice(1).trim()}</Notice>
    </div>
  );
}
