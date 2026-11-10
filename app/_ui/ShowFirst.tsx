"use client";

// The first `top` items of a list and a "Show all (n)" button for the rest, as the alliance page's member
// list does (app/_ui/MembersExplorer.tsx). The items are rendered on the server and already in the page;
// nothing is fetched. Used by the compare page's members view (UX review S5).
import { Children, useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";

import { useCopy } from "./LocaleProvider";

export function ShowFirst({ top, children }: { top: number; children: ReactNode }) {
  const copy = useCopy();
  const [all, setAll] = useState(false);
  const items = Children.toArray(children);
  const shown = all ? items : items.slice(0, top);
  return (
    <>
      <ul>{shown}</ul>
      {shown.length < items.length && (
        <button
          type="button"
          className={`${buttonClass("secondary")} mt-3 w-full sm:w-auto`}
          onClick={() => setAll(true)}
        >
          {fill(copy.members.showAll, { n: String(items.length) })}
        </button>
      )}
    </>
  );
}
