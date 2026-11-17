// The workspace's small controls (DESIGN.md "Workspace components"), as class strings for the elements
// that need them.
//
// FIELD: a text field, select or textarea (DESIGN.md `input`): one look everywhere, the soft drawn frame
// (`.drawn-field`: plum on paper, far above 3:1 in both themes), 44 px or taller. A field with an error
// sets `aria-invalid`, which draws the same frame in seal (app/globals.css). Add spacing and width as the
// place needs; never a `border-*` of its own.
export const FIELD = "drawn-field min-h-11 w-full px-3 py-2 text-ink";

/**
 * A button too small or plain for a full one, or a toggle chip (`aria-pressed`): the soft drawn frame,
 * tinted on hover and press, 44 px tall; a pressed chip is filled plum. A tag is never drawn like this.
 */
export const chip = (on = false) =>
  `drawn-frame-soft tint-button inline-flex min-h-11 items-center gap-1.5 px-3 text-body-sm font-medium disabled:opacity-50 ${
    on ? "bg-plum text-paper" : ""
  }`;
