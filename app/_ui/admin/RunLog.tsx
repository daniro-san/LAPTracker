// A run's run_logs timeline (DESIGN.md `timeline`), on a snapshot run's page and on a daily read's page
// (D60): time, level, code, alliance and the data that matters; a failed call's line adds what the error
// means and what the upstream answered (D61).
import { copy } from "@/lib/copy";
import type { UpstreamDetail } from "@/lib/queries/daily-runs";

import { GuideNote, UpstreamDetails } from "./ErrorDetail";
import { AdminSection } from "./parts";

const LEVEL = {
  info: "text-ink/70",
  warn: "text-plum",
  error: "text-seal",
} as const;

/** The data fields that matter, as `key=value`; objects are skipped (the log carries counts and codes). */
function fields(data: unknown): string {
  if (data === null || typeof data !== "object") return "";
  return Object.entries(data)
    .filter(([, v]) => v !== null && typeof v !== "object")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
}

const time = (d: Date) => d.toISOString().slice(11, 23);

export interface LogLine {
  id: number;
  at: Date;
  level: keyof typeof LEVEL;
  code: string;
  unionId: number | null;
  data: unknown;
}

/** The run's log lines, oldest first; a failed call's line adds what it means and the upstream's answer. */
export function RunLog({
  logs,
  tags,
}: {
  logs: readonly LogLine[];
  tags: ReadonlyMap<number, string | null>;
}) {
  const t = copy.admin.runs;
  return (
    <AdminSection id="run-log" title={t.trace.log}>
      <ol>
        {logs.map((l) => {
          // D61: a failed call's line carries what the upstream answered.
          const { error, detail } = l.data as { error?: string; detail?: UpstreamDetail | null };
          return (
            <li key={l.id} className="border-b border-rule py-2 text-body-sm last:border-0">
              <span className="tabular-nums text-ink/70">{time(l.at)}</span>{" "}
              <span className={`font-semibold uppercase ${LEVEL[l.level]}`}>{l.level}</span>{" "}
              <span className="font-mono">{l.code}</span>
              {l.unionId !== null && <span> · {tags.get(l.unionId) ?? l.unionId}</span>}
              <span className="block break-words font-mono text-xs">{fields(l.data)}</span>
              {error && detail && (
                <>
                  <GuideNote error={error} />
                  <UpstreamDetails detail={detail} />
                </>
              )}
            </li>
          );
        })}
        {logs.length === 0 && <li>{t.noLogs}</li>}
      </ol>
    </AdminSection>
  );
}
