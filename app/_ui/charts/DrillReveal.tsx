"use client";
// Inside a chart's path (DrillPath): when a level opens and the path is off screen (the card got shorter
// than where the reader was), brings it into view once, so the path and its Back step are in sight on
// arrival. Otherwise the page does not move: the level kept the scroll position.
import { useEffect, useRef } from "react";

export function DrillReveal() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const nav = mark.current?.closest("nav");
    if (!nav) return;
    const box = nav.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) nav.scrollIntoView({ block: "start" });
  }, []);
  return <span ref={mark} hidden />;
}
