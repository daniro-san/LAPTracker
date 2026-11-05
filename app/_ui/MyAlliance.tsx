"use client";

// "This is my alliance" (DESIGN.md "Language-light rules"): a per-viewer choice kept in localStorage for
// this browser only, never server state. The alliance page sets it; the main page highlights that row
// and offers a jump to it. Storage can be missing or throw (private mode): then nothing is shown and the
// page is still correct.
import { useEffect, useState } from "react";

import { CheckField } from "@/lib/brand/components/CheckField";
import { copy } from "@/lib/copy";

import { rowAnchor } from "./format";

const KEY = "lap.myAlliance";

function readMine(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeMine(unionId: number | null) {
  try {
    if (unionId === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(unionId));
  } catch {
    // Storage blocked: the choice simply is not remembered.
  }
}

/** On the alliance page, beside "Exact numbers": a checkbox that marks this alliance as the viewer's. */
export function MyAllianceToggle({ unionId }: { unionId: number }) {
  const [mine, setMine] = useState(false);
  useEffect(() => setMine(readMine() === unionId), [unionId]);
  return (
    <CheckField
      variant="chip"
      label={copy.ledger.myAlliance}
      checked={mine}
      onChange={(e) => {
        writeMine(e.target.checked ? unionId : null);
        setMine(e.target.checked);
      }}
    />
  );
}

/** On the main page: highlights the viewer's row and links to it; renders nothing when none is set. */
export function MyAllianceJump({ tags }: { tags: Record<number, string> }) {
  const [mine, setMine] = useState<number | null>(null);
  useEffect(() => {
    const id = readMine();
    const row = id === null ? null : document.getElementById(rowAnchor(id));
    if (id === null || !row || !(id in tags)) return;
    row.dataset.mine = "";
    setMine(id);
    return () => {
      delete row.dataset.mine;
    };
  }, [tags]);
  if (mine === null) return null;
  return (
    <a
      href={`#${rowAnchor(mine)}`}
      className="drawn-frame-soft mb-3 inline-flex min-h-11 items-center gap-2 bg-yarn/15 px-3 text-body-sm font-medium text-plum"
    >
      <span aria-hidden="true">↓</span>
      {copy.ledger.myAlliance}
      <span className="font-semibold text-ink">[{tags[mine]}]</span>
    </a>
  );
}
