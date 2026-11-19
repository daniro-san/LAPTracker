// The page head (DESIGN.md "Layout components", D122): optional breadcrumbs, the title and one meta line on
// the left, the page's actions on the right from 768 (on their own row under the title when they do not fit).
// Below 768 the main action stays in view and the others go into the More menu, so the first row of a phone
// screen is the content.
import type { ReactNode } from "react";

import { splitActions, type PageAction } from "./layout-rules";
import { MoreMenu } from "./MoreMenu";

export interface HeadAction extends PageAction {
  node: ReactNode;
}

export function PageHead({
  title,
  meta,
  crumbs,
  actions = [],
  moreLabel,
}: {
  title: ReactNode;
  meta?: ReactNode;
  crumbs?: ReactNode;
  actions?: readonly HeadAction[];
  /** The More menu's word ("More"); needed when there are two actions or more. */
  moreLabel?: string;
}) {
  const { shown, more } = splitActions(actions);
  return (
    <div className="mb-4">
      {crumbs}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-[1_1_16rem]">
          <h1 className="font-display text-display-lg">{title}</h1>
          {meta && <div className="mt-1 text-body-sm text-ink/70">{meta}</div>}
        </div>
        {actions.length > 0 && (
          <>
            <div className="hidden flex-wrap gap-2 md:flex">
              {actions.map((a) => (
                <span key={a.key} className="contents">
                  {a.node}
                </span>
              ))}
            </div>
            <div className="relative flex w-full flex-wrap items-center gap-2 md:hidden">
              {shown?.node}
              {more.length > 0 && moreLabel && (
                <MoreMenu label={moreLabel}>
                  {more.map((a) => (
                    <span key={a.key} className="contents">
                      {a.node}
                    </span>
                  ))}
                </MoreMenu>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
