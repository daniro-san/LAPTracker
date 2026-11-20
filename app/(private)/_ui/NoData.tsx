// A missing value (owner, issue 412 UX pass; D75): a small muted dotted circle where "—" stood, about as
// wide as a short number, so columns keep their shape. It explains itself without hover: screen readers
// hear "No data", the title says it on a desktop, and Members' "What the labels mean" shows it with its
// meaning. The server still writes "—" (NONE) into its strings; the page draws it here.
import { Fragment, type ReactNode } from "react";

import { NONE } from "@/lib/private/fact-text";

export function NoData({ label }: { label: string }) {
  return (
    <span
      title={label}
      className="inline-flex min-w-[2ch] items-center justify-center align-[-0.125em] text-ink/60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="2 2.2"
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="6" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A standalone "—" in a value: the whole value, or a part of one ("— · T11", "Might —"). */
const MISSING = new RegExp(`(?<=^|\\s)${NONE}(?=\\s|$)`);

/** `text` with each missing value drawn as NoData; the text itself when nothing is missing. */
export function withNoData(text: string, label: string): ReactNode {
  const parts = text.split(MISSING);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <NoData label={label} />}
      {part}
    </Fragment>
  ));
}
