"use client";

// A draft under review (issue 299), shared by every officer of the workspace: the type the pictures were
// read as (one tap to change it), Daily or Weekly, the Alliance Duel's day and week, where it saves, and
// the rows, uncertain and unmatched ones first. While something is missing, a line above Save says what
// ("Row #2 needs a member", a link to that card). Save sends one value per member (per member and fact
// for a member update); the first save wins, and a later one is told who saved it. A member fact another officer saved meanwhile comes back
// marked, with "Keep theirs" and "Use mine" (D80). A Secret Ops report has its own review, and a check
// (Donation, Might, Kills) is read-only: only how many rows match is kept (panel PD-5). Nothing counts
// before Save (D75). Numbers and dates come formatted from the server.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import type { ImportKind, PhotoFact, Scope } from "@/lib/private/import-kinds";
import type { DraftView } from "@/lib/private/import-view";

import { Actions, confirmRetype, Message, useDraftActions, type Why } from "./draft-actions";
import {
  checkKnown,
  checkSummary,
  DAYS,
  duelKnown,
  factKnown,
  fillIn,
  type Day,
  type Words,
} from "./draft-known";
import { DraftHeader, type ReviewText } from "./DraftHeader";
import { DraftRowCard, type RowState } from "./DraftRowCard";
import { SecretOpsReview } from "./SecretOpsReview";

const factOf = (view: DraftView, uid: number | null, field: PhotoFact | undefined) =>
  uid === null || !field ? undefined : view.facts?.[uid]?.[field];

function initialRows(view: DraftView): RowState[] {
  return view.rows.map((r) => {
    const uid = r.match.status === "sure" ? r.match.uid : null;
    // AD Tech at 100 % is complete: such a row starts dropped (owner, issue 299).
    const complete = r.field === "adTech" && factOf(view, uid, r.field)?.value === 100;
    return { uid, value: r.value === null ? "" : String(r.value), dropped: complete };
  });
}

/** The newer values a stale member update came back with, put on their rows. */
function withConflicts(view: DraftView, rows: RowState[], detail: unknown): RowState[] {
  const newer = Array.isArray(detail)
    ? (detail as { uid: number; field: string; value: number | null; version: number }[])
    : [];
  return rows.map((r, i) => {
    const hit = newer.find((n) => n.uid === r.uid && n.field === view.rows[i]?.field);
    return hit && !r.dropped ? { ...r, conflict: { value: hit.value, version: hit.version } } : r;
  });
}

/** Rows not found first, then the uncertain ones, then the rest, each in reading order. */
const ORDER = { none: 0, doubtful: 1, sure: 2 };
const displayOrder = (view: DraftView) =>
  view.rows
    .map((_, i) => i)
    .sort((a, b) => {
      const [ra, rb] = [view.rows[a], view.rows[b]];
      return ORDER[ra?.match.status ?? "sure"] - ORDER[rb?.match.status ?? "sure"] || a - b;
    });

const labelOf = (view: DraftView, i: number) => `#${view.rows[i]?.rank ?? i + 1}`;

/** Why Save is off: the first thing missing, in the order the officer sees it; null when it can save. */
function whyNot(
  view: DraftView,
  rows: RowState[],
  order: number[],
  scope: Scope | null,
): Why | null {
  if (view.scope !== null && scope === null) return { template: "shots.why.tab" };
  for (const i of order) {
    const r = rows[i];
    if (!r || r.dropped) continue;
    const key =
      r.uid === null ? "member" : r.value === "" ? "value" : r.conflict ? "conflict" : null;
    if (key)
      return { template: `shots.why.${key}`, row: { label: labelOf(view, i), href: `#row-${i}` } };
  }
  return null;
}

type Props = {
  slug: string;
  view: DraftView;
  w: Words;
  kinds: Record<ImportKind, string>;
  saveKinds: ImportKind[];
  text: ReviewText;
  sep: string;
};

export function DraftReview(props: Props) {
  if (props.view.kind === "secret_ops") return <SecretOpsReview {...props} />;
  // A check (`ours` is set: donation, might, kills) keeps only how many match, so it has nothing to fix.
  if (props.view.ours !== null) return <CheckReview {...props} />;
  return <RowsReview {...props} />;
}

/**
 * A check (panel PD-5): read-only. It shows how many rows match the game data, what Save keeps, and one
 * Save; no row is edited, because only the counts are kept.
 */
