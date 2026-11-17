"use client";

// A member's sheet in the Members list (issue 337): a native <dialog> from the bottom, read from
// /api/w/[slug]/members/[uid] when it opens, so the map position and last online time are never in the
// list's page (D71). It reads again when the list's rows change (after the facts editor saved and the
// page refreshed), keeping what it shows until the new card arrives. Close, Escape, the backdrop and the
// phone's back button close it.
import { useEffect, useState } from "react";

import { PlayerAvatar } from "@/app/_ui/Pictures";
import { buttonClass } from "@/lib/brand/components/Button";
import { Sheet } from "@/lib/brand/components/Sheet";

import type { CardData } from "./member-card-data";
import type { ListRow, ListWords } from "./member-list-data";
import { MemberCard, type EditorContext } from "./MemberCards";

async function readCard(slug: string, uid: number): Promise<CardData | null> {
  try {
    const res = await fetch(`/api/w/${slug}/members/${uid}`, { cache: "no-store" });
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
  const [card, setCard] = useState<{ uid: number; data: CardData | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void readCard(editor.slug, row.uid).then((data) => {
      if (live) setCard({ uid: row.uid, data });
    });
    return () => {
      live = false;
    };
  }, [editor.slug, row.uid, props.version, attempt]);
  const shown = card?.uid === row.uid ? card : null;
  return (
    <Sheet labelledBy="member-sheet-title" onCancel={props.onClose} backdropCloses>
      <div className="flex items-center gap-3">
        <PlayerAvatar uid={row.uid} photo={row.photo} size="lg" />
        <div className="min-w-0 flex-1">
          <h2
            id="member-sheet-title"
            tabIndex={-1}
            data-initial-focus
            translate="no"
            className="font-display text-display-sm break-words"
          >
            {row.name}
          </h2>
          <p translate="no" className="text-body-sm text-ink/80">
            {shown?.data?.rank ?? row.rankShort}
          </p>
        </div>
      </div>
      <div className="mt-3 -mx-3">
        {shown === null ? (
          <p role="status" className="px-3 py-4 text-body-sm">
            {t["list.loading"]}
          </p>
        ) : shown.data === null ? (
          <div className="px-3 py-4">
            <p role="alert" className="text-body-sm">
              {t["list.failed"]}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className={buttonClass("secondary", "mt-2")}
            >
              {t["list.retry"]}
            </button>
          </div>
        ) : (
          <MemberCard card={shown.data} editor={editor} />
        )}
      </div>
      <button
        type="button"
        onClick={props.onClose}
        className={buttonClass("primary", "mt-4 w-full")}
      >
        {t["intro.close"]}
      </button>
    </Sheet>
  );
}
