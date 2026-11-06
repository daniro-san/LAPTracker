// Breadcrumbs on the alliance and player pages only (DESIGN.md "Navigation and hierarchy"):
// `Ledger › [OGs] OldGrandmas › Player`. The last crumb is the page itself and is not a link.
import Link from "next/link";
import type { ReactNode } from "react";

import { requestCopy } from "./locale";

export interface Crumb {
  key: string;
  href?: string;
  label: ReactNode;
}

export async function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const copy = await requestCopy();
  return (
    <nav aria-label={copy.site.breadcrumb} className="mb-1 text-base">
      <ol className="flex flex-wrap items-center gap-x-1">
        {crumbs.map((c, i) => (
          <li key={c.key} className="inline-flex min-w-0 items-center gap-1">
            {i > 0 && (
              <span aria-hidden="true" className="text-ink/50">
                ›
              </span>
            )}
            {c.href ? (
              <Link
                href={c.href}
                className="inline-flex min-h-11 min-w-11 items-center gap-1.5 break-words font-medium text-plum underline-offset-2 hover:underline"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 items-center break-words">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
