"use client";

// What the thefts log's client components share (issue 321): the write call to the thefts route, and the
// viewer's own clock beside a server time. The browser's zone comes from `useViewerZone` (YourTime.tsx) and
// the day comparison from `clockIn` (calendar-time.ts): the workspace's one viewer clock.
import { dateWords } from "@/lib/date-words";
import { clockIn } from "@/lib/private/calendar-time";
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

/** "15:46" on the viewer's clock, with the date first when that clock is on another day than `serverDay`. */
export function viewerClock(
  at: number,
  serverDay: string,
  zone: string,
  language: WorkspaceLanguage,
): string {
  const { time, shift } = clockIn(at, zone, serverDay);
  return shift === 0 ? time : dateWords(language, zone).at(new Date(at));
}
