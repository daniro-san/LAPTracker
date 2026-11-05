"use client";
// Light/dark switch (DESIGN.md `theme-switch`): one 44 px button showing the current mode's icon.
// Both icons are rendered and CSS (the `dark:` variant) shows the right one, so the first paint is
// correct without the server knowing the system setting.
// Tapping it sets data-theme on <html> and remembers the choice in a cookie for a year.
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return darkQuery().matches ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const query = darkQuery();
  query.addEventListener("change", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

const ICON = {
  viewBox: "0 0 20 20",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  "aria-hidden": true,
} as const;

const Sun = () => (
  <svg {...ICON}>
    <circle cx="10" cy="10" r="3.75" />
    <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" />
  </svg>
);

const Moon = () => (
  <svg {...ICON}>
    <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
  </svg>
);

export function ThemeSwitch({ label }: { label: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const dark = theme === "dark";
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event("themechange"));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      onClick={toggle}
      className="drawn-frame-soft grid size-11 shrink-0 cursor-pointer place-items-center rounded-xs transition-colors duration-150 hover:bg-paper/15 active:bg-paper/25 motion-reduce:transition-none"
    >
      <span className="dark:hidden">
        <Sun />
      </span>
      <span className="hidden dark:inline">
        <Moon />
      </span>
    </button>
  );
}
