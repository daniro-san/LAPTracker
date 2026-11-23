"use client";

// The bottom sheet (DESIGN.md `bottom-sheet`) as a real <dialog>: the one place a question, a PIN or a form
// over a page is shown. Modal (default): showModal() gives the focus trap and aria-modal; on close, focus
// goes back to what opened it; a child marked `data-initial-focus` gets the first focus (put it on the safe
// answer), else the title. `gate` is the same card left open in the page flow, under a heading, for a page
// that is locked until it is answered. Below 640 px a sheet pinned to the bottom; at ≥ 640 px a centred
// card (modal) or a card in the flow (gate). `pane` is the same frame drawn in the page, not a dialog: the
// open item of a master-detail list from 1024 (D122), its own scroller with the thin scrollbar.
//
// The frame (DESIGN.md "Workspace components"): with `title`, a sticky title row with a 44 px Close (×);
// with `primary`, a sticky bar at the bottom: the main action first and widest, Cancel after it. Every way
// of closing — Close, Cancel, Escape, the backdrop, the phone's back gesture — asks "Discard your changes?"
// first while `dirty`. A modal sheet owns one history entry, so back closes the sheet, not the page. A
// focused field is scrolled clear of the bar and of the iPhone keyboard (revealFocused).
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { backdropTap, closeStep, outside, pageSheets } from "./sheet-close";
import { Bar, SAFE_BOTTOM, TitleRow } from "./sheet-parts";

// iPhone (Safari, Brave): the sheet is its own only scroller, never wider than the screen, below the
// notch, and a scroll that reaches its end stays in it. Long names, links and zone ids wrap. The page
// behind is locked while a modal sheet is open (app/globals.css).
const FIT =
  "max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top)))] overflow-x-hidden overflow-y-auto overscroll-contain wrap-anywhere";
const SHEET = `fixed inset-x-0 bottom-0 top-auto z-50 m-0 w-full max-w-none border-0 border-t border-rule bg-paper p-0 text-ink shadow-[0_-8px_24px_var(--sheet-shadow)] backdrop:bg-[var(--sheet-scrim)] ${FIT}`;
// With a sticky bar, a control the browser scrolls into view (Tab, focus) stops above the bar, not under it.
const BAR_CLEARANCE = "scroll-pb-24";
const MODAL_CARD =
  "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-3rem)] sm:max-w-md sm:border";
const GATE_CARD = "sm:static sm:mt-6 sm:border sm:shadow-none";

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

const TYPED = 'input:not([type="checkbox"], [type="radio"], [type="file"]), textarea, select';

/**
 * A field that gets the focus is kept above the sticky bar and above the iPhone keyboard: the browser
 * scrolls it into the sheet but not clear of the bar, and the keyboard opens after the focus, so the
 * check runs again when the visible viewport shrinks. Returns the cleanup.
 */
function revealFocused(dialog: HTMLDialogElement): () => void {
  const reveal = () => {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement) || !dialog.contains(field) || !field.matches(TYPED)) return;
    if (field.closest("[data-sheet-bar]")) return;
    const view = window.visualViewport;
    const bar = dialog.querySelector("[data-sheet-bar]")?.getBoundingClientRect().top ?? Infinity;
    const bottom = Math.min(bar, view ? view.offsetTop + view.height : window.innerHeight);
    const hidden = field.getBoundingClientRect().bottom + 8 - bottom;
    if (hidden > 0) dialog.scrollBy({ top: hidden });
  };
  // focusin comes before the browser's own scroll to the field: measure after it.
  const later = () => requestAnimationFrame(reveal);
  dialog.addEventListener("focusin", later);
  window.visualViewport?.addEventListener("resize", reveal);
  return () => {
    dialog.removeEventListener("focusin", later);
    window.visualViewport?.removeEventListener("resize", reveal);
  };
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
    // Set while this code closes it, so the close event is not read as the browser's own.
    delete dialog.dataset.closing;
    dialog.showModal();
    (
      dialog.querySelector<HTMLElement>("[data-initial-focus]") ??
      dialog.querySelector<HTMLElement>("[data-sheet-title]")
    )?.focus();
    const release = pageSheets().open(() => back.current());
    const stopReveal = revealFocused(dialog);
    return () => {
      stopReveal();
      dialog.dataset.closing = "";
      dialog.close();
      release();
      // Without preventScroll the page jumps back to the opener (to the top for a header button).
      opener?.focus({ preventScroll: true });
    };
  }, [modal]);
  return ref;
}

