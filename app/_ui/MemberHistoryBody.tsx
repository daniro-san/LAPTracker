"use client";

// A member history card's contents (D60): the copy button, then who joined, who left (and where they are
// now), who changed name, and whose kills or might changed. The open card gets its contents with the
// page; a closed one fetches them the first time it is opened (LazyCardBody), so the page carries only
// the cards' heads.
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { fill, type Dictionary } from "@/lib/copy";
import type { HistoryCardBody } from "@/lib/queries";

import { CopyRoster } from "./CopyRoster";
import { useCopy } from "./LocaleProvider";
import { parts, rosterTsv, type HistoryFilter } from "./member-history";
import { Delta } from "./Num";
import { LABEL } from "./StatTable";

const MUTED = "text-ink/70";
const PLAYER =
  "inline-flex min-h-11 min-w-0 items-center break-words font-medium text-plum hover:underline";
/** Members whose figures changed, shown before "Show all". */
const FIRST_CHANGES = 10;

const player = (m: { uid: number; name: string }) => (
  <Link href={`/players/${m.uid}`} className={PLAYER}>
    {m.name}
  </Link>
);

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-rule px-3 py-2">
      <h3 className={LABEL}>{label}</h3>
      <ul className="flex flex-wrap gap-x-4">{children}</ul>
    </div>
  );
}

function Changes({ body, copy }: { body: HistoryCardBody; copy: Dictionary }) {
  const row = (m: HistoryCardBody["changed"][number]) => (
    <li
      key={m.uid}
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 text-sm tabular-nums"
    >
      {player(m)}
      <span className="text-right">
        <Delta delta={m.killsChange} base={null} />
      </span>
      <span className="text-right">
        <Delta delta={m.powerChange} base={null} />
      </span>
    </li>
  );
  const [first, rest] = [body.changed.slice(0, FIRST_CHANGES), body.changed.slice(FIRST_CHANGES)];
  return (
    <div className="border-t border-rule px-3 py-2">
      <p className={`grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 ${LABEL}`}>
        <span>{copy.ledger.member}</span>
        <span className="text-right">{copy.ledger.kills}</span>
        <span className="text-right">{copy.ledger.might}</span>
      </p>
      <ul>{first.map(row)}</ul>
      {rest.length > 0 && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-plum">
            {fill(copy.members.showAll, { n: body.changed.length })}
          </summary>
          <ul>{rest.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

/** Left: `− Name · now in [TAG]`. */
function LeftGroup({ body, copy }: { body: HistoryCardBody; copy: Dictionary }) {
  return (
    <Group label={copy.members.left}>
      {body.left.map((m) => (
        <li key={m.uid} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="text-seal">
            −
          </span>
          {player(m)}
          {m.nowIn && (
            <span className={`text-sm ${MUTED}`}>
              · {fill(copy.history.nowIn, { tag: `[${m.nowIn.tag ?? m.nowIn.unionId}]` })}
            </span>
          )}
        </li>
      ))}
    </Group>
  );
}

/** `first`: the alliance's first stored roster, which has nothing to compare with. */
export function CardBody({
  body,
  filter,
  first,
}: {
  body: HistoryCardBody;
  filter: HistoryFilter | null;
  first: boolean;
}) {
  const copy = useCopy();
  const h = copy.history;
  const show = parts(body, filter);
  const changes = body.joined.length + body.left.length + body.renamed.length + body.changed.length;
  const note = first ? h.first : changes === 0 ? h.noChange : null;
  return (
    <>
      <div className="flex justify-end border-t border-rule px-3 py-2">
        <CopyRoster text={rosterTsv(body.roster, copy)} />
      </div>
      {note && <p className={`border-t border-rule px-3 py-2 text-sm ${MUTED}`}>{note}</p>}
      {show.joined && (
        <Group label={copy.members.joined}>
          {body.joined.map((m) => (
            <li key={m.uid}>
              <span aria-hidden="true" className="text-yarn">
                +{" "}
              </span>
              {player(m)}
            </li>
          ))}
        </Group>
      )}
      {show.left && <LeftGroup body={body} copy={copy} />}
      {show.renamed && (
        <Group label={h.renamed}>
          {body.renamed.map((r) => (
            <li key={r.uid} className="inline-flex items-center gap-1">
              <span className={MUTED}>{r.from}</span>
              <span aria-hidden="true">→</span>
              {player({ uid: r.uid, name: r.to })}
            </li>
          ))}
        </Group>
      )}
      {show.changed && <Changes body={body} copy={copy} />}
    </>
  );
}

type Load = { kind: "waiting" } | { kind: "loaded"; body: HistoryCardBody } | { kind: "failed" };

/** A closed card's contents: fetched once, the first time its `<details>` opens; "Try again" on failure. */
export function LazyCardBody({
  unionId,
  at,
  filter,
  first,
}: {
  unionId: number;
  /** The card's roster time, as an ISO string. */
  at: string;
  filter: HistoryFilter | null;
  first: boolean;
}) {
  const copy = useCopy();
  const ref = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: "waiting" });
  // The first time the card's <details> opens.
  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details) return;
    const onToggle = () => {
      if (details.open) setOpened(true);
    };
    onToggle();
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, []);
  useEffect(() => {
    if (!opened) return;
    let live = true;
    fetch(`/api/alliances/${unionId}/history?at=${encodeURIComponent(at)}`)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryCardBody>) : Promise.reject(new Error())))
      .then(
        (body) => live && setLoad({ kind: "loaded", body }),
        () => live && setLoad({ kind: "failed" }),
      );
    return () => {
      live = false;
    };
  }, [opened, attempt, unionId, at]);
  return (
    <div ref={ref} aria-busy={load.kind === "waiting"}>
      {load.kind === "loaded" && <CardBody body={load.body} filter={filter} first={first} />}
      {load.kind === "waiting" && (
        <p className={`border-t border-rule px-3 py-2 text-sm ${MUTED}`} aria-hidden="true">
          …
        </p>
      )}
      {load.kind === "failed" && (
        <div className="border-t border-rule px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setLoad({ kind: "waiting" });
              setAttempt((n) => n + 1);
            }}
            className="drawn-frame-soft inline-flex min-h-11 items-center px-3 text-sm font-medium text-plum"
          >
            {copy.errors.server.retry}
          </button>
        </div>
      )}
    </div>
  );
}
