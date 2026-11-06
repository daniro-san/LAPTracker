"use client";

// A <details> menu that also closes on Escape (focus back on its summary) and on a tap outside it
// (07c S12). Without JavaScript it is still a working <details>.
import { useEffect, useRef, type ReactNode, type SyntheticEvent } from "react";

export function Disclosure({
  label,
  className,
  onToggle,
  children,
}: {
  /** The accessible name of the group, e.g. "Events". */
  label: string;
  className?: string;
  onToggle?: (e: SyntheticEvent<HTMLDetailsElement>) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !details.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  return (
    <details ref={ref} aria-label={label} className={className} onToggle={onToggle}>
      {children}
    </details>
  );
}
