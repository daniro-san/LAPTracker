"use client";

// Picking an Elixir Scramble team (issue 298): up to 20 players, its members first, then everyone not away
// that day in the suggested order (daytime for them at the window, active this week, main squad might),
// each with why. One tap picks or takes off; "Add the first n suggested" fills the free places in that
// order. A member on the other team that week cannot be picked. The order stays as the page opened.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";
import { TEAM_MAX } from "@/lib/private/roll-call-rules";

import { useFreshOnReturn } from "./CalendarAgenda";
import { sendRoll } from "./roll-call-client";
import type { RollSheetWords, TeamRowView } from "./roll-call-data";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

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
  return (
    <li className="flex items-center gap-2 border-t border-rule py-1">
      <div className="min-w-0 flex-1">
        <p translate="no" className="truncate font-semibold">
          <bdi>{row.name}</bdi>
        </p>
        <p className="text-body-sm text-ink/75">{row.other ?? row.why}</p>
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
  full: "roll.team.full",
  other_team: "roll.team.otherTeam",
};

function useTeam(slug: string, occasion: Occasion, rows: TeamRowView[], words: RollSheetWords) {
  const router = useRouter();
  const [picked, setPicked] = useState(
    () => new Set(rows.filter((r) => r.picked).map((r) => r.uid)),
  );
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
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
      setPicked((p) => {
        const next = new Set(p);
        for (const uid of on ? (json.added ?? []) : uids) {
          if (on) next.add(uid);
          else next.delete(uid);
        }
        return next;
      });
      if (uids.length > 1) setLine(fill(words["roll.team.added"], { n: json.added?.length ?? 0 }));
      return;
    }
    const key = REFUSED[json.code ?? ""];
    setLine(status === 401 ? SIGNED_OUT : key ? words[key] : words["roll.team.failed"]);
    router.refresh();
  };
  return { picked, busy, line, send };
}

export function TeamPicker(props: {
  slug: string;
  occasion: Occasion;
  team: string;
  rows: TeamRowView[];
  /** "Suggested first: …" with the window's time. */
  how: string;
  /** "3 members away that day are left out.", or null. */
  away: string | null;
  words: RollSheetWords;
}) {
  const { words } = props;
  useFreshOnReturn();
  const s = useTeam(props.slug, props.occasion, props.rows, words);
  const [q, setQ] = useState("");
  const full = s.picked.size >= TEAM_MAX;
  const free = props.rows.filter((r) => !s.picked.has(r.uid) && r.other === null);
  const fillWith = free.slice(0, Math.max(0, TEAM_MAX - s.picked.size)).map((r) => r.uid);
  const needle = fold(q.trim());
  const shown = props.rows.filter((r) => needle === "" || fold(r.name).includes(needle));
  return (
    <>
      <p className="mt-3 text-body-sm text-ink/75">{props.how}</p>
      {props.away && <p className="text-body-sm text-ink/75">{props.away}</p>}
      <div className="sticky top-0 z-[5] mt-2 bg-paper py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="font-semibold tabular-nums" aria-live="polite">
            {fill(words["roll.team.counter"], {
              team: props.team,
              n: s.picked.size,
              max: TEAM_MAX,
            })}
          </p>
          <button
            type="button"
            disabled={fillWith.length === 0 || s.busy}
            onClick={() => void s.send(fillWith, true)}
            className={buttonClass("secondary")}
          >
            {fill(words["roll.team.fill"], { n: fillWith.length })}
          </button>
        </div>
        {full && (
          <p className="text-body-sm">
            {fill(words["roll.team.full"], { team: props.team, max: TEAM_MAX })}
          </p>
        )}
        {s.line && <RefusalLine text={s.line} className="text-body-sm font-semibold" />}
        <label className="mt-2 block">
          <span className="sr-only">{words["roll.search"]}</span>
          <input
            type="search"
            autoComplete="off"
            placeholder={words["roll.search"]}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={FIELD}
          />
        </label>
      </div>
      {needle !== "" && shown.length === 0 && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      <ul>
        {shown.map((r) => (
          <TeamRow
            key={r.uid}
            row={r}
            picked={s.picked.has(r.uid)}
            full={full}
            busy={s.busy}
            words={words}
            onToggle={(uid, on) => void s.send([uid], on)}
          />
        ))}
      </ul>
    </>
  );
}
