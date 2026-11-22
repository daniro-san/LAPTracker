"use client";

// The thefts log's list (issue 321): one section per attacker alliance (with whom to contact when it is a
// tracked alliance of our server), one card per attacker with this week's and all-time counts, their
// server and the step we are at; a card opens to the members it was taken from (by name, D75: only inside
// an attacker's card), the steps with their history, the attacker's server, the warning to paste for a
// player of our server, and each entry. Nothing is hover-only; every control is 44 px or more.
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { RadioField } from "@/lib/brand/components/RadioField";
import { Tag } from "@/lib/brand/components/Tag";
import type { WorkspaceLanguage } from "@/lib/private/dictionary";
import { FOLLOW_UP_STATES, type FollowUpState } from "@/lib/private/theft-groups";
import { fill } from "@/lib/words";

import { DeleteButton } from "./DeleteRecord";
import { newRequestId } from "./request-id";
import { SIGNED_OUT, SignedOutNote } from "./SignedOut";
import { postTheft, viewerClock } from "./theft-client";
import type { AllianceCard, AttackerCard, EntryCard, TheftWords } from "./theft-data";
import { ServerForm, Warning } from "./TheftAttackerTools";
import { TimePair, useViewerZone } from "./YourTime";

const STATE_TONE = {
  open: "attention",
  warned: "progress",
  talked: "progress",
  retaliated: "progress",
  resolved: "neutral",
} as const satisfies Record<FollowUpState, string>;

type Shared = {
  slug: string;
  t: TheftWords;
  language: WorkspaceLanguage;
  /** Our server's number, for the server field's hint. */
  server: number;
  /** After this officer's delete (D123): the page offers Undo, in the attacker's card (`key`). */
  onDeleted: (id: number, requestId: string, key: string) => void;
  /** "Theft deleted." with Undo, drawn in the card of the attacker `key`. */
  undo: { key: string; line: ReactNode } | null;
};

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
  // D100: one request id per step until it is stored, so a retry after a lost answer adds nothing.
  const [requestId, setRequestId] = useState(newRequestId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = { action: "follow", attacker: card.key, state, note, requestId };
    const r = await postTheft(slug, { ...body, expected: card.lastId });
    setBusy(false);
    const words = {
      ok: t["thefts.saved"],
      conflict: t["thefts.e.conflict"],
      [SIGNED_OUT]: SIGNED_OUT,
    };
    setSaid(words[r as keyof typeof words] ?? t["thefts.e.failed"]);
    // Stored, or another officer's step came first (the page now shows theirs): the next save is a new step.
    if (r === "ok" || r === "conflict") {
      if (r === "ok") setNote("");
      setRequestId(newRequestId());
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

function Entry(props: Shared & { entry: EntryCard; attacker: string }) {
  const { entry, slug, t, language, onDeleted } = props;
  const router = useRouter();
  const zone = useViewerZone();
  const when = (
    <TimePair
      st={entry.server}
      mine={
        zone && entry.at !== null && entry.day !== null
          ? fill(t["thefts.yours"], { time: viewerClock(entry.at, entry.day, zone, language) })
          : null
      }
    />
  );
  const what = (
    <>
      <bdi translate="no">{entry.victim}</bdi> · {entry.kind}
    </>
  );
  return (
    <li className="border-t border-rule py-2">
      <p className="tabular-nums">{when}</p>
      <p>{what}</p>
      {/* "Typed by an officer" is the default and says nothing; a photo is a plain word. */}
      {entry.source === "photo" && <p className="mt-1 text-[12px] text-ink/70">{t["src.photo"]}</p>}
      {entry.items && <p className="mt-1 text-body-sm">{entry.items}</p>}
      {entry.note && <p className="mt-1 text-body-sm">{entry.note}</p>}
      <div className="mt-1">
        <DeleteButton
          id={`theft-delete-ask-${entry.id}`}
          words={{
            label: t["thefts.remove"],
            ask: t["thefts.removeAsk"],
            confirm: t["thefts.removeYes"],
            deleting: t["thefts.removing"],
            keep: t["thefts.keep"],
            failed: t["thefts.e.failed"],
          }}
          send={(requestId) => postTheft(slug, { action: "remove", id: entry.id, requestId })}
          // Someone else's delete first: it is gone either way, with nothing of this officer's to undo.
          onDeleted={(requestId) => {
            if (requestId) onDeleted(entry.id, requestId, props.attacker);
            router.refresh();
          }}
        >
          <p className="mt-3 tabular-nums">{when}</p>
          <p className="font-semibold">{what}</p>
          <p className="mt-2">{t["thefts.removeWhere"]}</p>
        </DeleteButton>
      </div>
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
        {card.server.same ? (
          <span>
            <Tag tone="attention">{card.server.text}</Tag>
          </span>
        ) : (
          <span className="text-body-sm text-ink/75">{card.server.text}</span>
        )}
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
        {card.warnings && (
          <Warning warnings={card.warnings} t={t} language={shared.language} id={card.key} />
        )}
        <ServerForm card={card} slug={shared.slug} t={t} server={shared.server} />
        <ol className="mt-3">
          {card.entries.map((e) => (
            <Entry key={e.id} entry={e} attacker={card.key} {...shared} />
          ))}
        </ol>
        {/* The officer keeps their place: the Undo line is where the theft was (review, 2026-11-19). */}
        {shared.undo?.key === card.key && shared.undo.line}
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
          {a.contact && (
            <p className="text-body-sm">
              {a.contact.line}{" "}
              <a
                href={a.contact.href}
                className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
              >
                {a.contact.link}
              </a>
            </p>
          )}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {a.attackers.map((card) => (
              // The Follow-up tab links each open attacker here (issue 340).
              <li key={card.key} id={`attacker-${card.key}`} className="scroll-mt-4">
                <Attacker card={card} {...shared} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
