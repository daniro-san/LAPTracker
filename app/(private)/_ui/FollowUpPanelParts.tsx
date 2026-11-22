"use client";

// The parts of a member's Follow-up panel (issue 460, D140) that show what the card and the row hold: the
// card read when the panel opens, "Fill in what they told you" and the last notes. The ready message with
// its two copies is `Message` (FollowUpMessage.tsx, shared with the member card). Nothing here sends
// anything.
import { useEffect, useState } from "react";

import { chip } from "@/lib/brand/components/controls";
import type { FactField } from "@/lib/private/fact-fields";

import { panelCard, type CardRead } from "./follow-up-card";
import type { FollowUpWords } from "./follow-up-words";
import { HEAD, SECTION } from "./FollowUpMessage";
import type { FollowUpRow } from "./FollowUpSheet";
import { readCard } from "./MemberSheet";
import { SignedOutNote } from "./SignedOut";

/**
 * The member's card (origin lines, stored facts, last notes), read when the panel opens and again by
 * `reload` (after a facts save, or Try again), so the editor always starts from the newest versions.
 */
export function useCard(slug: string, uid: number) {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<CardRead>(null);
  useEffect(() => {
    let live = true;
    void readCard(slug, uid).then((answer) => {
      if (live) setRead({ uid, attempt, answer });
    });
    return () => {
      live = false;
    };
  }, [slug, uid, attempt]);
  return { ...panelCard(read, uid, attempt), reload: () => setAttempt((n) => n + 1) };
}

export type HeldCard = ReturnType<typeof useCard>;

/** Why the card's parts are not there: still reading, a failed read with Try again, or signed out. */
export function CardStatus({ card, words }: { card: HeldCard; words: FollowUpWords }) {
  if (card.status === "ok") return null;
  if (card.status === "signed_out") return <SignedOutNote className="mt-1" />;
  if (card.status === "loading") {
    return (
      <p role="status" className="mt-1 text-body-sm text-ink/70">
        {words["followup.loading"]}
      </p>
    );
  }
  return (
    <div className="mt-1">
      <p role="alert" className="text-body-sm">
        {words["followup.cardFailed"]}
      </p>
      <button type="button" onClick={card.reload} className={`${chip()} mt-1`}>
        {words["followup.retry"]}
      </button>
    </div>
  );
}

export type Editing = { mode: "edit" | "paste"; focus: FactField | null };

/**
 * "Fill in what they told you": each fact still to ask, then the editor and the paste. With nothing to
 * ask, only "Edit info", so "What happened?" stays close (persona panel, D140).
 */
export function Fill(props: {
  row: FollowUpRow;
  words: FollowUpWords;
  card: HeldCard;
  onOpen: (e: Editing) => void;
}) {
  const { row, words, card } = props;
  // The editor starts from the card's versions: off until the newest read is in, and the line says why.
  const ready = card.status === "ok";
  if (row.ask.length === 0) {
    return (
      <div className={SECTION}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => props.onOpen({ mode: "edit", focus: null })}
          className={chip()}
        >
          {words["facts.edit"]}
        </button>
        <CardStatus card={card} words={words} />
      </div>
    );
  }
  return (
    <section className={SECTION} aria-labelledby="follow-up-fill-h">
      <h3 id="follow-up-fill-h" className={HEAD}>
        {words["followup.fill"]}
      </h3>
      <p className="text-body-sm text-ink/80">{words["followup.askTap"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {row.ask.map((a) => (
          <button
            key={a.field}
            type="button"
            disabled={!ready}
            onClick={() => props.onOpen({ mode: "edit", focus: a.field })}
            className={chip()}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => props.onOpen({ mode: "paste", focus: null })}
          className={chip()}
        >
          {words["facts.paste"]}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => props.onOpen({ mode: "edit", focus: null })}
          className={chip()}
        >
          {words["facts.edit"]}
        </button>
      </div>
      <CardStatus card={card} words={words} />
    </section>
  );
}

/** The newest follow-up notes from the card (three at most), or what is still being read. */
export function Notes({ card, words }: { card: HeldCard; words: FollowUpWords }) {
  const lines = card.data?.followUps.lines.slice(0, 3) ?? [];
  return (
    <section className={SECTION} aria-labelledby="follow-up-notes-h">
      <h3 id="follow-up-notes-h" className={HEAD}>
        {words["followup.notes"]}
      </h3>
      {card.status === "loading" ? (
        <p role="status" className="text-body-sm text-ink/70">
          {words["followup.loading"]}
        </p>
      ) : card.status !== "ok" ? (
        <p className="text-body-sm">{words["followup.cardFailed"]}</p>
      ) : lines.length === 0 ? (
        <p className="text-body-sm text-ink/70">{words["followup.noNotes"]}</p>
      ) : (
        <ul className="text-body-sm">
          {lines.map((line) => (
            <li key={line} className="border-t border-rule py-1 first:border-t-0">
              {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
