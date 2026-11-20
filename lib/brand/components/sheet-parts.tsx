"use client";

// The sheet frame's two sticky parts (DESIGN.md "Workspace components"), shared by the dialog and the pane
// (D122) in Sheet.tsx: the bottom bar (the main action first, then Cancel or the second action; the
// "Discard your changes?" question while asking) and the title row with Close.
import { useEffect, useRef, type ReactNode } from "react";

import { buttonClass } from "./Button";
import type { SheetAction, SheetWords } from "./Sheet";

export const SAFE_BOTTOM = "pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6";

function action(a: SheetAction, variant: "primary" | "secondary", extra: string) {
  return (
    <button
      type={a.form ? "submit" : "button"}
      form={a.form}
      disabled={a.disabled}
      onClick={a.onClick}
      {...(a.focus && { "data-initial-focus": true })}
      className={buttonClass(variant, extra)}
    >
      {a.label}
    </button>
  );
}

/** The sticky bottom bar: the question while asking, else the note and the actions, main action first. */
export function Bar(props: {
  words: SheetWords | undefined;
  asking: boolean;
  note: ReactNode;
  primary: SheetAction | undefined;
  secondary: SheetAction | undefined;
  onClose: () => void;
  onKeep: () => void;
  onDiscard: () => void;
  /** In a pane (D122): labels never break; when the two do not fit side by side, each takes a full row. */
  stack?: boolean;
}) {
  const { words, asking } = props;
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);
  if (!asking && !props.primary) return null;
  const cancel = words && { label: words.cancel, onClick: props.onClose };
  const secondary = props.secondary ?? cancel;
  return (
    <div
      data-sheet-bar
      className={`sticky bottom-0 z-10 border-t border-rule bg-paper px-4 pt-3 sm:px-6 ${SAFE_BOTTOM}`}
    >
      {asking && words ? (
        <>
          <p role="alert" className="mb-2 font-semibold">
            {words.ask}
          </p>
          <div className="flex gap-3">
            <button
              ref={keep}
              type="button"
              onClick={props.onKeep}
              className={buttonClass("primary", "flex-1")}
            >
              {words.keep}
            </button>
            <button type="button" onClick={props.onDiscard} className={buttonClass("secondary")}>
              {words.discard}
            </button>
          </div>
        </>
      ) : (
        <>
          {props.note}
          <div className={props.stack ? "flex flex-wrap gap-3" : "flex gap-3"}>
            {props.primary &&
              action(
                props.primary,
                "primary",
                props.stack ? "flex-auto whitespace-nowrap" : "flex-1",
              )}
            {secondary &&
              action(secondary, "secondary", props.stack ? "flex-auto whitespace-nowrap" : "")}
          </div>
        </>
      )}
    </div>
  );
}

/** The sticky title row: the sheet's name, and Close (×) at the right, 44 px. */
export function TitleRow(props: {
  id: string;
  title: ReactNode;
  close: string | undefined;
  onClose: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-rule bg-paper py-1 pr-1 pl-4 sm:pr-3 sm:pl-6">
      <h2
        id={props.id}
        tabIndex={-1}
        data-sheet-title
        className="min-w-0 flex-1 py-2 font-display text-display-sm"
      >
        {props.title}
      </h2>
      <button
        type="button"
        aria-label={props.close}
        onClick={props.onClose}
        className="tint-button grid size-11 shrink-0 place-items-center text-[28px] leading-none text-plum"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
