"use client";

// The garrison plan's board (D121): "Needs help", "Close" and "No squad data" as cards, each with a
// "Garrison squad" choice of the spare squads still free (with their might), the spare squads and where
// each goes, and the share bar. A change is saved at once with the version the officer started from; a
// newer save by another officer wins and its plan is shown. Nothing is ordered by a score (D75).
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { isolate } from "@/lib/copy";
import type { GarrisonWords } from "@/lib/private/dictionary.garrison";
import { shareText, type GarrisonPair } from "@/lib/private/garrison-plan";
import { fill } from "@/lib/words";

import { CopyButton } from "./CopyButton";
import type { BoardData, BoardMember, BoardSpare } from "./garrison-data";
import { GarrisonPost } from "./GarrisonPost";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type State = "idle" | "saving" | "failed" | "stale" | typeof SIGNED_OUT;

/** The plan as edited here; it follows the server's when that is newer (another officer's save). */
function usePlan(slug: string, data: BoardData) {
  const router = useRouter();
  const [pairs, setPairs] = useState(data.pairs);
  const [rev, setRev] = useState(data.rev);
  const [seen, setSeen] = useState(data.rev);
  const [state, setState] = useState<State>("idle");
  if (data.rev !== seen) {
    setSeen(data.rev);
    setPairs(data.pairs);
    setRev(data.rev);
  }
  async function change(next: GarrisonPair[]) {
    setPairs(next);
    setState("saving");
    const res = await fetch(`/api/w/${slug}/garrison`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        entry: data.entry,
        week: data.week,
        rev,
        pairs: next,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { rev?: number; code?: string } | null;
    if (res?.ok && typeof json?.rev === "number") {
      setRev(json.rev);
      return setState("idle");
    }
    setState(json?.code === "stale" ? "stale" : json?.code === SIGNED_OUT ? SIGNED_OUT : "failed");
    if (json?.code === "stale") router.refresh();
  }
  return { pairs, rev, state, change };
}

const key = (helper: number, squad: number) => `${helper}:${squad}`;

function MemberCard(props: {
  m: BoardMember;
  data: BoardData;
  pairs: GarrisonPair[];
  words: GarrisonWords;
  /** A change is being saved: the next one waits, so it never starts from a stale version. */
  saving: boolean;
  onPick: (value: string) => void;
}) {
  const { m, data, pairs, words } = props;
  const mine = pairs.find((p) => p.member === m.uid);
  const taken = new Set(pairs.filter((p) => p !== mine).map((p) => key(p.helper, p.squad)));
  const free = data.spares.filter((s) => s.helper !== m.uid && !taken.has(key(s.helper, s.squad)));
  const id = `garrison-pick-${m.uid}`;
  return (
    <li className="drawn-card px-4 py-3">
      <p className="font-semibold">
        <bdi>{m.name}</bdi>
      </p>
      {m.top && <p className="text-body-sm tabular-nums">{m.top}</p>}
      {m.why.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-3">
          {m.why.map((w) => (
            <li key={w}>
              <Tag>{w}</Tag>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={id} className="mt-2 block text-body-sm font-semibold">
        {fill(words["garrison.pick"], { name: isolate(m.name) })}
      </label>
      <select
        id={id}
        value={mine ? key(mine.helper, mine.squad) : ""}
        disabled={props.saving}
        onChange={(e) => props.onPick(e.target.value)}
        className={`${FIELD} mt-1`}
      >
        <option value="">{words["garrison.pickNone"]}</option>
        {free.map((s) => (
          <option key={key(s.helper, s.squad)} value={key(s.helper, s.squad)}>
            {fill(words["garrison.option"], {
              helper: isolate(data.names[s.helper] ?? ""),
              n: s.squad,
              might: s.might,
            })}
          </option>
        ))}
      </select>
    </li>
  );
}

function Section(props: {
  head: string;
  hint: string;
  empty: string | null;
  list: BoardMember[];
  card: (m: BoardMember) => ReactNode;
}) {
  if (props.list.length === 0 && props.empty === null) return null;
  return (
    <section className="mt-6">
      <h2 className="font-subhead text-display-sm">{props.head}</h2>
      <p className="text-body-sm text-ink/75">{props.hint}</p>
      {props.list.length === 0 ? (
        <p className="mt-2 border-t border-rule py-3 text-body-sm">{props.empty}</p>
      ) : (
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">{props.list.map(props.card)}</ul>
      )}
    </section>
  );
}

function Spares(props: { data: BoardData; pairs: GarrisonPair[]; words: GarrisonWords }) {
  const { data, pairs, words } = props;
  const to = (s: BoardSpare) => pairs.find((p) => p.helper === s.helper && p.squad === s.squad);
  return (
    <section className="mt-6">
      <h2 className="font-subhead text-display-sm">
        {fill(words["garrison.spares.head"], { n: data.spares.length })}
      </h2>
      <p className="text-body-sm text-ink/75">{words["garrison.spares.hint"]}</p>
      {data.spares.length === 0 ? (
        <p className="mt-2 border-t border-rule py-3 text-body-sm">
          {words["garrison.spares.none"]}
        </p>
      ) : (
        <ul className="mt-2">
          {data.spares.map((s) => {
            const pair = to(s);
            return (
              <li key={key(s.helper, s.squad)} className="border-t border-rule py-2 tabular-nums">
                {fill(words["garrison.spare"], {
                  helper: isolate(data.names[s.helper] ?? ""),
                  n: s.squad,
                  might: s.might,
                })}
                <span className="block text-body-sm text-ink/75">
                  {pair
                    ? fill(words["garrison.spare.to"], {
                        member: isolate(data.names[pair.member] ?? ""),
                      })
                    : words["garrison.spare.free"]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const STATE_LINE: Record<State, keyof GarrisonWords> = {
  idle: "garrison.state.saved",
  saving: "garrison.state.saving",
  failed: "garrison.failed",
  stale: "garrison.stale",
  [SIGNED_OUT]: "garrison.failed",
};

type Plan = ReturnType<typeof usePlan>;

/** Whether the plan is saved, "Copy for the game" and "Post to Discord", at the top of the plan. */
function ShareBar(props: {
  slug: string;
  data: BoardData;
  words: GarrisonWords;
  posted: string | null;
  channels: Record<"members" | "leaders", string | null>;
  plan: Plan;
}) {
  const { data, words, plan } = props;
  const might = new Map(data.spares.map((s) => [key(s.helper, s.squad), s.might]));
  const text = shareText(
    data.share,
    plan.pairs,
    (uid) => data.names[uid] ?? "",
    (h, s) => might.get(key(h, s)) ?? "",
  );
  const line =
    plan.rev === 0 && plan.state === "idle" ? "garrison.state.suggested" : STATE_LINE[plan.state];
  return (
    <div className="mt-4 border-b border-rule py-3">
      {plan.state === SIGNED_OUT ? (
        <RefusalLine text={SIGNED_OUT} className="text-body-sm" />
      ) : (
        <p role="status" className="text-body-sm">
          {words[line]}
        </p>
      )}
      <p className="mt-2">
        <CopyButton
          text={text}
          labels={{
            copy: words["garrison.copy"],
            copied: words["garrison.copied"],
            failed: words["garrison.copyFailed"],
          }}
        />
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <GarrisonPost
          slug={props.slug}
          entry={data.entry}
          week={data.week}
          words={words}
          busy={plan.state === "saving" || plan.state === "failed"}
          blocked={data.carried ? words["garrison.post.saveEnemy"] : null}
          posted={props.posted}
          channels={props.channels}
        />
      </div>
    </div>
  );
}

const NEEDS = ["help", "close", "unknown"] as const;

/** "Start again from the suggestion": saves the suggestion, then reads the page again (D121). */
function Reset({ plan, data, words }: { plan: Plan; data: BoardData; words: GarrisonWords }) {
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={plan.state === "saving"}
      onClick={() => void plan.change(data.suggested).then(() => router.refresh())}
      className={buttonClass("secondary")}
    >
      {words["garrison.reset"]}
    </button>
  );
}

export function GarrisonBoard(props: {
  slug: string;
  data: BoardData;
  words: GarrisonWords;
  posted: string | null;
  channels: Record<"members" | "leaders", string | null>;
}) {
  const { data, words } = props;
  const plan = usePlan(props.slug, data);
  const pick = (member: number) => (value: string) => {
    const rest = plan.pairs.filter((p) => p.member !== member);
    if (value === "") return void plan.change(rest);
    const [helper, squad] = value.split(":").map(Number) as [number, number];
    void plan.change([...rest, { helper, squad, member }]);
  };
  const card = (m: BoardMember) => (
    <MemberCard
      key={m.uid}
      m={m}
      data={data}
      pairs={plan.pairs}
      words={words}
      saving={plan.state === "saving"}
      onPick={pick(m.uid)}
    />
  );
  return (
    <>
      <ShareBar {...props} plan={plan} />
      {data.madeFor && (
        <div role="status" className="mt-3 border-l-4 border-yarn pl-3">
          <p className="font-semibold">{fill(words["garrison.madeFor"], { old: data.madeFor })}</p>
          <p className="mt-2">
            <Reset plan={plan} data={data} words={words} />
          </p>
        </div>
      )}
      <p className="mt-3 text-body-sm">{words["garrison.order"]}</p>
      {NEEDS.map((need) => {
        const list = data.members.filter((m) => m.need === need);
        return (
          <Section
            key={need}
            head={fill(words[`garrison.${need}.head`], { n: list.length })}
            hint={words[`garrison.${need}.hint`]}
            empty={need === "help" ? words["garrison.help.none"] : null}
            list={list}
            card={card}
          />
        );
      })}
      <Spares data={data} pairs={plan.pairs} words={words} />
      <p className="mt-6">
        <Reset plan={plan} data={data} words={words} />
      </p>
    </>
  );
}
