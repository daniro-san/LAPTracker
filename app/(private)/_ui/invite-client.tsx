"use client";

// What the invite's steps share (D130, issue 453): the one request, the refusal in words, the line under a
// button, a step's card, and the count of an opened link.
import { useEffect, type ReactNode } from "react";

import { track } from "@/lib/analytics/events";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

export type Note = { ok: boolean; text: string } | null;
type Answer = { code: string | null; body: Record<string, unknown> };

/** POST /api/w/invite; `code` null when it went through. */
export async function postInvite(body: object): Promise<Answer> {
  try {
    const res = await fetch("/api/w/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    return { code: res.ok ? null : String(json.code ?? "failed"), body: json };
  } catch {
    return { code: "failed", body: {} };
  }
}

const ERR = new Set([
  "bot_missing",
  "taken",
  "has_desk",
  "closed",
  "signed_out",
  "rate_limited",
  "bot_off",
  "bad_role",
]);

/** A refusal in the person's words. */
export const errorText = (t: WorkspaceDictionary, code: string) =>
  t[ERR.has(code) ? (`invite.err.${code}` as "invite.err.taken") : "invite.err.failed"];

export function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p
      role={note.ok ? "status" : "alert"}
      className={`mt-2 font-semibold ${note.ok ? "" : "text-seal"}`}
    >
      {note.text}
    </p>
  );
}

/** Counts the opened link once per page load (issue 486). */
export function InviteOpened() {
  useEffect(() => track("ws_invite_opened"), []);
  return null;
}

/** One numbered step in its card, with "✓ Done" once it is. */
export function Step(props: {
  id: string;
  head: string;
  done?: boolean;
  t: WorkspaceDictionary;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} className="drawn-card mt-4 px-4 py-3">
      <h2
        id={props.id}
        className="flex flex-wrap items-baseline gap-x-2 font-subhead text-display-sm"
      >
        {props.head}
        {props.done && (
          <span className="text-body-sm font-semibold text-plum">✓ {props.t["invite.done"]}</span>
        )}
      </h2>
      {props.children}
    </section>
  );
}
