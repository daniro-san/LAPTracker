"use client";

// The Calendar tab's week, day by day (issue 300): every entry with its server time (ST) and the officer's
// own time, its tags, Edit and Delete; "Add an event" opens the same sheet empty. The page opens at the top,
// with "Add an event" and "Today ↓" in its head row (owner, issue 412 UX pass); only an address that names a
// day (#d-<day>) or an Undo line scrolls. Entries already started are greyed. The page reads again when it
// comes back into view (owner rule, issue 293: freshness without realtime).
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { chip } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { mondayOf } from "@/lib/private/calendar-time";
import { FROM_CALENDAR } from "@/lib/private/roll-call-rules";
import type { Feature } from "@/lib/workspace-features";

import type { AgendaDay, AgendaItem, CalendarSheetWords } from "./calendar-data";
import { HeadRow } from "./CalendarHead";
import { DeleteArea, EntryUndoLine, type DeletedEntry } from "./DeleteArea";
import { EntryForm, type FormProps } from "./EntryForm";
import { Times } from "./YourTime";

/** Reads the page again when the officer comes back to it (another app, another tab). */
export function useFreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [router]);
}

/** The features turned off for the workspace (D126): their links are left out of the week. */
const Off = createContext<readonly Feature[]>([]);

let loadedAt: number | null = null;
const subscribe = () => () => {};
/** When the page loaded in the browser; null on the server and during hydration (no mismatch). */
const useLoadedAt = () =>
  useSyncExternalStore(
    subscribe,
    () => (loadedAt ??= Date.now()),
    () => null,
  );

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/**
 * The caravan's roles, or "Choose roles ›" to that week's caravans while none is chosen; for a KvK, an
 * Undead Siege or an Elixir Scramble team, its roll call (and the team to pick, issue 298).
 */
function Roles({
  item,
  words,
  slug,
}: {
  item: AgendaItem;
  words: CalendarSheetWords;
  slug: string;
}) {
  const off = useContext(Off);
  const roll = !off.includes("roll_call");
  if (item.roles) return <p className="text-body-sm">{item.roles}</p>;
  if (FROM_CALENDAR[item.form.kind]) {
    const query = `entry=${item.entry}&week=${item.week}`;
    return (
      <p className="flex flex-wrap gap-x-5">
        {roll && item.form.kind === "elixir" && (
          <a href={`/w/${slug}/roll-call/team?${query}`} className={LINK}>
            {words["calendar.pickTeam"]}
          </a>
        )}
        {roll && (
          <a href={`/w/${slug}/roll-call/mark?${query}`} className={LINK}>
            {words["calendar.rollCall"]}
          </a>
        )}
        {item.form.kind === "undead" && !off.includes("garrison") && (
          <a href={`/w/${slug}/calendar/garrison?${query}`} className={LINK}>
            {words["calendar.garrison"]}
          </a>
        )}
      </p>
    );
  }
  if (item.form.kind !== "caravan" || off.includes("caravans")) return null;
  return (
    <a
      href={`/w/${slug}/calendar/caravans?week=${mondayOf(item.day)}#car-${item.key}`}
      className={LINK}
    >
      {words["calendar.roles.choose"]}
    </a>
  );
}

/** The entry's notice (while notices are on, D126) and link: one row with a gap, wrapping, because side by
 * side they once read as one link (issue 412 UX pass). */
function EntryLinks(props: { item: AgendaItem; words: CalendarSheetWords; slug: string }) {
  const { item, words } = props;
  const notice = !useContext(Off).includes("notices") ? item.notice : null;
  if (!notice && !item.link) return null;
  return (
    <p className="flex flex-wrap gap-x-5">
      {notice && (
        <a href={`/w/${props.slug}/notices/${notice.id}`} className={LINK}>
          {fill(words["calendar.notice"], { title: notice.title })}
        </a>
      )}
      {item.link && (
        <a href={item.link} target="_blank" rel="noreferrer nofollow" className={LINK}>
          {words["calendar.link"]}
        </a>
      )}
    </p>
  );
}

