// The page frame (DESIGN.md "Layout components", D122): the bar across the top, the navigation for the
// width and <main> with the page margins. Below 768 the caller's bottom tabs (`tabs`); from 768 to 1279 the
// rail; from 1280 the sidebar. The bar's content lines up with the page content: it starts after the rail
// or sidebar and is as wide as the content. `legacyWidth` keeps a page at the old 960 px until it is laid
// out for the wider widths (rollout, docs/handoff/11ap-layout-system.md).
import type { ReactNode } from "react";

const SAFE = "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";
/** The old frame: 960 px, 16 then 24 px margins from 640. */
const LEGACY = {
  width: "max-w-(--legacy-max)",
  margins: `${SAFE} sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]`,
};
/** D122: 1200 px, margins 16 / 24 from 768 / 32 from 1440. */
const FULL = {
  width: "max-w-(--page-max)",
  margins: `${SAFE} md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] wide:px-8`,
};

export function AppShell({
  barClass,
  bar,
  tabs,
  rail,
  sidebar,
  legacyWidth = false,
  lang,
  children,
}: {
  /** The bar's colours (the desk's burgundy, the site's plum). */
  barClass: string;
  /** What sits in the bar, laid out by the caller. */
  bar: ReactNode;
  /** Bottom tabs below 768 (fixed; the page gets room for them). */
  tabs?: ReactNode;
  rail?: ReactNode;
  sidebar?: ReactNode;
  legacyWidth?: boolean;
  lang?: string;
  children: ReactNode;
}) {
  const side = rail !== undefined || sidebar !== undefined;
  const { width, margins } = legacyWidth ? LEGACY : FULL;
  // The column beside the navigation: the rail's width from 768, the sidebar's from 1280.
  const offset = side ? "md:pl-(--rail) xl:pl-(--sidebar)" : "";
  return (
    <div
      lang={lang}
      id="top"
      className={tabs ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0" : undefined}
    >
      <header
        className={`${barClass} pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]`}
      >
        <div className={offset}>
          <div className={`mx-auto ${width} ${margins}`}>{bar}</div>
        </div>
      </header>
      <div
        className={
          side
            ? "md:grid md:grid-cols-[var(--rail)_minmax(0,1fr)] xl:grid-cols-[var(--sidebar)_minmax(0,1fr)]"
            : undefined
        }
      >
        {side && (
          <div className="hidden border-r border-rule md:block">
            {rail && <div className="xl:hidden">{rail}</div>}
            {sidebar && <div className="hidden xl:block">{sidebar}</div>}
          </div>
        )}
        <main className={`mx-auto w-full min-w-0 ${width} py-5 wrap-anywhere ${margins}`}>
          {children}
        </main>
      </div>
      {tabs && <div className={side ? "md:hidden" : undefined}>{tabs}</div>}
    </div>
  );
}