function CheckReview(props: Props) {
  const { view, w } = props;
  const router = useRouter();
  const [scope, setScope] = useState<Scope | null>(view.scopeSure ? view.scope : null);
  const { busy, message, act } = useDraftActions(props.slug, view, w);
  const readOnly = view.status !== "open" || !view.canSave;
  const sum = checkSummary(view);
  const needsTab = view.scope !== null && scope === null;
  async function save() {
    const answer = await act({
      action: "save",
      scope,
      day: null,
      weekBefore: false,
      rows: sum.sent,
    });
    if (answer.ok) {
      track("ws_draft_saved", { kind: view.kind });
      router.refresh();
    }
  }
  return (
    <>
      <DraftHeader
        {...props}
        choice={{ scope, day: "sat", weekBefore: false }}
        set={{ scope: setScope, day: () => {}, weekBefore: () => {} }}
        readOnly={readOnly}
        retype={(kind) =>
          void act({ action: "retype", kind, scope }).then((a) => a.ok && router.refresh())
        }
      />
      <section aria-labelledby="check-head" className="mt-4 border border-rule px-4 py-3">
        <h2 id="check-head" className="font-subhead text-display-sm">
          {w["shots.check.head"]}
        </h2>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {fillIn(w["shots.check.match"], { same: sum.same, compared: sum.compared })}
        </p>
        {sum.left > 0 && (
          <p className="mt-1 text-body-sm text-ink/80">
            {fillIn(w["shots.check.left"], { n: sum.left })}
          </p>
        )}
      </section>
      <Message text={message} />
      {!readOnly && (
        <div className="mt-4">
          {needsTab && (
            <p className="mb-2 border-l-4 border-yarn pl-2 text-body-sm">{w["shots.why.tab"]}</p>
          )}
          <button
            type="button"
            disabled={busy || needsTab}
            onClick={() => void save()}
            className="ink-button inline-flex min-h-11 items-center justify-center px-6 font-medium disabled:opacity-50"
          >
            {busy ? w["shots.saving"] : w["shots.check.save"]}
          </button>
        </div>
      )}
    </>
  );
}

function RowsReview(props: Props) {
  const { view, w, text, sep } = props;
  const router = useRouter();
  // A guessed tab is not pressed: the officer confirms it (issue 299).
  const [scope, setScope] = useState<Scope | null>(view.scopeSure ? view.scope : null);
  const [day, setDay] = useState<Day>(DAYS[text.pictureDay] ?? "sat");
  const [weekBefore, setWeekBefore] = useState(false);
  const [rows, setRows] = useState(initialRows(view));
  const { busy, message, act } = useDraftActions(props.slug, view, w);
  const readOnly = view.status !== "open" || !view.canSave;
  const [order] = useState(() => displayOrder(view));
  const why = whyNot(view, rows, order, scope);
  const touched = JSON.stringify(rows) !== JSON.stringify(initialRows(view));

  async function save() {
    const sent = rows.flatMap((r, i) => {
      const field = view.rows[i]?.field;
      if (r.dropped || r.uid === null) return [];
      const version = r.version ?? factOf(view, r.uid, field)?.version ?? 0;
      return [{ uid: r.uid, value: Number(r.value), ...(field && { field, version }) }];
    });
    const daily = scope === "daily" ? day : null;
    const answer = await act({ action: "save", scope, day: daily, weekBefore, rows: sent });
    if (answer.ok) {
      track("ws_draft_saved", { kind: view.kind });
      router.refresh();
    } else if (answer.data.code === "conflict")
      setRows(withConflicts(view, rows, answer.data.detail));
  }
  const known = (i: number) => (uid: number | null, value: number | null) => {
    if (uid === null) return [];
    const field = view.rows[i]?.field;
    if (field) return factKnown(field, factOf(view, uid, field)?.value, value, w, sep);
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
          confirmRetype(touched, w) &&
          void act({ action: "retype", kind, scope }).then((a) => a.ok && router.refresh())
        }
      />
      <ul className="mt-4 space-y-2">
        {order.map((i) => (
          <DraftRowCard
            key={i}
            label={labelOf(view, i)}
            anchor={`row-${i}`}
            row={view.rows[i] as DraftView["rows"][number]}
            state={rows[i] as RowState}
            onChange={(next) => setRows(rows.map((r, j) => (j === i ? next : r)))}
            members={view.members}
            w={w}
            sep={sep}
            known={known(i)}
            readOnly={readOnly}
          />
        ))}
      </ul>
      <Message text={message} />
      {!readOnly && (
        <Actions
          w={w}
          busy={busy}
          why={why && { ...why, template: w[why.template ?? ""] }}
          onSave={() => void save()}
          onDiscard={() => void act({ action: "discard" }).then((a) => a.ok && router.refresh())}
        />
      )}
    </>
  );
}
