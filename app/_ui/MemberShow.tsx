"use client";

// The member list's Joined / Left chips (the drilldowns' landing, `show=` in the URL), the line that says when
// the two member lists were read while one is on, and the URL kept in step with the list's filter and order.
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { fill } from "@/lib/copy";

import { useCopy } from "./LocaleProvider";
import { filterFromUrl, type MemberFilter, type MemberShow, type MemberView } from "./member-views";

export const CHIP =
  "drawn-frame-soft tint-button inline-flex min-h-11 shrink-0 items-center gap-1 px-3 text-body-sm font-medium";

/** Joined / Left carry a sign and a colour as well as the word `copy.members[status]` (07c S12; DESIGN.md
 * three channels). */
export const STATUS = {
  joined: { sign: "+", tone: "text-yarn" },
  left: { sign: "−", tone: "text-seal" },
} as const;

/** All / + Joined (n) / − Left (n): each count is how many the list holds with that chip on, whatever the
 * search or the might range. Tapping the pressed chip again shows everyone. */
export function ShowChips({
  f,
  set,
  members,
}: {
  f: MemberFilter;
  set: (p: Partial<MemberFilter>) => void;
  members: MemberView[];
}) {
  const copy = useCopy();
  const count = (show: MemberShow) => members.filter((m) => m.status === show).length;
  const chip = (show: MemberShow, label: ReactNode) => {
    const on = f.show === show;
    return (
      <button
        key={show || "all"}
        type="button"
        aria-pressed={on}
        className={`${CHIP} ${on ? "bg-plum text-paper" : "text-plum"}`}
        onClick={() => set({ show: on ? "" : show })}
      >
        {label}
      </button>
    );
  };
  const status = (show: "joined" | "left") => (
    <>
      <span aria-hidden="true" className={f.show === show ? "" : STATUS[show].tone}>
        {STATUS[show].sign}
      </span>{" "}
      {copy.members[show]} ({count(show)})
    </>
  );
  return (
    <div role="group" aria-label={copy.history.show} className="flex flex-wrap gap-2">
      {chip("", copy.history.all)}
      {chip("joined", status("joined"))}
      {chip("left", status("left"))}
    </div>
  );
}

/** "In the member list at Start (10:00), not at End (Nov 14, 14:00).": neutral words, with both read times. */
export function ShowReads({
  show,
  reads,
}: {
  show: MemberShow;
  reads: { from: string; to: string };
}) {
  const copy = useCopy();
  if (show === "") return null;
  return (
    <p className="mb-2 text-body-sm tabular-nums text-ink/70">
      {fill(show === "joined" ? copy.members.joinedReads : copy.members.leftReads, reads)}
    </p>
  );
}

/**
 * The list follows the address's `show=`: a link on the same page (the split's lines) navigates without
 * remounting the list, so the server's first filter alone would leave it on All. The chips' own
 * `replaceState` changes the address too; `apply` then sets what the chip already set.
 */
export function useShowFromUrl(
  members: MemberView[],
  mode: { canDelta: boolean; compared: boolean },
  apply: (show: MemberShow) => void,
) {
  const show = filterFromUrl({ show: useSearchParams().get("show") }, mode, members).show;
  const [seen, setSeen] = useState(show);
  if (seen !== show) {
    setSeen(show);
    apply(show);
  }
}

/** The URL's `show=` and `sort=` follow the chips, without a reload (Next's router keeps the address). */
export function keepInUrl(f: MemberFilter) {
  const url = new URL(window.location.href);
  if (f.show) url.searchParams.set("show", f.show);
  else url.searchParams.delete("show");
  if (f.sort !== "might") url.searchParams.set("sort", f.sort);
  else url.searchParams.delete("sort");
  window.history.replaceState(null, "", url);
}
