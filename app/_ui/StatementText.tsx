"use client";

// A long alliance statement cut after six lines, with a Show all button (D128). The server renders this only
// for a text that may run past six lines at 360 px (AllianceStatement.tsx); a short one needs no script.
// Where the text fits after all (a wide screen), the button hides.
import { useEffect, useId, useRef, useState } from "react";

import { useCopy } from "./LocaleProvider";

export function StatementText({
  text,
  lang,
  className,
}: {
  text: string;
  lang: string | undefined;
  className: string;
}) {
  const copy = useCopy();
  const id = useId();
  const ref = useRef<HTMLQuoteElement>(null);
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setFits(el.scrollHeight <= el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);
  return (
    <>
      <blockquote
        ref={ref}
        id={id}
        lang={lang}
        dir="auto"
        className={`${className} ${open ? "" : "line-clamp-6"}`}
      >
        {text}
      </blockquote>
      {(open || !fits) && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="text-button mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-2"
        >
          {open ? copy.statement.showLess : copy.statement.showAll}
        </button>
      )}
    </>
  );
}
