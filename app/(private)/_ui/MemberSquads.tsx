"use client";

// The member card's "Squads (from the tracker)" (issue 413, D117; issue 461, D136): every squad the
// tracker saw, in squad order, with its might, when it was seen (server time, then the viewer's own clock
// after hydration) and what changed since the row before. Each squad's 5 heroes are drawn as the game's
// lineup at every width: slots 1–2 the front row on top, slots 3–5 the back row below (owner, 2026-11-21),
// each with its picture in a rarity frame, rarity, level, the game's five stars and its Hall of Honor
// level. Screen readers get the same heroes as a list in slot order instead. A slot the
// tracker sent no hero for is a neutral empty slot ("1 slot empty", D75), never a warning. Troop counts are
// never shown (owner, issue 461). Every squad sits in its own soft drawn frame, 12 px apart, so each reads as
// one unit (owner, 2026-11-21); the strongest one is tinted plum and tagged "Strongest".
import { HeroPicture } from "@/app/_ui/Pictures";
import { Tag } from "@/lib/brand/components/Tag";
import { joinAt } from "@/lib/date-words";
import { clockIn } from "@/lib/private/calendar-time";
import type {
  HeroCard,
  Rarity,
  SquadCard,
  SquadsCard,
  StarIcon,
} from "@/lib/private/member-squads";
import { fill } from "@/lib/words";

import { useViewerZone } from "./YourTime";

/** The rarity's text and picture-frame colours (tokens `--rarity-*`, DESIGN.md "Rarity"). */
const RARITY_LOOK: Record<Rarity, { text: string; frame: string }> = {
  SR: { text: "text-rarity-sr", frame: "border-2 border-rarity-sr" },
  SSR: { text: "text-rarity-ssr", frame: "border-2 border-rarity-ssr" },
  UR: { text: "text-rarity-ur", frame: "border-2 border-rarity-ur" },
};

/** An empty star is drawn in outline at ink/70 (5.7:1 on paper, issue 585; a filled ink/20 star was 1.5:1),
 * so a sighted reader can count "1 of 5" without telling two faint fills apart. */
const STAR_COLOUR = {
  empty: "text-ink/70",
  yellow: "text-star-yellow",
  red: "text-star-red",
} as const;

/**
 * Where each slot sits in a 6-column grid, each hero two columns wide: the front row (slots 1–2) centred on
 * row 1, the back row (slots 3–5) on row 2. The same at every width.
 */
const SLOT_PLACE = [
  "col-start-2 row-start-1",
  "col-start-4 row-start-1",
  "col-start-1 row-start-2",
  "col-start-3 row-start-2",
  "col-start-5 row-start-2",
] as const;

type Words = Pick<SquadsCard, "slotWord" | "emptySlot" | "strongestTag" | "clock">;

