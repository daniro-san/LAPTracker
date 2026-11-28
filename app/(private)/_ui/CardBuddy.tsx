"use client";

// The member card's buddy block (issue 828, D140 amendment 2026-11-28), on the Overview: the buddy an officer
// named ("Buddy: Bram Oake"), a list of the alliance's members to pick one from (officers first), and Undo,
// which clears it. A save names the version the card showed; when another officer changed the buddy since,
// the card shows theirs and says so. Nothing is sent to anyone: the buddy is a note for the officers.
import { useState } from "react";

import { chip, FIELD } from "@/lib/brand/components/controls";
import type { CardBuddy as Data } from "@/lib/private/buddy";
import { fill } from "@/lib/words";

import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Note = "saved" | "undone" | "failed" | "changed" | typeof SIGNED_OUT;
type Answer = { status: number; body: { version?: number; value?: number | null } };

async function save(
  slug: string,
  uid: number,
  body: { version: number; buddy: number | null },
): Promise<Answer | null> {
  const res = await fetch(`/api/w/${slug}/members/${uid}/buddy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return null;
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Answer["body"] };
}

/** The list of members and its Save, while the officer is picking. */
function Picker(props: {
  data: Data;
  choice: string;
  busy: boolean;
  onChoice: (uid: string) => void;
  onSave: () => void;
}) {
  const { data, choice } = props;
  const w = data.words;
  const option = (o: { uid: number; name: string }) => (
    <option key={o.uid} value={o.uid}>
      {o.name}
    </option>
  );
  const officers = data.options.filter((o) => o.officer);
  const members = data.options.filter((o) => !o.officer);
  return (
    <>
      <select
        aria-label={w["card.buddy.pick"]}
        value={choice}
        onChange={(e) => props.onChoice(e.target.value)}
        className={`${FIELD} max-w-full sm:w-auto`}
      >
        <option value="">{w["card.buddy.pick"]}</option>
        {officers.length > 0 && (
          <optgroup label={w["card.buddy.officers"]}>{officers.map(option)}</optgroup>
        )}
        {members.length > 0 && (
          <optgroup label={w["card.buddy.members"]}>{members.map(option)}</optgroup>
        )}
      </select>
      <button
        type="button"
        disabled={props.busy || choice === ""}
        onClick={props.onSave}
        className={chip()}
      >
        {w["card.buddy.save"]}
      </button>
    </>
  );
}

export function CardBuddy(props: {
  slug: string;
  uid: number;
  data: Data;
  onChanged?: (() => void) | undefined;
}) {
  const { data, slug, uid } = props;
  const w = data.words;
  const [name, setName] = useState(data.name);
  const [version, setVersion] = useState(data.version);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const nameOf = (id: number | null | undefined) =>
    data.options.find((o) => o.uid === id)?.name ?? null;

  const send = async (buddy: number | null) => {
    setBusy(true);
    const r = await save(slug, uid, { version, buddy });
    setBusy(false);
    if (r?.status === 401) return setNote(SIGNED_OUT);
    if (!r || (r.status !== 200 && r.status !== 409)) return setNote("failed");
    // A 409 carries the buddy another officer saved: the card shows that one.
    setVersion(r.body.version ?? version);
    setName(nameOf(r.body.value));
    setPicking(false);
    setChoice("");
    setNote(r.status === 409 ? "changed" : buddy === null ? "undone" : "saved");
    props.onChanged?.();
  };

  const panel = `card-buddy-${uid}`;
  return (
    <section className="mt-3 border-t border-rule pt-3">
      {name && (
        // ph-no-capture (issue 549): the buddy's name never reaches session replay.
        <p className="ph-no-capture text-body-sm font-semibold">
          {fill(w["card.buddy.line"], { name })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={picking}
          aria-controls={panel}
          onClick={() => setPicking((p) => !p)}
          className={chip(picking)}
        >
          {name ? w["card.buddy.change"] : w["card.buddy.add"]}
        </button>
        {name && (
          <button type="button" disabled={busy} onClick={() => void send(null)} className={chip()}>
            {w["card.buddy.undo"]}
          </button>
        )}
      </div>
      <div id={panel} hidden={!picking} className="mt-2 flex flex-wrap items-center gap-2">
        {picking && (
          <Picker
            data={data}
            choice={choice}
            busy={busy}
            onChoice={setChoice}
            onSave={() => void send(Number(choice))}
          />
        )}
      </div>
      {note &&
        (note === "failed" || note === SIGNED_OUT ? (
          <RefusalLine
            text={note === SIGNED_OUT ? SIGNED_OUT : w["card.buddy.failed"]}
            className="mt-2 text-body-sm text-seal"
          />
        ) : (
          <p role="status" className="mt-2 text-body-sm text-sage">
            {w[`card.buddy.${note}`]}
          </p>
        ))}
    </section>
  );
}
