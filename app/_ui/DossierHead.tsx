// The head of a dossier page (issue 822), shared by the alliance page and the player page (issue 824): the
// picture and the title with the page's controls, then the facts as one band of label and value. A fact with
// no value is left out, never written as "N/A".
import type { ReactNode } from "react";

import { LABEL } from "./StatTable";

export interface DossierFact {
  key: string;
  label: string;
  /** Null: unknown, the fact is left out. */
  value: ReactNode | null;
  /** A small line under the value, such as where it comes from. */
  note?: string | null;
}

export function DossierHead({
  picture,
  title,
  actions,
  facts,
}: {
  picture: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  facts: DossierFact[];
}) {
  const known = facts.filter((f) => f.value !== null);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {picture}
          <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {known.length > 0 && (
        <dl className="drawn-card mt-3 grid grid-cols-2 gap-x-3 gap-y-2 p-3 sm:grid-cols-3">
          {known.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className={LABEL}>{f.label}</dt>
              <dd className="break-words text-lg font-medium tabular-nums">{f.value}</dd>
              {f.note && <dd className="text-xs text-ink/70">{f.note}</dd>}
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
