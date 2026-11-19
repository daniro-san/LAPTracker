"use client";

// A page head's actions that open a sheet (D122). `PageHead` draws each action twice (the row from 768 and
// the phone's row with More), so an action is a plain button that names its sheet, and the sheet itself is
// held once, wherever the page puts it (Members: "Paste updates", "Add a new member").
import { createContext, use, useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";

const Open = createContext<{ open: string | null; set: (id: string | null) => void }>({
  open: null,
  set: () => undefined,
});

export function PageActions({ children }: { children: ReactNode }) {
  const [open, set] = useState<string | null>(null);
  return <Open value={{ open, set }}>{children}</Open>;
}

/** The button in the page head; in the More menu it is one of its rows. */
export function ActionButton(props: {
  id: string;
  label: string;
  variant: "primary" | "secondary";
}) {
  const { set } = use(Open);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => set(props.id)}
      className={buttonClass(props.variant)}
    >
      {props.label}
    </button>
  );
}

/** Whether this action's sheet is open, and how to close it. */
export function usePageAction(id: string): [boolean, () => void] {
  const { open, set } = use(Open);
  return [open === id, () => set(null)];
}