function Item(props: {
  item: AgendaItem;
  words: CalendarSheetWords;
  slug: string;
  onEdit: () => void;
  /** After a delete from the card (D123): the entry and the request, for the Undo line. */
  onDeleted: (d: DeletedEntry) => void;
  onDone: () => void;
}) {
  const { item, words } = props;
  const now = useLoadedAt();
  const past = now !== null && item.at !== null && item.at < now;
  return (
    <li className={`flex items-start gap-3 border-t border-rule py-3 ${past ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        {item.st && item.at !== null && (
          <p className="text-body-sm">
            <Times st={item.st} at={item.at} day={item.day} words={words} />
          </p>
        )}
        <p className="font-semibold">{item.title}</p>
        <Roles item={item} words={words} slug={props.slug} />
        {item.notes && <p className="text-body-sm whitespace-pre-line text-ink/85">{item.notes}</p>}
        <EntryLinks item={item} words={words} slug={props.slug} />
        {item.tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-3">
            {item.tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={props.onEdit}
          aria-label={fill(words["calendar.editOf"], { title: item.title })}
          className={`${chip()} min-w-11 justify-center font-semibold text-plum`}
        >
          {words["calendar.edit"]}
        </button>
        <DeleteArea
          item={item}
          words={words}
          slug={props.slug}
          onDone={props.onDone}
          onDeleted={props.onDeleted}
          inCard
        />
      </div>
    </li>
  );
}

function Day(props: {
  d: AgendaDay;
  words: CalendarSheetWords;
  slug: string;
  onEdit: (item: AgendaItem) => void;
  onDeleted: (d: DeletedEntry) => void;
  onDone: () => void;
  /** "Event deleted." with Undo, in the day the deleted entry was on (D123). */
  undo: ReactNode;
}) {
  const { d, words } = props;
  return (
    <li id={`d-${d.day}`} className="drawn-card mt-4 scroll-mt-4 px-4 pt-3">
      {/* "Today ↓" moves the focus here, so the keyboard goes on from today's entries. */}
      <h2 id={`d-${d.day}-head`} tabIndex={-1} className="font-subhead text-display-sm">
        {d.head}
        {d.today && (
          <span className="text-body-sm font-semibold text-plum">{` · ${words["calendar.today"]}`}</span>
        )}
      </h2>
      {d.duel && (
        <p className="text-body-sm text-ink/70">
          {fill(words["calendar.duelDay"], { theme: d.duel })}
        </p>
      )}
      {d.items.length === 0 ? (
        <p className="border-t border-rule py-3 text-body-sm text-ink/70">
          {words["calendar.nothing"]}
        </p>
      ) : (
        <ul>
          {d.items.map((item) => (
            <Item
              key={item.key}
              item={item}
              words={words}
              slug={props.slug}
              onEdit={() => props.onEdit(item)}
              onDeleted={props.onDeleted}
              onDone={props.onDone}
            />
          ))}
        </ul>
      )}
      {props.undo && <div className="pb-3">{props.undo}</div>}
    </li>
  );
}

interface AgendaProps {
  days: AgendaDay[];
  theme: AgendaItem | null;
  words: CalendarSheetWords;
  slug: string;
  zone: string;
  /** The workspace's notices, for the sheet's "Notice" choice (D102). */
  notices: FormProps["notices"];
  /** The day "Add an event" starts on: today in this week, else its Monday. */
  addDay: string;
  /** The features turned off for the workspace (D126). */
  off: readonly Feature[];
  /** The page's title, at the start of the head row. */
  head: ReactNode;
  /** What sits between the head row and the days: the views, the week bar, the month. */
  children: ReactNode;
}

export function CalendarAgenda(props: AgendaProps) {
  const { words } = props;
  const router = useRouter();
  const [open, setOpen] = useState<FormProps["mode"] | null>(null);
  /** The officer's last whole-entry delete (D123), while the Calendar offers Undo. */
  const [deleted, setDeleted] = useState<{ entry: DeletedEntry; day: string } | null>(null);
  useFreshOnReturn();
  const today = props.days.find((d) => d.today)?.day;
  const undo = deleted && (
    <EntryUndoLine
      key={deleted.entry.requestId}
      {...{ deleted: deleted.entry, words, slug: props.slug }}
      onUndone={() => {
        setDeleted(null);
        router.refresh();
      }}
    />
  );
  const done = () => {
    setOpen(null);
    router.refresh();
  };
  const fromCard = (day: string) => ({
    onDeleted: (entry: DeletedEntry) => setDeleted({ entry, day }),
    onDone: () => router.refresh(),
  });
  return (
    <Off.Provider value={props.off}>
      <HeadRow
        head={props.head}
        today={today}
        words={words}
        onAdd={() => setOpen({ add: true, day: props.addDay, hasTheme: props.theme !== null })}
      />
      {props.children}
      {deleted && !props.days.some((d) => d.day === deleted.day) && undo}
      {props.theme && (
        <ul className="mt-4">
          <Item
            item={props.theme}
            words={words}
            slug={props.slug}
            onEdit={() => setOpen({ add: false, item: props.theme as AgendaItem })}
            {...fromCard(props.theme.day)}
          />
        </ul>
      )}
      <ol className="mt-4">
        {props.days.map((d) => (
          <Day
            key={d.day}
            d={d}
            words={words}
            slug={props.slug}
            onEdit={(item) => setOpen({ add: false, item })}
            {...fromCard(d.day)}
            undo={deleted?.day === d.day && undo}
          />
        ))}
      </ol>
      {open && (
        <EntryForm
          words={words}
          slug={props.slug}
          zone={props.zone}
          {...{ notices: props.notices, off: props.off }}
          mode={open}
          onDone={done}
          onDeleted={(entry) => setDeleted({ entry, day: open.add ? open.day : open.item.day })}
          onClose={() => setOpen(null)}
        />
      )}
    </Off.Provider>
  );
}
