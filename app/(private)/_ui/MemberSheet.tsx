"use client";

// A member's sheet in the Members list (issue 337): a native <dialog> from the bottom, read from
// /api/w/[slug]/members/[uid] when it opens, so the map position and last online time are never in the
// list's page (D71). It reads again when the list's rows change (after the facts editor saved and the
// page refreshed), keeping what it shows until the new card arrives. Close (×) at the top, Escape, the
// backdrop and the phone's back button close it (the sheet frame).
import { useEffect, useState } from "react";

import { PlayerAvatar } from "@/app/_ui/Pictures";
import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import { clockIn } from "@/lib/private/calendar-time";
import type { CardData } from "@/lib/private/member-card";

import type { ListRow, ListWords } from "./member-list-data";
import { MemberCard, type EditorContext } from "./MemberCards";
import { sheetWords } from "./sheet-words";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";
import { useMinute } from "./YourTime";

async function readCard(slug: string, uid: number): Promise<CardData | typeof SIGNED_OUT | null> {
  try {
    const res = await fetch(`/api/w/${slug}/members/${uid}`, { cache: "no-store" });
    if (res.status === 401) return SIGNED_OUT;
    return res.ok ? ((await res.json()) as { card: CardData }).card : null;
  } catch {
    return null;
  }
}

export function MemberSheet(props: {
  row: ListRow;
  /** Changes when the page's rows are made again; the sheet then reads the card again. */
  version: unknown;
  words: ListWords;
  editor: EditorContext;
  onClose: () => void;
}) {
  const { row, words: t, editor } = props;
  const [card, setCard] = useState<{
    uid: number;
    data: CardData | null;
    signedOut: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void readCard(editor.slug, row.uid).then((r) => {
      const signedOut = r === SIGNED_OUT;
      if (live) setCard({ uid: row.uid, data: signedOut ? null : r, signedOut });
    });
    return () => {
      live = false;
    };
  }, [editor.slug, row.uid, props.version, attempt]);
  const shown = card?.uid === row.uid ? card : null;
  const minute = useMinute();
  const zoneNow =
    row.zone && minute !== null
      ? fill(t["list.theirTimeNow"], { time: clockIn(minute * 60_000, row.zone, "").time })
      : null;
  return (
    <Sheet
      labelledBy="member-sheet-title"
      onCancel={props.onClose}
      title={<span translate="no">{row.name}</span>}
      words={sheetWords(t)}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar uid={row.uid} photo={row.photo} size="lg" />
        <p translate="no" className="min-w-0 flex-1 text-body-sm text-ink/80">
          {shown?.data?.rank ?? row.rankShort}
        </p>
      </div>
      <div className="mt-3 -mx-3">
        {shown === null ? (
          <p role="status" className="px-3 py-4 text-body-sm">
            {t["list.loading"]}
          </p>
        ) : shown.data === null ? (
          <NotRead signedOut={shown.signedOut} t={t} onRetry={() => setAttempt((n) => n + 1)} />
        ) : (
          <MemberCard card={shown.data} editor={editor} zoneNow={zoneNow} />
        )}
      </div>
    </Sheet>
  );
}

/** The card could not be read: the signed-out note (D99) or "Could not load", and Try again. */
function NotRead(props: { signedOut: boolean; t: ListWords; onRetry: () => void }) {
  return (
    <div className="px-3 py-4">
      {props.signedOut ? (
        <SignedOutNote />
      ) : (
        <p role="alert" className="text-body-sm">
          {props.t["list.failed"]}
        </p>
      )}
      <button type="button" onClick={props.onRetry} className={buttonClass("primary", "mt-2")}>
        {props.t["list.retry"]}
      </button>
    </div>
  );
}
