"use client";

// Picking an Elixir Scramble team (issue 298, D103): up to 20 players. The team first, then everyone not
// away that day under daytime for them at the window, no time zone recorded, and night, best picks first,
// then the other team's members (not pickable). One tap picks or takes off; "Add the first n suggested"
// fills the free places in that order. The counter and that button stay at the top. What is picked comes
// from the page's rows plus the changes still in flight, so a read again (coming back to the page) shows
// other officers' picks. The order stays as the page opened. A picked member away that day says so.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";
import { TEAM_MAX } from "@/lib/private/roll-call-rules";

import { useFreshOnReturn } from "./CalendarAgenda";
import { sendRoll } from "./roll-call-client";
import type { RollSheetWords, TeamGroup, TeamRowView } from "./roll-call-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

/** The team, then daytime for them, no time zone, night, and the other team's members. */
const GROUPS: TeamGroup[] = ["picked", "day", "noZone", "night", "other"];

const HEADING: Record<TeamGroup, keyof RollSheetWords> = {
  picked: "roll.team.picks",
  day: "roll.team.group.day",
  noZone: "roll.team.group.noZone",
  night: "roll.team.group.night",
  other: "roll.team.group.other",
};

function TeamRow(props: {
  row: TeamRowView;
  picked: boolean;
  full: boolean;
  busy: boolean;
  words: RollSheetWords;
  onToggle: (uid: number, on: boolean) => void;
}) {
  const { row, picked, words } = props;
  const blocked = row.other !== null || (props.full && !picked);
  const line = row.other ?? row.why;
  return (
    <li className="flex items-center gap-2 border-t border-rule py-1">
      <div className="min-w-0 flex-1">
        <p translate="no" className="truncate font-semibold">
          <bdi>{row.name}</bdi>
        </p>
        {/* A picked member away on the team's day needs a look (issue 585). */}
        {row.away && (
          <p>
            <Tag tone="attention">{row.away}</Tag>
          </p>
        )}
        {line && <p className="text-body-sm text-ink/75">{line}</p>}
      </div>
      <button
        type="button"
        aria-pressed={picked}
        disabled={blocked || props.busy}
        onClick={() => props.onToggle(row.uid, !picked)}
        className={`${chip(picked)} shrink-0 justify-center`}
      >
        {picked ? `✓ ${words["roll.team.picked"]}` : words["roll.team.pick"]}
      </button>
    </li>
  );
}

const REFUSED: Record<string, keyof RollSheetWords> = {
  full: "roll.team.isFull",
  other_team: "roll.team.otherTeam",
};

/** The picks: the page's rows, with the changes this page made since it last read them. */
function useTeam(slug: string, occasion: Occasion, rows: TeamRowView[], words: RollSheetWords) {
  const [local, setLocal] = useState({ rows, over: new Map<number, boolean>() });
  const over = local.rows === rows ? local.over : new Map<number, boolean>();
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const picked = (r: TeamRowView) => over.get(r.uid) ?? r.group === "picked";
  const send = async (uids: number[], on: boolean) => {
    setBusy(true);
    setLine(null);
    const { status, json } = await sendRoll<{ added: number[] }>(slug, {
      action: "team",
      occasion,
      uids,
      on,
    });
    setBusy(false);
    if (status === 200) {
      const next = new Map(over);
      for (const uid of on ? (json.added ?? []) : uids) next.set(uid, on);
      setLocal({ rows, over: next });
      if (uids.length > 1) setLine(fill(words["roll.team.added"], { n: json.added?.length ?? 0 }));
      return;
    }
    const key = REFUSED[json.code ?? ""];
    setLine(status === 401 ? SIGNED_OUT : key ? words[key] : words["roll.team.failed"]);
  };
  return { picked, busy, line, send };
}

/** The counter, "Add the first n suggested", what just happened, and the search; sticky at the top. */
function TopBar(props: {
  team: string;
  count: number;
  fillWith: number[];
  s: ReturnType<typeof useTeam>;
  q: string;
  onQ: (q: string) => void;
  words: RollSheetWords;
}) {
  const { words, s } = props;
  return (
    <div className="sticky top-0 z-[5] mt-2 bg-paper py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="font-semibold tabular-nums" aria-live="polite">
          {fill(words["roll.team.counter"], { team: props.team, n: props.count, max: TEAM_MAX })}
        </p>
        {props.count >= TEAM_MAX ? (
          <p className="text-body-sm">{words["roll.team.isFull"]}</p>
        ) : (
          <button
            type="button"
            disabled={props.fillWith.length === 0 || s.busy}
            onClick={() => void s.send(props.fillWith, true)}
            className={buttonClass("secondary")}
          >
            {fill(words["roll.team.fill"], { n: props.fillWith.length })}
          </button>
        )}
      </div>
      {s.line && <RefusalLine text={s.line} className="text-body-sm font-semibold" />}
      <label className="mt-2 block">
        <span className="sr-only">{words["roll.search"]}</span>
        <input
          type="search"
          autoComplete="off"
          placeholder={words["roll.search"]}
          value={props.q}
          onChange={(e) => props.onQ(e.target.value)}
          className={FIELD}
        />
      </label>
    </div>
  );
}

export function TeamPicker(props: {
  slug: string;
  occasion: Occasion;
  team: string;
  rows: TeamRowView[];
  /** "Registration closes Wednesday (ST)" or "Registration closed". */
  registration: string;
  /** "3 members away that day are left out.", or null. */
  away: string | null;
  words: RollSheetWords;
}) {
  const { words } = props;
  useFreshOnReturn();
  const s = useTeam(props.slug, props.occasion, props.rows, words);
  const [q, setQ] = useState("");
  const count = props.rows.filter(s.picked).length;
  const free = props.rows.filter((r) => !s.picked(r) && r.group !== "other");
  const fillWith = free.slice(0, Math.max(0, TEAM_MAX - count)).map((r) => r.uid);
  const needle = fold(q.trim());
  const shown = props.rows.filter((r) => needle === "" || fold(r.name).includes(needle));
  return (
    <>
      <p className="mt-3 text-body-sm font-semibold">{props.registration}</p>
      <p className="text-body-sm text-ink/75">{words["roll.team.how"]}</p>
      {props.away && <p className="text-body-sm text-ink/75">{props.away}</p>}
      <TopBar
        team={props.team}
        count={count}
        fillWith={fillWith}
        s={s}
        q={q}
        onQ={setQ}
        words={words}
      />
      {needle !== "" && shown.length === 0 && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      {GROUPS.map((g) => {
        const rows = shown.filter((r) => r.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g} aria-labelledby={`tg-${g}`}>
            <h2 id={`tg-${g}`} className="mt-3 text-body-sm font-semibold">
              {words[HEADING[g]]}
            </h2>
            {/* ph-no-capture (issue 549): the open groups come in order of the week's quest points. */}
            <ul className={g === "picked" ? undefined : "ph-no-capture"}>
              {rows.map((r) => (
                <TeamRow
                  key={r.uid}
                  row={r}
                  picked={s.picked(r)}
                  full={count >= TEAM_MAX}
                  busy={s.busy}
                  words={words}
                  onToggle={(uid, on) => void s.send([uid], on)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
