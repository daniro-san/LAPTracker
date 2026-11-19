"use client";
// "More ▾" (DESIGN.md "Layout components", D122): a page's secondary actions on a phone, a <details> whose
// framed list holds one 44 px row per action. The list opens under the row the menu sits in and is as wide
// as that row (the nearest positioned ancestor: PageHead's actions row), so it never runs off a 360 px
// screen. A choice or Escape closes it (Escape gives the focus back to the summary). Never for navigation.
import { useRef, type ReactNode } from "react";

import { buttonClass } from "../Button";

export function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (focus: boolean) => {
    if (!ref.current?.open) return;
    ref.current.open = false;
    if (focus) ref.current.querySelector("summary")?.focus();
  };
  return (
    <details
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") close(true);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-more-list] a, [data-more-list] button"))
          close(false);
      }}
    >
      <summary className={buttonClass("secondary", "gap-1 [&::-webkit-details-marker]:hidden")}>
        {label} <span aria-hidden="true">▾</span>
      </summary>
      <div
        data-more-list
        className="drawn-card absolute inset-x-0 top-full z-20 mt-2 flex flex-col bg-paper py-1 [&>*]:flex [&>*]:min-h-11 [&>*]:items-center [&>*]:px-3"
      >
        {children}
      </div>
    </details>
  );
}
