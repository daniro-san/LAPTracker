"use client";

// A sticky margin column's box (Spread, D122): from 1024 at most the window's height less its 16 px from the
// top and the page's bottom padding, scrolling on its own with the desk's thin scrollbar (issue 412 UX pass).
// While its notes are taller than that, it is a region in the tab order, named by their heads, so the
// keyboard can scroll it (arrows, Page Down); when everything fits, and below 1024, it is a plain box with
// no tab stop. The 4 px inside it keep a focus ring from being cut at its edges; the stable gutter keeps the
// notes from shifting when the bar appears; the bottom scroll padding keeps a focused line clear of a
// note's sticky foot (Recent activity's Show more).
import { useEffect, useRef, useState, type ReactNode } from "react";

export function MarginPane({
  labelledBy,
  children,
}: {
  /** The ids of the notes' heads, which name the region. */
  labelledBy?: string | undefined;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Below 1024 it never scrolls (a card frame's 3 px tails would otherwise count as overflow).
    const watch = new ResizeObserver(() =>
      setScrolls(
        getComputedStyle(el).overflowY === "auto" && el.scrollHeight > el.clientHeight + 1,
      ),
    );
    watch.observe(el);
    for (const note of el.children) watch.observe(note);
    return () => watch.disconnect();
  }, []);
  return (
    <div
      ref={box}
      data-margin-pane
      {...(scrolls && { tabIndex: 0, role: "region", "aria-labelledby": labelledBy })}
      className="lg:sticky lg:top-4 lg:-mx-1 lg:max-h-[calc(100dvh-3rem)] lg:scroll-pb-14 lg:overflow-y-auto lg:px-1 lg:pb-1 lg:[scrollbar-gutter:stable]"
    >
      {children}
    </div>
  );
}