/** The content's padding: the title row and the bottom bar bring their own. */
const bodyClass = (framed: boolean, bar: boolean) =>
  `px-4 pt-4 sm:px-6 ${framed ? "" : "sm:pt-6"} ${bar ? "pb-4" : SAFE_BOTTOM}`;

/** A press on the dialog element itself, outside its card: on the backdrop. */
const onBackdrop = (e: MouseEvent<HTMLDialogElement>) =>
  e.target === e.currentTarget &&
  outside(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);

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
  /** Drawn in the page beside a list (D122 master-detail): no dialog, no history entry, no backdrop. */
  pane?: boolean;
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
  return props.pane ? <Pane {...props} /> : <DialogSheet {...props} />;
}

/** The frame's parts in either container: the title row, the content, the bar. */
function Parts({
  props,
  c,
  stack,
}: {
  props: SheetProps;
  c: ReturnType<typeof useClose>;
  stack?: boolean;
}) {
  const framed = props.title !== undefined;
  return (
    <>
      {framed && (
        <TitleRow
          id={props.labelledBy}
          title={props.title}
          close={props.words?.close}
          onClose={c.close}
        />
      )}
      <div className={bodyClass(framed, props.primary !== undefined || c.asking)}>
        {props.children}
      </div>
      <Bar
        words={props.words}
        asking={c.asking}
        note={props.note}
        primary={props.primary}
        secondary={props.secondary}
        onClose={c.close}
        onKeep={c.keep}
        onDiscard={() => props.onCancel?.()}
        {...(stack && { stack })}
      />
    </>
  );
}

/**
 * The frame as a pane: the title row and the bar stick inside it while its content scrolls. It is at most
 * the window's height less its 8 px from the top and the page's 20 px bottom padding (with room to spare),
 * so at the end of a list the sticky pane is never pushed up past its title. The drawn frame is on the
 * outer box: inside a scroller it would scroll away with the content.
 */
function Pane(props: SheetProps) {
  const c = useClose(props.dirty ?? false, props.onCancel);
  return (
    <section
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      className="drawn-card bg-paper"
    >
      <div
        data-sheet-pane
        className={`max-h-[calc(100dvh-2.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain wrap-anywhere ${props.primary ? BAR_CLEARANCE : ""}`}
      >
        <Parts props={props} c={c} stack />
      </div>
    </section>
  );
}

function DialogSheet(props: SheetProps) {
  const { gate = false } = props;
  const c = useClose(props.dirty ?? false, props.onCancel);
  const ref = useSheet(!gate, c.close);
  const pressedOutside = useRef(false);
  const framed = props.title !== undefined;
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
      onPointerDown={(e) => {
        pressedOutside.current = onBackdrop(e);
      }}
      onClick={(e) => {
        const tap = backdropTap(pressedOutside.current, onBackdrop(e));
        if ((props.backdropCloses ?? framed) && tap) c.close();
      }}
      onClose={(e) => {
        e.stopPropagation();
        const dialog = e.currentTarget;
        // The browser closed it on its own (Chrome's close watcher can skip the cancel): open it again
        // and take the usual way, which closes, asks first, or stays.
        if (gate || dialog.open || "closing" in dialog.dataset) return;
        dialog.showModal();
        c.close();
      }}
      className={`${SHEET} ${gate ? GATE_CARD : MODAL_CARD} ${props.primary ? BAR_CLEARANCE : ""}`}
    >
      <Parts props={props} c={c} />
    </dialog>
  );
}
