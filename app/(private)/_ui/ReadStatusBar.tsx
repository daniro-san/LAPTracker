"use client";

// The desk's read status bar (D135, issue 478), under the page head on every desk page, officers only: one
// line per tracker read with something to say (lib/private/read-status.ts), the key's first, then newest
// first. Closed, it shows one line below 640 px and two from 640, cut with an ellipsis, and "+n more"; a tap
// opens every line in full. While a read runs it asks the route again every 30 s, only while the tab is
// visible, and refreshes the page once when the read ends, so the cards show the new numbers. A finished
// read's line goes 30 minutes after it ended. The pulse dot is still when the device asks for less motion.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import type { ReadStatus, StatusLine } from "@/lib/private/read-status";

import { nextWake } from "./read-status-wake";

const POLL_MS = 30_000;

const DOT: Record<StatusLine["tone"], string> = {
  progress: "bg-plum motion-safe:animate-pulse",
  quiet: "bg-sage",
  attention: "bg-yarn",
};

function Dot({ tone }: { tone: StatusLine["tone"] }) {
  return <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} />;
}

export interface StatusWords {
  /** "Reads from the tracker". */
  label: string;
  /** "+{n} more". */
  more: string;
  /** "Open Alliance settings". */
  settings: string;
}

/** Asks the route every 30 s while a read runs and the tab is visible; refreshes the page once at the end. */
function usePolling(slug: string, running: boolean, take: (s: ReadStatus) => void) {
  const router = useRouter();
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const ask = async () => {
      try {
        const res = await fetch(`/api/w/${slug}/read-status`, { cache: "no-store" });
        if (res.status === 401) return take({ lines: [], running: false });
        if (!res.ok) return;
        const fresh = (await res.json()) as ReadStatus;
        take(fresh);
        // The read ended: the cards read the new numbers once.
        if (!fresh.running) router.refresh();
      } catch {
        // No answer: the next turn asks again.
      }
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (document.visibilityState === "visible" && !timer) timer = setInterval(ask, POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return stop();
      void ask();
      start();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slug, running, take, router]);
}

/** The lines still to show: a finished read's goes at its `until` (0 until mounted, so both renders agree). */
function useShown(lines: StatusLine[]): StatusLine[] {
  const [now, setNow] = useState(0);
  const wait = nextWake(lines, now);
  useEffect(() => {
    if (wait === null) return;
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [wait]);
  return lines.filter((l) => !l.until || now === 0 || l.until > now);
}

export function ReadStatusBar({
  slug,
  initial,
  words,
  keyShown,
}: {
  slug: string;
  initial: ReadStatus;
  words: StatusWords;
  /** The page shows the key's state itself: leave out the lines Home's key card says too. */
  keyShown: boolean;
}) {
  const [status, setStatus] = useState(initial);
  // A refresh brings the server's newer lines: they replace what the last poll said.
  const [from, setFrom] = useState(initial);
  if (from !== initial) {
    setFrom(initial);
    setStatus(initial);
  }
  usePolling(slug, status.running, setStatus);
  const lines = useShown(status.lines.filter((l) => !(keyShown && l.keyCard)));
  if (lines.length === 0) return null;
  const more = (n: number) => (n > 0 ? words.more.replace("{n}", String(n)) : null);
  const narrow = more(lines.length - 1);
  const wide = more(lines.length - 2);
  const settings = (className: string) => (
    <Link
      href={`/w/${slug}/settings`}
      className={`${className} min-h-11 items-center font-semibold text-plum underline`}
    >
      {words.settings}
    </Link>
  );
  return (
    <section
      aria-label={words.label}
      className="mb-4 flex items-start gap-3 border-b border-rule text-body-sm"
    >
      <Lines lines={lines} words={words} narrow={narrow} wide={wide} settings={settings} />
      {/* From 640 px the key's way to Alliance settings shows beside the closed bar too. */}
      {lines.some((l) => l.settings) && settings("hidden shrink-0 sm:inline-flex")}
    </section>
  );
}

/** The bar itself: closed, the first line (two from 640 px) and "+n more"; open, every line in full. */
function Lines({
  lines,
  words,
  narrow,
  wide,
  settings,
}: {
  lines: StatusLine[];
  words: StatusWords;
  narrow: string | null;
  wide: string | null;
  settings: (className: string) => ReactNode;
}) {
  const [first, second] = lines;
  if (!first) return null;
  return (
    <details className="group min-w-0 flex-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-1 [&::-webkit-details-marker]:hidden">
        <span className="sr-only group-open:not-sr-only group-open:flex-1 group-open:font-semibold">
          {words.label}
        </span>
        <span className="flex min-w-0 flex-1 flex-col group-open:hidden">
          <Row line={first} />
          {second && <Row line={second} className="hidden sm:flex" />}
        </span>
        {narrow && (
          <span className="shrink-0 font-semibold text-plum group-open:hidden sm:hidden">
            {narrow}
          </span>
        )}
        {wide && (
          <span className="hidden shrink-0 font-semibold text-plum group-open:hidden sm:inline">
            {wide}
          </span>
        )}
        <span
          aria-hidden
          className="shrink-0 px-1 motion-safe:transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <ul className="pb-2">
        {lines.map((l) => (
          <li key={l.id} className="py-1">
            <span className="flex items-start gap-2">
              <span className="flex h-5 items-center">
                <Dot tone={l.tone} />
              </span>
              <span className="tabular-nums">{l.text}</span>
            </span>
            {l.settings && settings("ml-4 inline-flex sm:hidden")}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** One closed line: its dot and its text, cut with an ellipsis. */
function Row({ line, className = "flex" }: { line: StatusLine; className?: string }) {
  return (
    <span className={`${className} min-w-0 items-center gap-2`}>
      <Dot tone={line.tone} />
      <span className="truncate tabular-nums">{line.text}</span>
    </span>
  );
}
