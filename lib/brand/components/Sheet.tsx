"use client";

// The bottom sheet (DESIGN.md `bottom-sheet`) as a real <dialog>: the one place a question, a PIN or a form
// over a page is shown. Modal (default): showModal() gives the focus trap and aria-modal; on close, focus
// goes back to what opened it; a child marked `data-initial-focus` gets the first focus (put it on the safe
// answer), else the title. `gate` is the same card left open in the page flow, under a heading, for a page
// that is locked until it is answered. Below 640 px a sheet pinned to the bottom; at ≥ 640 px a centred
// card (modal) or a card in the flow (gate).
//
// The frame (DESIGN.md "Workspace components"): with `title`, a sticky title row with a 44 px Close (×);
// with `primary`, a sticky bar at the bottom: the main action first and widest, Cancel after it. Every way
// of closing — Close, Cancel, Escape, the backdrop, the phone's back gesture — asks "Discard your changes?"
// first while `dirty`. A modal sheet owns one history entry, so back closes the sheet, not the page.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { buttonClass } from "./Button";
import { closeStep, pageSheets } from "./sheet-close";

// iPhone (Safari, Brave): the sheet is its own only scroller, never wider than the screen, below the
// notch, and a scroll that reaches its end stays in it. Long names, links and zone ids wrap. The page
// behind is locked while a modal sheet is open (app/globals.css).
const FIT =
  "max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] overflow-x-hidden overflow-y-auto overscroll-contain wrap-anywhere";
const SHEET = `fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-rule bg-paper p-0 text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] backdrop:bg-[var(--sheet-scrim)] ${FIT}`;
const MODAL_CARD =
  "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-3rem)] sm:max-w-md sm:border";
const GATE_CARD = "sm:static sm:mt-6 sm:border sm:shadow-none";
const SAFE_BOTTOM = "pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6";

/** The frame's own words, in the viewer's language. */
export interface SheetWords {
  close: string;
  cancel: string;
  /** "Discard your changes?" */
  ask: string;
  keep: string;
  discard: string;
}

export interface SheetAction {
  label: ReactNode;
  onClick?: () => void;
  /** Submits the <form> with this id (the button sits in the bar, outside the form). */
  form?: string;
  disabled?: boolean;
  /** Gets the first focus. */
  focus?: boolean;
}

function useSheet(modal: boolean, onBack: () => "closed" | "stay") {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef(onBack);
  useLayoutEffect(() => {
    back.current = onBack;
  });
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    (
      dialog.querySelector<HTMLElement>("[data-initial-focus]") ??
      dialog.querySelector<HTMLElement>("[data-sheet-title]")
    )?.focus();
    const release = pageSheets().open(() => back.current());
    return () => {
      dialog.close();
      release();
      // Without preventScroll the page jumps back to the opener (to the top for a header button).
      opener?.focus({ preventScroll: true });
    };
  }, [modal]);
  return ref;
}

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
function Bar(props: {
  words: SheetWords | undefined;
  asking: boolean;
  note: ReactNode;
  primary: SheetAction | undefined;
  secondary: SheetAction | undefined;
  onClose: () => void;
  onKeep: () => void;
  onDiscard: () => void;
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
          <div className="flex gap-3">
            {props.primary && action(props.primary, "primary", "flex-1")}
            {secondary && action(secondary, "secondary", "")}
          </div>
        </>
      )}
    </div>
  );
}

/** The sticky title row: the sheet's name, and Close (×) at the right, 44 px. */
function TitleRow(props: {
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

/** The content's padding: the title row and the bottom bar bring their own. */
const bodyClass = (framed: boolean, bar: boolean) =>
  `px-4 pt-4 sm:px-6 ${framed ? "" : "sm:pt-6"} ${bar ? "pb-4" : SAFE_BOTTOM}`;

/** A tap on the dialog element itself, outside its card: the backdrop. */
function onBackdrop(e: MouseEvent<HTMLDialogElement>) {
  if (e.target !== e.currentTarget) return false;
  const box = e.currentTarget.getBoundingClientRect();
  return !(
    e.clientX >= box.left &&
    e.clientX <= box.right &&
    e.clientY >= box.top &&
    e.clientY <= box.bottom
  );
}

/** Every way of closing: closes, or asks first while `dirty`; "stay" when the sheet did not close. */
function useClose(dirty: boolean, onCancel: (() => void) | undefined) {
  const [asking, setAsking] = useState(false);
  const close = (): "closed" | "stay" => {
    const step = closeStep(dirty, onCancel !== undefined);
    if (step === "ask") setAsking(true);
    if (step !== "close") return "stay";
    onCancel?.();
    return "closed";
  };
  return { asking, keep: () => setAsking(false), close };
}

export interface SheetProps {
  gate?: boolean;
  role?: "alertdialog";
  /** The id of the element that names the sheet (with `title`, the title row's heading gets it). */
  labelledBy: string;
  describedBy?: string;
  /** Closes the sheet. Without it Escape and back do nothing: a sheet answers through its buttons. */
  onCancel?: () => void;
  /** A tap on the backdrop, outside the card, also closes (asking first while `dirty`); on by default with `title`. */
  backdropCloses?: boolean;
  /** The frame's title row, with Close (×); needs `words`. */
  title?: ReactNode;
  words?: SheetWords;
  /** The frame's bottom bar: the main action; Cancel follows it unless `secondary` replaces it. */
  primary?: SheetAction;
  secondary?: SheetAction;
  /** Above the bar's buttons: why the main action is off, the last error. */
  note?: ReactNode;
  /** Unsaved changes: every close asks first. */
  dirty?: boolean;
  children: ReactNode;
}

export function Sheet(props: SheetProps) {
  const { gate = false, title, words, primary, onCancel } = props;
  const c = useClose(props.dirty ?? false, onCancel);
  const ref = useSheet(!gate, c.close);
  const framed = title !== undefined;
  const bar = primary !== undefined || c.asking;
  return (
    <dialog
      ref={ref}
      role={props.role}
      open={gate || undefined}
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      onCancel={(e) => {
        e.preventDefault();
        // A sheet opened from inside another: Escape is this one's only.
        e.stopPropagation();
        c.close();
      }}
      onClick={(e) => {
        if ((props.backdropCloses ?? framed) && onBackdrop(e)) c.close();
      }}
      className={`${SHEET} ${gate ? GATE_CARD : MODAL_CARD}`}
    >
      {framed && (
        <TitleRow id={props.labelledBy} title={title} close={words?.close} onClose={c.close} />
      )}
      <div className={bodyClass(framed, bar)}>{props.children}</div>
      <Bar
        words={words}
        asking={c.asking}
        note={props.note}
        primary={primary}
        secondary={props.secondary}
        onClose={c.close}
        onKeep={c.keep}
        onDiscard={() => onCancel?.()}
      />
    </dialog>
  );
}
