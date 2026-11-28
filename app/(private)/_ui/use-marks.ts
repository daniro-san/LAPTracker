"use client";

// A roll call's marks in the browser (issue 298): a tap shows at once and is sent in the background, one
// member's taps in order, each with the version the officer saw. A mark another officer changed since comes
// back with its newer value and a line saying who and when (409); a refusal or no answer puts the row back.
// A newer read of the page (another officer, an away change) wins wherever its version is higher.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { track, type RollCallType } from "@/lib/analytics/events";
import type { Occasion } from "@/lib/private/roll-call";
import { toggled, type Mark } from "@/lib/private/roll-call-rules";

import { sendRoll } from "./roll-call-client";
import type { MarkRowView } from "./roll-call-data";
import { SIGNED_OUT } from "./SignedOut";

export interface Shown {
  mark: Mark | null;
  version: number;
  /** An Elixir Scramble Joined mark's optional score (issue 468). */
  score: number | null;
}
type Written = { uid: number; version: number }[];
type Rows = (Pick<MarkRowView, "uid" | "mark" | "version"> & { score?: number | null })[];
/** The marking page's refusal line, and which roll call it is for analytics (issue 585). */
type Marking = { failed: string; roll_call: RollCallType };

/** What the page read for a member. */
const stored = (row: Rows[number] | undefined): Shown => ({
  mark: row?.mark ?? null,
  version: row?.version ?? 0,
  score: row?.score ?? null,
});

/** `extra` `{ part: "wall" }`: Raid prep's second mark, squads off the wall (D137). */
export function useMarks(slug: string, occasion: Occasion, rows: Rows, page: Marking, extra = {}) {
  const { failed, roll_call } = page;
  const router = useRouter();
  const [local, setLocal] = useState<Record<number, Shown>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const confirmed = useRef(new Map<number, number>());
  const chains = useRef(new Map<number, Promise<void>>());
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const shown = (uid: number): Shown => {
    const row = byUid.get(uid);
    const mine = local[uid];
    return mine && mine.version >= (row?.version ?? 0) ? mine : stored(row);
  };
  const put = (uid: number, s: Shown) => setLocal((l) => ({ ...l, [uid]: s }));
  const base = (uid: number) =>
    Math.max(byUid.get(uid)?.version ?? 0, confirmed.current.get(uid) ?? 0);

  /** `keep`: D137's ✓ on the tracker's own ✓ makes it the officer's (it stays ✓) instead of clearing it. */
  const tap = (uid: number, tapped: Exclude<Mark, "assumed">, keep = false, saved?: number) => {
    const before = shown(uid);
    const mark = keep ? tapped : toggled(before.mark, tapped);
    const score = mark === "yes" ? (saved ?? null) : null;
    put(uid, { mark, version: before.version, score });
    setError(null);
    const run = async () => {
      const body = { action: "mark", occasion, uid, mark, version: base(uid), score, ...extra };
      const { status, json } = await sendRoll<{ version: number; mark: Mark | null; said: string }>(
        slug,
        body,
      );
      if (status === 200) track("ws_roll_call_marked", { how: "tap", roll_call });
      if (status === 200 || status === 409) {
        const version = json.version ?? 0;
        confirmed.current.set(uid, version);
        const stale = { mark: json.mark ?? null, version, score: null };
        put(uid, status === 200 ? { mark, version, score } : stale);
        setNotes((n) => ({ ...n, [uid]: status === 409 ? (json.said ?? "") : "" }));
        return;
      }
      put(uid, before);
      setError(status === 401 ? SIGNED_OUT : failed);
    };
    const next = (chains.current.get(uid) ?? Promise.resolve()).then(run);
    chains.current.set(uid, next);
  };

  /** Writes each answer the server stored, and reads the page again for the rest. */
  const apply = (written: Written, mark: Mark | null) => {
    for (const w of written) confirmed.current.set(w.uid, w.version);
    setLocal((l) => ({
      ...l,
      ...Object.fromEntries(written.map((w) => [w.uid, { mark, version: w.version, score: null }])),
    }));
    router.refresh();
  };

  const bulk = async (body: object): Promise<Written | null> => {
    setError(null);
    const { status, json } = await sendRoll<{ written: Written; mark: Mark | null }>(slug, {
      ...body,
      occasion,
    });
    if (status !== 200 || !json.written) {
      setError(status === 401 ? SIGNED_OUT : failed);
      return null;
    }
    apply(json.written, json.mark ?? null);
    return json.written;
  };

  return {
    shown,
    notes,
    error,
    tap,
    rest: async (uids: number[]) => {
      const written = await bulk({ action: "rest", uids });
      if (written) track("ws_roll_call_marked", { how: "rest", roll_call });
      return written;
    },
    /** D137: "Accept the tracker's" and other writes of many marks: the stored ones, or null. */
    bulk,
    undo: (items: Written) => bulk({ action: "undo", items }),
  };
}
