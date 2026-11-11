// Breadcrumbs on the alliance and player pages only (DESIGN.md "Navigation and hierarchy"):
// `Ledger › [OGs] OldGrandmas › Player`. The last crumb is the page itself and is not a link.
import type { ReactNode } from "react";

import { TextLink } from "@/lib/brand/components/TextLink";

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
      {/* Inline text, so a long alliance name breaks inside the name (issue 125). Lines are 44 px and
          each link is padded to fill its line, as min-height does not apply to inline boxes. The side
          padding with an equal negative margin keeps a short crumb ("Sổ", "台帳") 44 px wide. */}
      <ol className="leading-11">
        {crumbs.map((c, i) => (
          <li key={c.key} className="inline">
            {i > 0 && (
              <span aria-hidden="true" className="mx-1 text-ink/50">
                ›
              </span>
            )}
            {c.href ? (
              <TextLink
                href={c.href}
                className="-mx-3.5 px-3.5 py-3 font-medium *:mr-1.5 *:align-middle"
              >
                {c.label}
              </TextLink>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
