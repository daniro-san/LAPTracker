// Shared body of the 404 and error pages (DESIGN.md `error-page`): the message is the page, set large
// in the display serif; the illustration is a small detail beside it. Header and footer stay, so the
// viewer is never stranded. No hooks, so the client error boundaries can render it too.
import type { ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { Dictionary } from "@/lib/copy";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function ErrorPage({
  code,
  title,
  body,
  art,
  actions,
  copy,
}: {
  code: string;
  title: string;
  body: string;
  art: ReactNode;
  actions: ReactNode;
  /** The request's words, or English in global-error, which has no provider. */
  copy: Dictionary;
}) {
  return (
    <>
      <SiteHeader events={[]} currentId={null} homeId={null} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 pt-12 sm:px-6 sm:pt-20">
        <div className="flex flex-col gap-6 sm:flex-row-reverse sm:items-start sm:gap-10">
          <div className="w-32 shrink-0 text-plum sm:w-40 sm:pt-4">{art}</div>
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold tracking-[0.04em] text-seal tabular-nums">
              {code}
            </p>
            <h1 className="mt-2 font-display text-display-xl font-semibold">{title}</h1>
            <p className="mt-4 max-w-[40ch] text-body">{body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">{actions}</div>
          </div>
        </div>
      </main>
      <SiteFooter ornament="granny" copy={copy} />
    </>
  );
}

export const primaryAction = buttonClass("primary");
export const secondaryAction = "text-link inline-flex min-h-11 items-center text-body";
