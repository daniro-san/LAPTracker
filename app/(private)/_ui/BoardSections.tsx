// The members' board's sections (D105, issue 331), rendered on the server: this week's member-marked events
// on the viewer's clock with server time beside them, the notices marked for members, and Start here. Texts
// written in several languages show the viewer's first, the others one tap away (BoardText.tsx).
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { BOARD_DAYS, type BoardEntry, type BoardNotice } from "@/lib/private/board";
import { addDays, zonedInstant } from "@/lib/private/calendar-time";
import { calendarDates, stOf, titleOf } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/private/start-here";

import { BoardTime } from "./BoardParts";
import { LanguageTag, LINK, linkLabel, TEXT, Translated } from "./BoardText";
import { calendarWords } from "./calendar-data";

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
  return (
    <li className="border-t border-rule py-2 first:border-t-0">
      <p className="font-semibold">{titleOf(entry, t)}</p>
      {item.minute !== null && (
        <p>
          <BoardTime
            st={stOf(entry.kind, item.minute, t)}
            at={zonedInstant(item.day, item.minute, zone)}
            day={item.day}
            language={props.language}
            words={calendarWords(t)}
          />
        </p>
      )}
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
    </li>
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
  const days = Array.from({ length: BOARD_DAYS }, (_, i) => addDays(today, i))
    .map((day) => ({ day, items: entries.filter((e) => e.day === day) }))
    .filter((d) => d.items.length > 0);
  // The page's title already says "This week": the section has no heading of its own.
  return (
    <section aria-label={t["board.week"]} className="mt-4">
      {theme && <p className="font-semibold">{titleOf(theme.entry, t)}</p>}
      {days.length === 0 ? (
        <p className="mt-1">{t["board.week.none"]}</p>
      ) : (
        <>
          <p className="mt-1 text-body-sm text-ink/75">{t["board.times"]}</p>
          {days.map(({ day, items }) => (
            <div key={day} className="mt-3 border border-rule px-4 py-2">
              <h2 className="font-semibold">
                {dates.long(day)}
                {day === today && <span className="text-plum">{` · ${t["board.today"]}`}</span>}
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
    <section aria-labelledby="board-notices" className="mt-6">
      <h2 id="board-notices" className="font-subhead text-display-sm">
        {t["board.notices"]}
      </h2>
      {notices.length === 0 && <p className="mt-1">{t["board.notices.none"]}</p>}
      {notices.map((n) => (
        <article
          key={n.id}
          id={`notice-${n.id}`}
          aria-labelledby={`notice-${n.id}-title`}
          className="mt-3 scroll-mt-16 border border-rule px-4 py-3"
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
      aria-labelledby="board-start-title"
      className="mt-6 scroll-mt-16 border border-rule px-4 py-3"
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
