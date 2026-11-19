// A readable width (DESIGN.md "Layout system", D122): prose within 65 characters, a form within 560 px,
// however wide the column is.
import type { ReactNode } from "react";

export function Measure({ form = false, children }: { form?: boolean; children: ReactNode }) {
  return <div className={form ? "max-w-(--form-max)" : "max-w-(--measure)"}>{children}</div>;
}
