"use client";

// "Ended" (issue 585): an event whose time has passed says so in a word, at full contrast, never by fading
// its row (the row's buttons still work). One tag for the desk's Home and Calendar, the members' board and
// a member's own page. `since` is when the server rendered the page, so server and browser HTML agree; with
// none the tag waits for the browser's clock. The browser's minute takes over after hydration.
import { Tag } from "@/lib/brand/components/Tag";

import { useMinute } from "./YourTime";

export function Ended(props: { at: number; word: string; since?: number }) {
  const minute = useMinute();
  const now = minute === null ? (props.since ?? null) : minute * 60_000;
  if (now === null || props.at >= now) return null;
  return (
    <>
      {" "}
      <Tag>{props.word}</Tag>
    </>
  );
}
