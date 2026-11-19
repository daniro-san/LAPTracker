"use client";

// The members' board's adoption (D115): `ws_board_section_viewed` once per page load for each section
// (`data-board-section` in BoardSections.tsx) that came on screen. Only the section's name is sent.
import { useEffect } from "react";

import { track, type BoardSection } from "@/lib/analytics/events";

const SECTIONS = new Set<string>(["week", "notices", "start_here"] satisfies BoardSection[]);

export function BoardSectionsSeen() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.boardSection ?? "";
        if (!entry.isIntersecting || seen.has(name) || !SECTIONS.has(name)) continue;
        seen.add(name);
        observer.unobserve(entry.target);
        track("ws_board_section_viewed", { board_section: name as BoardSection });
      }
    });
    for (const el of document.querySelectorAll("[data-board-section]")) observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return null;
}
