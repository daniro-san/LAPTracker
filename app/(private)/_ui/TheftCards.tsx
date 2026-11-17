"use client";

// The thefts log's list (issue 321): one section per attacker alliance, one card per attacker with this
// week's and all-time counts and the state of the talks with their alliance; a card opens to the members
// it was taken from (by name, D75: only inside an attacker's card), the talks with their history, and each
// entry. Nothing is hover-only; every control is 44 px or more.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { FOLLOW_UP_STATES, type FollowUpState } from "@/lib/private/theft-groups";

import { SIGNED_OUT, SignedOutNote } from "./SignedOut";
import { postTheft, viewerClock } from "./theft-client";
import type { AllianceCard, AttackerCard, EntryCard, TheftWords } from "./theft-data";
import { TimePair, useViewerZone } from "./YourTime";

const STATE_TONE = {
  open: "attention",
  talked: "progress",
  resolved: "neutral",
} as const satisfies Record<FollowUpState, string>;

type Shared = { slug: string; t: TheftWords; language: WorkspaceLanguage };

function StateBadge({ card }: { card: AttackerCard }) {
  return (
    <span className="shrink-0">
      <Tag tone={STATE_TONE[card.state]}>{card.badge}</Tag>
    </span>
  );
}

/** The changes before the newest, small, newest first. */
function Earlier({ card, t }: { card: AttackerCard; t: TheftWords }) {
  if (card.earlier.length === 0) return null;
  return (
    <div className="mt-1 text-body-sm text-ink/75">
      <p className="font-semibold">{t["thefts.earlier"]}</p>
      <ul className="mt-0.5 space-y-0.5">
        {card.earlier.map((c, i) => (
          <li key={i}>
            {c.text}
            {c.note && <span className="block pl-2">{c.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FollowUpForm({ card, slug, t }: Shared & { card: AttackerCard }) {
  const router = useRouter();
  const [state, setState] = useState<FollowUpState>(card.state);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await postTheft(slug, { action: "follow", attacker: card.key, state, note });
    setBusy(false);
    setSaid(r === "ok" ? t["thefts.saved"] : r === SIGNED_OUT ? SIGNED_OUT : t["thefts.e.failed"]);
    if (r === "ok") {
      setNote("");
      router.refresh();
    }
  };
  const id = `follow-${card.key}`;
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 border-t border-rule pt-3">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 font-semibold">{t["thefts.follow"]}</legend>
        {card.reopened && <p className="text-body-sm font-semibold text-yarn">{card.reopened}</p>}
        {card.changed && <p className="text-body-sm text-ink/75">{card.changed}</p>}
        {card.lastNote && (
          <p className="border-l-2 border-rule pl-2 text-body-sm">{card.lastNote}</p>
        )}
        <Earlier card={card} t={t} />
        {FOLLOW_UP_STATES.map((s) => (
          <RadioField
            key={s}
            name={id}
            checked={state === s}
            onChange={() => setState(s)}
            label={t[`thefts.state.${s}`]}
          />
        ))}
      </fieldset>
      <label htmlFor={`${id}-note`} className="mt-2 block text-body-sm font-semibold">
        {t["thefts.note"]}
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        className="drawn-field mt-1 w-full px-3 py-2"
      />
      <div className="mt-2 flex items-center gap-3">
        {/* Nothing to save until the state or the note changes, so the history gets no repeated rows. */}
        <button
          type="submit"
          disabled={busy || (state === card.state && note.trim() === "")}
          className={buttonClass("secondary")}
        >
          {t["thefts.save"]}
        </button>
        {said === SIGNED_OUT ? (
          <SignedOutNote />
        ) : (
          <p role="status" className="text-body-sm">
            {said}
          </p>
        )}
      </div>
    </form>
  );
}

function Entry({ entry, slug, t, language }: Shared & { entry: EntryCard }) {
  const router = useRouter();
  const zone = useViewerZone();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const remove = async () => {
    const r = await postTheft(slug, { action: "remove", id: entry.id });
    setFailed(r === "ok" || r === "not_found" ? null : r);
    if (r === "ok" || r === "not_found") router.refresh();
  };
  return (
    <li className="border-t border-rule py-2">
      <p className="tabular-nums">
        <TimePair
          st={entry.server}
          mine={
            zone && entry.at !== null && entry.day !== null
              ? fill(t["thefts.yours"], { time: viewerClock(entry.at, entry.day, zone, language) })
              : null
          }
        />
      </p>
      <p>
        <bdi translate="no">{entry.victim}</bdi> · {entry.kind}
      </p>
      {/* "Typed by an officer" is the default and says nothing; a photo is a plain word. */}
      {entry.source === "photo" && <p className="mt-1 text-[12px] text-ink/70">{t["src.photo"]}</p>}
      {entry.note && <p className="mt-1 text-body-sm">{entry.note}</p>}
      {asking ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-semibold">{t["thefts.removeAsk"]}</span>
          <button type="button" onClick={() => setAsking(false)} className={buttonClass("primary")}>
            {t["thefts.keep"]}
          </button>
          <button type="button" onClick={() => void remove()} className={buttonClass("secondary")}>
            {t["thefts.removeYes"]}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="mt-1 inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline underline-offset-4"
        >
          {t["thefts.remove"]}
        </button>
      )}
      {failed === SIGNED_OUT ? (
        <SignedOutNote />
      ) : (
        failed && (
          <p role="status" className="text-body-sm">
            {t["thefts.e.failed"]}
          </p>
        )
      )}
    </li>
  );
}

function Attacker({ card, ...shared }: Shared & { card: AttackerCard }) {
  const { t } = shared;
  return (
    <details className="border border-rule bg-paper">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-1 px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-2">
          <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
            {card.name}
          </span>
          <StateBadge card={card} />
        </span>
        <span className="text-body-sm tabular-nums">{card.counts}</span>
        <span className="text-body-sm font-semibold text-plum underline underline-offset-4">
          {t["thefts.details"]} ▾
        </span>
      </summary>
      <div className="border-t border-rule px-3 py-3">
        {card.victims.length > 0 && (
          <p className="text-body-sm">
            <span className="font-semibold">{t["thefts.takenFrom"]} </span>
            {card.victims.map((v, i) => (
              <span key={v.uid} className="whitespace-nowrap">
                {i > 0 && " · "}
                <bdi translate="no">{v.name}</bdi> ({v.count})
              </span>
            ))}
          </p>
        )}
        <FollowUpForm card={card} {...shared} />
        <ol className="mt-3">
          {card.entries.map((e) => (
            <Entry key={e.id} entry={e} {...shared} />
          ))}
        </ol>
      </div>
    </details>
  );
}

export function TheftCards({ alliances, ...shared }: Shared & { alliances: AllianceCard[] }) {
  return (
    <div className="mt-4 space-y-5">
      {alliances.map((a, i) => (
        <section key={a.tag} aria-labelledby={`alliance-${i}`}>
          <h2 id={`alliance-${i}`} translate="no" className="font-subhead text-display-sm">
            {a.tag}
          </h2>
          <p className="text-body-sm tabular-nums text-ink/80">{a.counts}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {a.attackers.map((card) => (
              <li key={card.key}>
                <Attacker card={card} {...shared} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
