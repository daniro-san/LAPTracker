"use client";

// What the thefts log's client components share (issue 321): the write call to the thefts route, and the
// viewer's own clock beside a server time. The browser's zone is read only after hydration (the server
// renders nothing for it), so server and browser HTML never differ.
import { useSyncExternalStore } from "react";

import type { WorkspaceLanguage } from "@/lib/private/dictionary";

/** POST to the thefts route: "ok", or the route's error code ("failed" for anything unexpected). */
export async function postTheft(slug: string, body: object): Promise<string> {
  try {
    const res = await fetch(`/api/w/${slug}/thefts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    return ((await res.json()) as { code?: string }).code ?? "failed";
  } catch {
    return "failed";
  }
}

const subscribe = () => () => {};

/** The browser's IANA zone; null while rendering on the server and during hydration. */
export function useViewerZone(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/** "15:46" on the viewer's clock, with the date first when that clock is on another day than `serverDay`. */
export function viewerClock(
  at: number,
  serverDay: string,
  zone: string,
  language: WorkspaceLanguage,
): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(at);
  const time = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone,
  }).format(at);
  if (day === serverDay) return time;
  const date = new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).format(at);
  return `${date} ${time}`;
}
