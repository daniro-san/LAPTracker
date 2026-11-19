// The members' board's sections (D105, issue 331), rendered on the server: this week's member-marked events
// as a strip of seven days and a card per day with events, each event's time first on the viewer's clock
// with server time under it (D116); the notices marked for members; and Start here. Texts written in
// several languages show the viewer's first, the others one tap away (BoardText.tsx).
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { BOARD_DAYS, type BoardEntry, type BoardNotice } from "@/lib/private/board";
import { addDays, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/private/start-here";

import { BoardTimeColumn } from "./BoardParts";
import { LanguageTag, LINK, linkLabel, TEXT, Translated } from "./BoardText";
import { calendarWords } from "./calendar-data";
import { NoticeImage } from "./NoticePicture";

export { LINK } from "./BoardText";

function Entry(props: {
  item: BoardEntry;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  zone: string;
  notices: Map<number, string>;
}) {
  const { item, t, zone } = props;
  const { entry } = item;
  const title = props.notices.get(item.noticeId ?? -1);
  // The time first, in its own column, the viewer's clock large (D116); an entry with no time spans both.
  return (
    <li className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 border-t border-rule py-3 first:border-t-0">
      {item.minute !== null && (
        <p>
          <BoardTimeColumn
            st={stOf(entry.kind, item.minute, t)}
            at={zonedInstant(item.day, item.minute, zone)}
            day={item.day}
            language={props.language}
            words={calendarWords(t)}
          />
        </p>
      )}
      <div className={item.minute === null ? "col-span-2" : "min-w-0"}>
        <p className="font-semibold">{titleOf(entry, t)}</p>
        <EntryMore item={item} t={t} title={title} />
      </div>
    </li>
  );
}

/** An entry's notes, link and linked notice, under its title. */
function EntryMore(props: { item: BoardEntry; t: WorkspaceDictionary; title: string | undefined }) {
  const { item, t, title } = props;
  const { entry } = item;
  return (
    <>
      {entry.notes && <p className={`mt-1 ${TEXT}`}>{entry.notes}</p>}
      {entry.link && (
        <a href={entry.link} target="_blank" rel="noopener noreferrer" className={LINK}>
          {linkLabel(entry.link, t)}
        </a>
      )}
      {title !== undefined && (
        <p>
          <a
            href={`#notice-${item.noticeId}`}
            aria-label={`${t["board.notice"]}: ${title}`}
            className={LINK}
          >
            {t["board.notice"]}
          </a>
        </p>
      )}
    </>
  );
}

/**
 * The seven days as a strip (D116): weekday and date, a dot per event (three at most) and the count for
 * screen readers. A day with events jumps to its card; today is filled plum. Days with nothing planned stay
 * quiet, never empty boxes to fill.
 */
function Strip(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  today: string;
  days: { day: string; items: BoardEntry[] }[];
}) {
  const { t, language, today } = props;
  const dates = calendarDates(language);
  const number = new Intl.DateTimeFormat(language, { day: "numeric", timeZone: "UTC" });
  const plural = new Intl.PluralRules(language);
  return (
    <ol aria-label={t["board.days"]} className="mt-3 grid grid-cols-7 gap-0.5">
      {props.days.map(({ day, items }) => {
        const n = items.length;
        const now = day === today;
        const look = now ? "bg-plum text-paper" : n > 0 ? "bg-plum/10 text-plum" : "text-ink/70";
        const said = `${dates.long(day)}${now ? ` · ${t["board.today"]}` : ""} · ${
          n > 0
            ? fill(t[`board.events.${plural.select(n) === "one" ? "one" : "other"}`], { n })
            : t["board.free"]
        }`;
        const inside = (
          <>
            <span aria-hidden="true" className="text-[12px] leading-tight">
              {dates.weekday(day)}
            </span>
            <span aria-hidden="true" className="text-lg leading-tight font-semibold tabular-nums">
              {number.format(new Date(`${day}T00:00:00Z`))}
            </span>
            <span aria-hidden="true" className="flex h-2 gap-0.5">
              {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                <span key={i} className={`size-1.5 rounded-full ${now ? "bg-paper" : "bg-plum"}`} />
              ))}
            </span>
            <span className="sr-only">{said}</span>
          </>
        );
        const box = `flex min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 ${look}`;
        return (
          <li key={day}>
            {n > 0 ? (
              <a href={`#day-${day}`} className={`${box} tint-button underline-offset-4`}>
                {inside}
              </a>
            ) : (
              <span className={box}>{inside}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Week(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  today: string;
  entries: BoardEntry[];
  notices: BoardNotice[];
}) {
  const { t, language, today, entries } = props;
  const zone = getEnv().SERVER_TZ;
  const dates = calendarDates(language);
  const titles = new Map(props.notices.map((n) => [n.id, n.title]));
  // This week's Alliance Duel theme, whose Monday may have passed, goes above the days.
  const theme = entries.find((e) => e.entry.kind === "duel" && e.day < today);
  const week = Array.from({ length: BOARD_DAYS }, (_, i) => addDays(today, i)).map((day) => ({
    day,
    items: entries.filter((e) => e.day === day),
  }));
  const days = week.filter((d) => d.items.length > 0);
  // The page's title already says "This week": the section has no heading of its own.
  return (
    <section aria-label={t["board.week"]} data-board-section="week" className="mt-4">
      {theme && <p className="font-semibold">{titleOf(theme.entry, t)}</p>}
      <Strip t={t} language={language} today={today} days={week} />
      {days.length === 0 ? (
        <p className="mt-3">{t["board.week.none"]}</p>
      ) : (
        <>
          <p className="mt-3 text-body-sm text-ink/75">{t["board.times"]}</p>
          {days.map(({ day, items }) => (
            <div key={day} id={`day-${day}`} className="drawn-card mt-4 scroll-mt-16 px-4 pt-3">
              <h2 className="font-subhead text-display-sm">
                {dates.long(day)}
                {day === today && (
                  <span className="text-body-sm font-semibold text-plum">{` · ${t["board.today"]}`}</span>
                )}
              </h2>
              <ul>
                {items.map((item) => (
                  <Entry
                    key={item.key}
                    item={item}
                    t={t}
                    language={language}
                    zone={zone}
                    notices={titles}
                  />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

export function Notices(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  notices: BoardNotice[];
  /** Notices an event above links to: they point back to it for the viewer's time. */
  linked: ReadonlySet<number>;
}) {
  const { t, language, notices } = props;
  const dates = calendarDates(language);
  return (
    <section aria-labelledby="board-notices" data-board-section="notices" className="mt-6">
      <h2 id="board-notices" className="font-subhead text-display-sm">
        {t["board.notices"]}
      </h2>
      {notices.length === 0 && <p className="mt-1">{t["board.notices.none"]}</p>}
      {notices.map((n) => (
        <article
          key={n.id}
          id={`notice-${n.id}`}
          aria-labelledby={`notice-${n.id}-title`}
          className="drawn-card mt-4 scroll-mt-16 px-4 py-3"
        >
          <h3 id={`notice-${n.id}-title`} translate="no" className="font-semibold">
            {n.title}
          </h3>
          <p className="flex flex-wrap gap-x-3 text-body-sm text-ink/75">
            <span>
              {n.endsOn
                ? fill(t["notices.until"], { date: dates.short(n.endsOn) })
                : t["board.noEnd"]}
            </span>
            <LanguageTag t={t} language={language} written={Object.keys(n.texts)} />
          </p>
          {props.linked.has(n.id) && <p className="text-body-sm">{t["board.seeEvent"]}</p>}
          {n.picture && <NoticeImage picture={n.picture} title={n.title} t={t} />}
          <Translated
            id={`notice-${n.id}`}
            t={t}
            language={language}
            written={Object.keys(n.texts)}
            stale={n.stale}
            body={(l) => (
              <p translate="no" className={`mt-1 ${TEXT}`}>
                {n.texts[l]}
              </p>
            )}
          />
        </article>
      ))}
    </section>
  );
}

const PARTS = [
  ["glossary", "board.start.glossary"],
  ["rules", "board.start.rules"],
  ["ask", "board.start.ask"],
] as const;

export function StartHere(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  texts: Partial<Record<NoticeLanguage, StartHereText>>;
  channel: string | null;
  guildId: string;
  /** An officer's preview: the link to the editor. */
  edit: string | null;
}) {
  const { t, texts, channel } = props;
  const written = NOTICE_LANGUAGES.filter((l) => {
    const x = texts[l];
    return x !== undefined && (x.glossary || x.rules || x.ask) !== "";
  });
  return (
    <section
      id="board-start"
      data-board-section="start_here"
      aria-labelledby="board-start-title"
      className="drawn-card mt-6 scroll-mt-16 px-4 py-3"
    >
      <h2 id="board-start-title" className="font-subhead text-display-sm">
        {t["board.start"]}
      </h2>
      <LanguageTag t={t} language={props.language} written={written} />
      {written.length === 0 ? (
        <p className="mt-1">{t["board.start.none"]}</p>
      ) : (
        <Translated
          id="start"
          t={t}
          language={props.language}
          written={written}
          body={(l) =>
            PARTS.map(([part, head]) =>
              texts[l]?.[part] ? (
                <div key={part} className="mt-2">
                  <h3 className="font-semibold">{t[head]}</h3>
                  <p translate="no" className={TEXT}>
                    {texts[l]?.[part]}
                  </p>
                </div>
              ) : null,
            )
          }
        />
      )}
      {channel && (
        <p className="mt-3">
          {fill(t["board.discord"], { channel })}{" "}
          <a
            href={`https://discord.com/channels/${props.guildId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            {t["board.discord.open"]}
          </a>
        </p>
      )}
      {props.edit && (
        <a href={props.edit} className={LINK}>
          {t["board.preview.edit"]}
        </a>
      )}
    </section>
  );
}
