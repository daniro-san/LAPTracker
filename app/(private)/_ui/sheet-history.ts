"use client";

// A sheet the phone's back button closes (issue 337): opening it adds one history entry at the same
// address, back closes it, and closing it any other way (Close, Escape, the backdrop) takes that entry
// off again. The page behind keeps its scroll and its "Show more" depth, because it never leaves.
import { useEffect, useState } from "react";

export function useHistorySheet<T>() {
  const [open, setOpen] = useState<T | null>(null);
  const shown = open !== null;
  useEffect(() => {
    if (!shown) return;
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [shown]);
  const show = (value: T) => {
    if (!shown) window.history.pushState(window.history.state, "");
    setOpen(value);
  };
  const hide = () => {
    setOpen(null);
    window.history.back();
  };
  return { open, show, hide };
}
