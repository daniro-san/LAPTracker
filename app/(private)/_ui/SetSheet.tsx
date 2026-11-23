"use client";
// An Insights set of 13 to 60 members (D158 rule 7 (c)): its row is a button that opens the names in the
// bottom sheet below 1024 px, or in the side pane at the top of the page's margin from 1024 px (`#who-pane`),
// titled with the chart's own sentence, so the chart stays on screen. The open set is in the address fragment
// (`#who-<key>`): on a phone only on the sheet's own history entry, so Back closes the sheet and a name's
// card then Back opens it again; in the pane on the page's entry. Closing gives the focus back to the row
// without scrolling. Opening counts `ws_drilldown_opened` once per kind (InsightsSetMemory); reopening from
// the fragment does not.
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { InsightsSet } from "@/lib/analytics/events";
import { Sheet, type SheetWords } from "@/lib/brand/components/Sheet";

import { countOpen, openSetId, revealSet } from "./InsightsSetMemory";
import { useWide } from "./open-member";

/** The pane's place in the page's margin column. */
export const PANE_ID = "who-pane";

function writeHash(id: string | null) {
  const url = new URL(window.location.href);
  url.hash = id ?? "";
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // Refused by the browser's limit on history changes: keep the address.
  }
}

export function SetSheet(props: {
  kind: InsightsSet;
  setKey: string;
  count: number;
  title: string;
  summary: ReactNode;
  words: SheetWords;
  className: string;
  children: ReactNode;
}) {
  const id = `who-${props.setKey}`;
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // One set in the pane at a time: another opening closes this one.
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(PANE_ID, other);
    return () => window.removeEventListener(PANE_ID, other);
  }, [id]);
  useEffect(() => {
    setPane(document.getElementById(PANE_ID));
    if (openSetId(window.location.hash) !== id) return;
    const row = document.getElementById(id);
    if (row) revealSet(row);
    setOpen(true);
  }, [id]);
  // After the sheet's own layout effect has pushed its history entry (a child's runs first).
  useLayoutEffect(() => {
    if (open) writeHash(id);
  }, [open, id]);
  const show = () => {
    countOpen(props.kind, props.count);
    window.dispatchEvent(new CustomEvent(PANE_ID, { detail: id }));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    // The pane has no entry of its own: the page's address drops the set. The sheet's entry goes with it.
    if (wide) writeHash(null);
    document.getElementById(id)?.focus({ preventScroll: true });
  };
  const titleId = `${id}-title`;
  const body = <div className="pb-2">{props.children}</div>;
  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
        className={props.className}
      >
        {props.summary}
      </button>
      {open && wide === false && (
        <Sheet labelledBy={titleId} title={props.title} words={props.words} onCancel={close}>
          {body}
        </Sheet>
      )}
      {open &&
        wide === true &&
        pane &&
        createPortal(
          <Sheet pane labelledBy={titleId} title={props.title} words={props.words} onCancel={close}>
            {body}
          </Sheet>,
          pane,
        )}
    </>
  );
}
