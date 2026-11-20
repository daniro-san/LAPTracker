"use client";

// A roll call's marks in the browser (issue 298): a tap shows at once and is sent in the background, one
// member's taps in order, each with the version the officer saw. A mark another officer changed since comes
// back with its newer value and a line saying who and when (409); a refusal or no answer puts the row back.
// A newer read of the page (another officer, an away change) wins wherever its version is higher.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { track } from "@/lib/analytics/events";
import type { Occasion } from "@/lib/private/roll-call";
import { toggled, type Mark } from "@/lib/private/roll-call-rules";

import { sendRoll } from "./roll-call-client";
import type { MarkRowView } from "./roll-call-data";
import { SIGNED_OUT } from "./SignedOut";

export interface Shown {
  mark: Mark | null;
  version: number;
}
type Written = { uid: number; version: number }[];
type Rows = Pick<MarkRowView, "uid" | "mark" | "version">[];

/** `extra` `{ part: "wall" }`: Raid prep's second mark, squads off the wall (D137). */
export function useMarks(slug: string, occasion: Occasion, rows: Rows, failed: string, extra = {}) {
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
    return mine && mine.version >= (row?.version ?? 0)
      ? mine
      : { mark: row?.mark ?? null, version: row?.version ?? 0 };
  };
  const put = (uid: number, s: Shown) => setLocal((l) => ({ ...l, [uid]: s }));
  const base = (uid: number) =>
    Math.max(byUid.get(uid)?.version ?? 0, confirmed.current.get(uid) ?? 0);

  const tap = (uid: number, tapped: "yes" | "no") => {
    const before = shown(uid);
    const mark = toggled(before.mark, tapped);
    put(uid, { mark, version: before.version });
    setError(null);
    const run = async () => {
      const body = { action: "mark", occasion, uid, mark, version: base(uid), ...extra };
      const { status, json } = await sendRoll<{ version: number; mark: Mark | null; said: string }>(
        slug,
        body,
      );
      if (status === 200) track("ws_roll_call_marked", { how: "tap" });
      if (status === 200 || status === 409) {
        const version = json.version ?? 0;
        confirmed.current.set(uid, version);
        put(uid, { mark: status === 200 ? mark : (json.mark ?? null), version });
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
      ...Object.fromEntries(written.map((w) => [w.uid, { mark, version: w.version }])),
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
      if (written) track("ws_roll_call_marked", { how: "rest" });
      return written;
    },
    /** D137: "Accept the tracker's" and other writes of many marks: the stored ones, or null. */
    bulk,
    undo: (items: Written) => bulk({ action: "undo", items }),
  };
}
