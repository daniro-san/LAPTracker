"use client";

// A Members tab filter: a plain link (the server applies `?f=`), which also counts the filter's use (D77).
// Only the filter's name is sent, never the address with the search text.
import type { ReactNode } from "react";

import { track } from "@/lib/analytics/events";
import type { MemberFilter } from "@/lib/private/members-list";

export function FilterChip({
  filter,
  href,
  current,
  className,
  children,
}: {
  filter: MemberFilter;
  href: string;
  current: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={current ? "true" : undefined}
      onClick={() => track("ws_filter_used", { filter })}
      className={className}
    >
      {children}
    </a>
  );
}
