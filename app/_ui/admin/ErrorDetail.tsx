// Error details on /admin (D61): under an error's one-line text, what it means and what to do
// (lib/error-guide.ts), then a closed <details> with what actually came back: the game API's answer
// (request, status, headers, the body's start) or an app error's message, cause and first stack lines.
// Third-party text is rendered as text, never as HTML (plan §12.3).
import type { ReactNode } from "react";

import type { AppErrorDetail } from "@/lib/app-errors";
import { copy, fill } from "@/lib/copy";
import { guideFor } from "@/lib/error-guide";
import type { UpstreamDetail } from "@/lib/queries/daily-runs";

const g = copy.admin.guide;
const PRE = "max-h-60 overflow-auto whitespace-pre-wrap break-words bg-ink/5 p-2 font-mono text-xs";

/** What the error means and what to do about it. */
export function GuideNote({ error }: { error: string }) {
  const { meaning, action } = guideFor(error);
  return (
    <p className="text-body-sm">
      <span className="font-semibold">{meaning}</span> {action}
    </p>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-ink/70 sm:w-32">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Closed until opened; the summary is a 44 px target. */
function Details({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="tint-button inline-flex min-h-11 cursor-pointer items-center px-2 text-sm font-medium text-plum">
        {label ? `${label} · ${g.details}` : g.details}
      </summary>
      <dl className="mt-1 flex flex-col gap-2 text-body-sm">{children}</dl>
    </details>
  );
}

/** What the game's API answered for one failed call; `label` names it when several are listed. */
export function UpstreamDetails({ detail, label }: { detail: UpstreamDetail; label?: string }) {
  const headers = Object.entries(detail.headers ?? {});
  return (
    <Details {...(label && { label })}>
      <Row label={g.path}>
        <span className="font-mono">{detail.path}</span>
      </Row>
      {detail.status !== undefined && <Row label={g.status}>{detail.status}</Row>}
      {detail.timeoutMs !== undefined && (
        <Row label={g.timeout}>{fill(g.timeoutValue, { s: detail.timeoutMs / 1000 })}</Row>
      )}
      {detail.cause && <Row label={g.cause}>{detail.cause}</Row>}
      {headers.length > 0 && (
        <Row label={g.headers}>
          <pre className={PRE}>{headers.map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
        </Row>
      )}
      {detail.body && (
        <Row label={g.body}>
          <pre className={PRE}>{detail.body}</pre>
        </Row>
      )}
    </Details>
  );
}

/** An app error as thrown: message, cause, and where. */
export function AppErrorDetails({ detail }: { detail: AppErrorDetail }) {
  return (
    <Details>
      <Row label={g.message}>
        {detail.name}: {detail.message}
      </Row>
      {detail.cause && <Row label={g.cause}>{detail.cause}</Row>}
      {detail.stack && (
        <Row label={g.stack}>
          <pre className={PRE}>{detail.stack}</pre>
        </Row>
      )}
    </Details>
  );
}
