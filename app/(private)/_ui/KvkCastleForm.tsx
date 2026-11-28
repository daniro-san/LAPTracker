"use client";

// Insights → KvK's map (issue 791): the optional castle point officers type in, two whole numbers on the
// game map's grid, saved for the workspace; "Remove point" clears it. A save refreshes the page, so the map
// and its near/mid/far rows come from the stored point. A refusal or no answer says so and keeps what was
// typed. The point is not sent anywhere else: no analytics event carries it.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

const whole = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null);

export function KvkCastleForm(props: {
  slug: string;
  castle: { x: number; y: number } | null;
  t: WorkspaceDictionary;
}) {
  const { slug, castle, t } = props;
  const router = useRouter();
  const [east, setEast] = useState(castle ? String(castle.x) : "");
  const [north, setNorth] = useState(castle ? String(castle.y) : "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const send = async (point: { castleX: number | null; castleY: number | null }) => {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/w/${slug}/kvk-castle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(point),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setNote(t["insights.map.castle.saved"]);
      if (point.castleX === null) [setEast, setNorth].forEach((set) => set(""));
      return router.refresh();
    }
    setNote(res?.status === 401 ? SIGNED_OUT : t["insights.map.castle.failed"]);
  };
  const save = () => {
    const [castleX, castleY] = [whole(east), whole(north)];
    if (castleX === null || castleY === null) return setNote(t["insights.map.castle.failed"]);
    void send({ castleX, castleY });
  };
  return (
    <form
      className="mt-3 border-t border-rule pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="font-semibold">{t["insights.map.castle.head"]}</p>
      <p className="text-body-sm text-ink/80">{t["insights.map.castle.help"]}</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {(
          [
            ["insights.map.castle.x", east, setEast],
            ["insights.map.castle.y", north, setNorth],
          ] as const
        ).map(([key, value, set]) => (
          <label key={key} className="grid gap-1">
            <span className="font-medium">{t[key]}</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`${FIELD} w-24 text-[16px] tabular-nums`}
            />
          </label>
        ))}
        <Button type="submit" disabled={busy}>
          {t["insights.map.castle.save"]}
        </Button>
        {castle && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void send({ castleX: null, castleY: null })}
          >
            {t["insights.map.castle.clear"]}
          </Button>
        )}
      </div>
      <div role="status">{note && <RefusalLine text={note} className="mt-1 text-body-sm" />}</div>
    </form>
  );
}
