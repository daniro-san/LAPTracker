"use client";

// The week's Alliance Caravans and their picks (issue 300): one Coachman, plus a VIP or a Guardian, never
// both (owner, 2026-11-16). Members come from the alliance's newest roster, found by typing part of a name.
// The picker suggests up to three members first (issue 354); the full list is in name order.
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CalendarWords } from "@/lib/private/dictionary.calendar";

import type { AgendaItem, Member, SuggestedMember } from "./calendar-data";
import { refusalText, sendCalendar, type Stale } from "./calendar-send";
import { useFreshOnReturn } from "./CalendarAgenda";
import { Choice, ConflictBox } from "./CalendarFields";
import { RosterPicker } from "./RosterPicker";
import { YourTime } from "./YourTime";

type SeatKind = "vip" | "guardian";
type Field = "coach" | "second";
type Note = { key: string; error?: string; stale?: Stale[]; retry?: () => void };

function SeatRow(props: {
  role: string;
  member: Member | null;
  words: CalendarWords;
  busy: boolean;
  onChoose: () => void;
  onRemove: () => void;
}) {
  const { words, member } = props;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1">
        <span className="block text-body-sm text-ink/75">{props.role}</span>
        {member ? (
          <span translate="no" className="font-semibold">
            {member.name}
          </span>
        ) : (
          <span className="text-ink/70">{words["calendar.pick.empty"]}</span>
        )}
      </p>
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onChoose}
        className="min-h-11 border border-rule px-3 text-body-sm font-semibold"
      >
        {words[member ? "calendar.pick.change" : "calendar.pick.choose"]}
      </button>
      {member && (
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onRemove}
          className="min-h-11 px-2 text-body-sm font-semibold underline underline-offset-4"
        >
          {words["calendar.pick.remove"]}
        </button>
      )}
    </div>
  );
}

/** One field's save; a 409 keeps a retry with the newer version for "Use mine". */
function useSeats(slug: string, words: CalendarWords) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  async function save(item: AgendaItem, field: Field, value: unknown, version?: number) {
    // True once saved; false after a refusal, so the card can show the saved value again.
    setBusy(true);
    const change = { field, value, version: version ?? item.form.versions[field] ?? 0 };
    const sent = await sendCalendar(slug, {
      action: "edit",
      entry: item.entry,
      week: item.week,
      changes: [change],
    });
    setBusy(false);
    if (sent.ok) {
      setNote(null);
      router.refresh();
      return true;
    }
    const newer = sent.conflicts[0]?.version ?? 0;
    setNote(
      sent.code === "stale"
        ? {
            key: item.key,
            stale: sent.conflicts,
            retry: () => void save(item, field, value, newer),
          }
        : { key: item.key, error: refusalText(sent.code, words) },
    );
    return false;
  }
  const keep = () => {
    setNote(null);
    router.refresh();
  };
  return { busy, note, save, keep };
}

function CaravanCard(props: {
  item: AgendaItem;
  words: CalendarWords;
  seats: ReturnType<typeof useSeats>;
  onPick: (field: Field, kind: SeatKind) => void;
}) {
  const { item, words, seats } = props;
  // Shown at once; a seated member moves with it, and a refused move shows the saved kind again.
  const [kind, setKind] = useState<SeatKind>(item.second?.kind ?? "vip");
  const note = seats.note?.key === item.key ? seats.note : null;
  const switchTo = (k: SeatKind) => {
    setKind(k);
    const seated = item.second;
    if (seated) {
      void seats
        .save(item, "second", { kind: k, uid: seated.uid })
        .then((ok) => ok || setKind(seated.kind));
    }
  };
  return (
    <section aria-labelledby={`car-${item.key}`} className="mt-4 border border-rule px-3 py-3">
      <h2 id={`car-${item.key}`} className="font-subhead text-display-sm">
        {item.dayLabel}
      </h2>
      {item.st && item.at !== null && (
        <p className="text-body-sm">
          <span className="font-bold tabular-nums">{item.st}</span>
          <span className="text-ink/75">
            {" · "}
            <YourTime at={item.at} day={item.day} words={words} />
          </span>
        </p>
      )}
      <SeatRow
        role={words["calendar.role.coach"]}
        member={item.coach}
        words={words}
        busy={seats.busy}
        onChoose={() => props.onPick("coach", kind)}
        onRemove={() => void seats.save(item, "coach", null)}
      />
      <Choice
        legend={words["calendar.role.second"]}
        name={`seat-${item.key}`}
        value={kind}
        options={(["vip", "guardian"] as const).map((k) => ({
          value: k,
          label: words[`calendar.role.${k}`],
        }))}
        onChange={switchTo}
      />
      <SeatRow
        role={words[`calendar.role.${kind}`]}
        member={item.second}
        words={words}
        busy={seats.busy}
        onChoose={() => props.onPick("second", kind)}
        onRemove={() => void seats.save(item, "second", null)}
      />
      {note?.error && (
        <p role="alert" className="mt-3 border-l-4 border-seal pl-3 text-body-sm">
          {note.error}
        </p>
      )}
      {note?.stale && (
        <ConflictBox
          conflicts={note.stale}
          words={words}
          busy={seats.busy}
          onKeep={seats.keep}
          onMine={() => note.retry?.()}
        />
      )}
    </section>
  );
}

export function CaravanBoard(props: {
  items: AgendaItem[];
  roster: Member[];
  /** Per caravan week (`entry:week`), up to three suggested members with their reasons. */
  suggested: Record<string, SuggestedMember[]>;
  words: CalendarWords;
  slug: string;
}) {
  const { items, words } = props;
  useFreshOnReturn();
  const seats = useSeats(props.slug, words);
  const [picking, setPicking] = useState<{ item: AgendaItem; field: Field; kind: SeatKind } | null>(
    null,
  );
  if (items.length === 0) {
    return <p className="mt-4 border border-rule px-4 py-5">{words["calendar.caravans.none"]}</p>;
  }
  const role = (k: SeatKind) => words[`calendar.role.${k}`];
  return (
    <>
      <p className="mt-3 text-body-sm">{words["calendar.roles.rule"]}</p>
      {items.map((item) => (
        <CaravanCard
          key={`${item.key}:${item.second?.kind ?? ""}`}
          item={item}
          words={words}
          seats={seats}
          onPick={(field, kind) => setPicking({ item, field, kind })}
        />
      ))}
      {picking && (
        <RosterPicker
          role={picking.field === "coach" ? words["calendar.role.coach"] : role(picking.kind)}
          roster={props.roster}
          suggested={props.suggested[picking.item.key] ?? []}
          taken={picking.field === "coach" ? picking.item.second : picking.item.coach}
          takenRole={
            picking.field === "coach"
              ? role(picking.item.second?.kind ?? "vip")
              : words["calendar.role.coach"]
          }
          words={words}
          onPick={(m) => {
            const { item, field, kind } = picking;
            setPicking(null);
            void seats.save(item, field, field === "coach" ? { uid: m.uid } : { kind, uid: m.uid });
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
