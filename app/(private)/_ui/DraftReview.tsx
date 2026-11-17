"use client";

// A draft under review (issue 299), shared by every officer of the workspace: the type the pictures were
// read as (one tap to change it), Daily or Weekly, the Alliance Duel's day and week, where it saves, and
// the rows. Save sends one value per member; the first save wins, and a later one is told who saved it.
// Nothing counts before Save (D75). Numbers and dates come formatted from the server.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import type { ImportKind, Scope } from "@/lib/private/import-kinds";
import type { DraftView } from "@/lib/private/import-view";

import { checkKnown, DAYS, duelKnown, fillIn, type Day, type Words } from "./draft-known";
import { DraftHeader, type ReviewText } from "./DraftHeader";
import { DraftRowCard, type RowState } from "./DraftRowCard";

export type { ReviewText };

function initialRows(view: DraftView): RowState[] {
  return view.rows.map((r) => ({
    uid: r.match.status === "sure" ? r.match.uid : null,
    value: r.value === null ? "" : String(r.value),
    dropped: false,
  }));
}

/** Posts a decision on the draft at the version the officer opened; says why when it is refused. */
function useDraftActions(slug: string, view: DraftView, w: Words) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function act(body: object): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/w/${slug}/import/${view.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: view.version, ...body }),
      });
      if (res.ok) return true;
      const { code, by } = (await res.json().catch(() => ({}))) as { code?: string; by?: string };
      const template = w[`import.e.${code}`] ?? w["import.e.failed"];
      setMessage(fillIn(template, { name: by ?? w["import.someone"] ?? "" }));
      return false;
    } catch {
      setMessage(w["import.e.failed"] ?? "");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, act };
}

export function DraftReview(props: {
  slug: string;
  view: DraftView;
  w: Words;
  kinds: Record<ImportKind, string>;
  saveKinds: ImportKind[];
  text: ReviewText;
  sep: string;
}) {
  const { view, w, text, sep } = props;
  const router = useRouter();
  const [scope, setScope] = useState<Scope | null>(view.scope);
  const [day, setDay] = useState<Day>(DAYS[text.pictureDay] ?? "sat");
  const [weekBefore, setWeekBefore] = useState(false);
  const [rows, setRows] = useState(initialRows(view));
  const { busy, message, act } = useDraftActions(props.slug, view, w);
  const readOnly = view.status !== "open" || !view.canSave;
  const kept = rows.filter((r) => !r.dropped);
  const ready = kept.every((r) => r.uid !== null && r.value !== "");

  async function save() {
    const sent = kept.map((r) => ({ uid: r.uid as number, value: Number(r.value) }));
    const daily = scope === "daily" ? day : null;
    if (await act({ action: "save", scope, day: daily, weekBefore, rows: sent })) {
      track("ws_draft_saved", { kind: view.kind });
      router.refresh();
    }
  }
  const known = (uid: number | null, value: number | null): string[] => {
    if (uid === null) return [];
    if (!view.duel) return checkKnown(view.ours?.[uid] ?? null, value, w, sep);
    const saved = (weekBefore ? view.duel.weekBefore : view.duel.thisWeek)[uid] ?? {};
    return duelKnown(saved, scope === "daily" ? day : "week", value, w, sep);
  };

  return (
    <>
      <DraftHeader
        {...props}
        choice={{ scope, day, weekBefore }}
        set={{ scope: setScope, day: setDay, weekBefore: setWeekBefore }}
        readOnly={readOnly}
        retype={(kind) =>
          void act({ action: "retype", kind, scope }).then((ok) => ok && router.refresh())
        }
      />
      <ul className="mt-4 space-y-2">
        {view.rows.map((row, i) => (
          <DraftRowCard
            key={`${i}-${row.rank}-${row.name}`}
            row={row}
            state={rows[i] as RowState}
            onChange={(next) => setRows(rows.map((r, j) => (j === i ? next : r)))}
            members={view.members}
            w={w}
            known={known}
            readOnly={readOnly}
          />
        ))}
      </ul>
      <div aria-live="polite" className="mt-3">
        {message && <p className="border-l-4 border-seal pl-3">{message}</p>}
      </div>
      {!readOnly && (
        <Actions
          w={w}
          busy={busy}
          ready={ready}
          onSave={() => void save()}
          onDiscard={() => void act({ action: "discard" }).then((ok) => ok && router.refresh())}
        />
      )}
    </>
  );
}

function Actions(props: {
  w: Words;
  busy: boolean;
  ready: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { w, busy } = props;
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy || !props.ready}
        onClick={props.onSave}
        className="ink-button inline-flex min-h-11 items-center justify-center px-6 font-medium disabled:opacity-50"
      >
        {busy ? w["import.saving"] : w["import.save"]}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={props.onDiscard}
        className="inline-flex min-h-11 items-center px-4 font-medium underline underline-offset-4"
      >
        {w["import.discard"]}
      </button>
    </div>
  );
}