/** `mineFirst`: Me (D142) puts the viewer's own time first, as the board does (issue 585 batch 4). */
export function MemberSquads({
  squads,
  mineFirst = false,
}: {
  squads: SquadsCard;
  mineFirst?: boolean;
}) {
  return (
    <section className="mt-3">
      <h3 className="text-body-sm font-semibold">{squads.head}</h3>
      {squads.squads.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/75">{squads.none}</p>
      ) : (
        <>
          {squads.summary && <p className="mt-1 text-body-sm">{squads.summary}</p>}
          <p className="text-body-sm text-ink/70">{squads.help}</p>
          <ul className="mt-3 space-y-3">
            {squads.squads.map((s) => (
              <Squad key={s.squad} s={s} w={squads} mineFirst={mineFirst} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * The "seen" line's parts, joined by " · ". The desk card: "seen Thu, Nov 19, 22:32 ST", then "00:32 your
 * time (the next day)" once the browser knows its zone. Me (`mineFirst`, issue 585 batch 4, as the board):
 * "seen Fri, Nov 20, 00:32 your time", then "Thu, Nov 19, 22:32 ST"; on one day the date is said once
 * ("seen Thu, Nov 19, 20:32 your time", "22:32 ST"). The dates come from the server; only the viewer's
 * "00:32" is worked out here. Before the zone is known, the ST line alone.
 */
export function seenParts(
  s: SquadCard,
  w: Words,
  zone: string | null,
  mineFirst: boolean,
): string[] {
  if (!s.seen) return [];
  if (!zone || !s.seenAt) return [s.seen];
  const { time, shift } = clockIn(s.seenAt.at, zone, s.seenAt.day);
  const { clock } = w;
  if (!mineFirst) {
    const mark = shift > 0 ? clock.nextDay : shift < 0 ? clock.prevDay : "";
    return [s.seen, `${fill(clock.yours, { time })}${mark ? ` (${mark})` : ""}`];
  }
  const { days, time: st } = s.seenAt;
  const day = days[shift + 1] ?? days[1];
  const mine = fill(clock.yours, { time: joinAt(clock.language, day, time) });
  const server = fill(clock.st, { time: shift === 0 ? st : joinAt(clock.language, days[1], st) });
  return [fill(clock.seenMine, { mine }), server];
}

function Seen({ s, w, mineFirst }: { s: SquadCard; w: Words; mineFirst: boolean }) {
  const [first, ...rest] = seenParts(s, w, useViewerZone(), mineFirst);
  if (!first) return null;
  // At 14 px the line wraps: it breaks only at a " · ", never inside "3 days ago" (issue 585).
  return (
    <p className="text-body-sm text-ink/70 tabular-nums">
      {first}
      {rest.map((part) => (
        <span key={part}>
          {" · "}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
      {s.age && (
        <>
          {" · "}
          <span className="whitespace-nowrap">{s.age}</span>
        </>
      )}
    </p>
  );
}

function Squad({ s, w, mineFirst }: { s: SquadCard; w: Words; mineFirst: boolean }) {
  // What changed: "+1.20M since Sun, Nov 15 · Heroes changed · 1 slot empty".
  const change = [s.change, s.heroesChanged, s.empty]
    .filter((n): n is string => n !== null)
    .join(" · ");
  return (
    <li className={`drawn-frame-soft px-2 py-2 ${s.strongest ? "bg-plum/5" : ""}`}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{s.title}</span>
          {s.strongest && <Tag tone="progress">{w.strongestTag}</Tag>}
        </span>
        <span translate="no" className="tabular-nums">
          {s.might}
        </span>
      </p>
      <Seen s={s} w={w} mineFirst={mineFirst} />
      {change && <p className="text-body-sm text-ink/70 tabular-nums">{change}</p>}
      {/* The lineup; screen readers get the list below instead. */}
      <div aria-hidden="true" className="mt-2 grid grid-cols-6 gap-x-2 gap-y-2">
        {s.slots.map((h, i) => (
          <div key={i} className={`col-span-2 flex min-w-0 flex-col items-center ${SLOT_PLACE[i]}`}>
            {h ? <LineupHero h={h} /> : <EmptySlot word={w.emptySlot} />}
          </div>
        ))}
      </div>
      {/* Slot order as a list, read aloud: "Slot 1: …". */}
      <ol className="sr-only">
        {s.slots.map((h, i) => (
          <li key={i}>
            {fill(w.slotWord, { n: i + 1 })}:{" "}
            {h ? (
              <>
                <span translate="no">{h.name}</span> <HeroFacts h={h} />
                <Stars icons={h.stars} label={h.starsLabel} />
              </>
            ) : (
              w.emptySlot
            )}
          </li>
        ))}
      </ol>
    </li>
  );
}

const rarityOf = (h: HeroCard) => (h.rarity ? RARITY_LOOK[h.rarity] : null);

/** "UR Lv 150 Honor 42": short parts that wrap as wholes, never past the column. */
function HeroFacts({ h, center }: { h: HeroCard; center?: boolean }) {
  return (
    <span
      className={`flex flex-wrap gap-x-1.5 text-body-sm leading-5 whitespace-nowrap text-ink/75 tabular-nums ${center ? "justify-center" : ""}`}
    >
      {h.rarity && (
        <span translate="no" className={`font-semibold ${rarityOf(h)?.text ?? ""}`}>
          {h.rarity}
        </span>
      )}
      {h.level && <span>{h.level}</span>}
      {h.honor && <span>{h.honor}</span>}
    </span>
  );
}

function LineupHero({ h }: { h: HeroCard }) {
  return (
    <>
      <HeroPicture id={h.id} known={h.known} frame={rarityOf(h)?.frame} />
      <span translate="no" className="mt-0.5 w-full text-center text-body-sm leading-5 break-words">
        {h.name}
      </span>
      <HeroFacts h={h} center />
      <Stars icons={h.stars} label={h.starsLabel} />
    </>
  );
}

function EmptySlot({ word }: { word: string }) {
  return (
    <>
      <span className="size-10 rounded-[3px] border border-dashed border-ink/40" />
      <span className="mt-0.5 text-center text-[12px] leading-5 text-ink/70">{word}</span>
    </>
  );
}

/** The game's five star icons: each in its colour, the next one partly filled in the colour it will take. */
function Stars({ icons, label }: { icons: StarIcon[]; label: string }) {
  return (
    <span role="img" aria-label={label} className="mt-0.5 flex gap-px">
      {icons.map((icon, i) => (
        <span key={i} className="relative inline-block size-[11px]">
          <StarShape colour={STAR_COLOUR[icon.base]} outline={icon.base === "empty"} />
          {icon.next && (
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${icon.part * 100}%` }}
            >
              <StarShape colour={STAR_COLOUR[icon.next]} />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** A five-point star in a 10 × 10 box. */
const STAR_PATH = "M5 .4l1.4 2.9 3.2.4-2.3 2.2.6 3.2L5 7.6 2.1 9.1l.6-3.2L.4 3.7l3.2-.4z";

function StarShape({ colour, outline = false }: { colour: string; outline?: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`absolute top-0 left-0 size-[11px] max-w-none ${outline ? "fill-none stroke-current" : "fill-current"} ${colour}`}
    >
      <path d={STAR_PATH} strokeWidth={outline ? 0.9 : undefined} strokeLinejoin="round" />
    </svg>
  );
}
