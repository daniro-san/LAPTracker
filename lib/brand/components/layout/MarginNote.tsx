// A margin note (DESIGN.md "Layout components", D122): a block of the spread's margin column. From 1024 no
// frame: a ruled head (label type over a 2 px ink rule, an optional control at its right) and the body in
// hairline rows, 32 px above every head after the first. Below 1024, where there is no margin column, it
// wears the drawn card frame with the desk cards' padding, so a phone still sees cards. The head is 44 px tall
// only when it holds a control, so the 32 px above it is the whole gap (11at persona check).
import type { ReactNode } from "react";

export function MarginNote({
  id,
  title,
  action,
  children,
}: {
  /** The head's id; the note is a section labelled by it. */
  id?: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="margin-note px-4 py-3 lg:p-0 [&+&]:mt-4 lg:[&+&]:mt-8">
      <h2
        id={id}
        className={`mb-1 flex ${action ? "min-h-11" : ""} items-end justify-between gap-2 border-b border-rule pb-1 font-subhead text-display-sm lg:border-b-2 lg:border-ink lg:font-body lg:text-label lg:font-semibold lg:tracking-[0.04em] lg:uppercase`}
      >
        <span className="min-w-0">{title}</span>
        {action}
      </h2>
      <div className="[&>*+*]:border-t [&>*+*]:border-rule">{children}</div>
    </section>
  );
}
