"use client";

// The member card's "Squads (from the tracker)" (issue 413, D117; issue 461, D136): every squad the
// tracker saw, in squad order, with its might, when it was seen (server time, then the viewer's own clock
// after hydration) and what changed since the row before. Each squad's 5 heroes are drawn as the game's
// lineup: the API's order is the slot order (top centre, middle right, middle left, centre, bottom right),
// each with its picture in a rarity frame, rarity, level, the game's five stars and its Hall of Honor
// level. Below 360 px, and always for screen readers, the same heroes are a list in slot order. A slot the
// tracker sent no hero for is a neutral empty slot ("1 slot empty", D75), never a warning. Troop counts are
// never shown (owner, issue 461). The strongest squad sits in the soft drawn frame with "Strongest".
import { HeroPicture } from "@/app/_ui/Pictures";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { clockIn } from "@/lib/private/calendar-time";
import type {
  HeroCard,
  Rarity,
  SquadCard,
  SquadsCard,
  StarIcon,
} from "@/lib/private/member-squads";

import { useViewerZone } from "./YourTime";

/** The rarity's text and picture-frame colours (tokens `--rarity-*`, DESIGN.md "Rarity"). */
const RARITY_LOOK: Record<Rarity, { text: string; frame: string }> = {
  SR: { text: "text-rarity-sr", frame: "border-2 border-rarity-sr" },
  SSR: { text: "text-rarity-ssr", frame: "border-2 border-rarity-ssr" },
  UR: { text: "text-rarity-ur", frame: "border-2 border-rarity-ur" },
};

const STAR_COLOUR = {
  empty: "text-ink/20",
  yellow: "text-star-yellow",
  red: "text-star-red",
} as const;

/**
 * Where each slot sits in a 3-column grid of 5 half-height rows, each hero two rows tall: the game's
 * lineup, staggered so it takes 2.5 hero heights instead of 4.
 */
const SLOT_PLACE = [
  "col-start-2 row-start-1",
  "col-start-3 row-start-2",
  "col-start-1 row-start-2",
  "col-start-2 row-start-3",
  "col-start-3 row-start-4",
] as const;

type Words = Pick<SquadsCard, "slotWord" | "emptySlot" | "strongestTag" | "clock">;

export function MemberSquads({ squads }: { squads: SquadsCard }) {
  return (
    <section className="mt-3">
      <h3 className="text-body-sm font-semibold">{squads.head}</h3>
      {squads.squads.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/75">{squads.none}</p>
      ) : (
        <>
          {squads.summary && <p className="mt-1 text-body-sm">{squads.summary}</p>}
          <p className="text-[12px] text-ink/70">{squads.help}</p>
          <ul className="mt-1">
            {squads.squads.map((s) => (
              <Squad key={s.squad} s={s} w={squads} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** "seen Thu, Nov 19 22:32 ST · 00:32 your time (+1 d)": the viewer's clock once the page is live. */
function Seen({ s, w }: { s: SquadCard; w: Words }) {
  const zone = useViewerZone();
  if (!s.seen) return null;
  let mine: string | null = null;
  if (zone && s.seenAt) {
    const { time, shift } = clockIn(s.seenAt.at, zone, s.seenAt.day);
    const mark = shift > 0 ? w.clock.nextDay : shift < 0 ? w.clock.prevDay : "";
    mine = `${fill(w.clock.yours, { time })}${mark ? ` (${mark})` : ""}`;
  }
  return (
    <p className="text-[12px] text-ink/70 tabular-nums">
      {s.seen}
      {mine && ` · ${mine}`}
      {s.age && ` · ${s.age}`}
    </p>
  );
}

function Squad({ s, w }: { s: SquadCard; w: Words }) {
  // What changed: "+1.20M since Sun, Nov 15 · Heroes changed · 1 slot empty".
  const change = [s.change, s.heroesChanged, s.empty]
    .filter((n): n is string => n !== null)
    .join(" · ");
  return (
    <li
      className={
        s.strongest ? "drawn-frame-soft my-2 bg-plum/5 px-2 py-2" : "border-t border-rule py-2"
      }
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{s.title}</span>
          {s.strongest && <Tag tone="progress">{w.strongestTag}</Tag>}
        </span>
        <span translate="no" className="tabular-nums">
          {s.might}
        </span>
      </p>
      <Seen s={s} w={w} />
      {change && <p className="text-[12px] text-ink/70 tabular-nums">{change}</p>}
      {/* The lineup from 360 px; screen readers get the list below instead. */}
      <div
        aria-hidden="true"
        className="mt-2 hidden auto-rows-[3.5rem] grid-cols-3 gap-x-2 min-[360px]:grid"
      >
        {s.slots.map((h, i) => (
          <div key={i} className={`row-span-2 flex min-w-0 flex-col items-center ${SLOT_PLACE[i]}`}>
            {h ? <LineupHero h={h} /> : <EmptySlot word={w.emptySlot} />}
          </div>
        ))}
      </div>
      {/* Slot order as a list: shown below 360 px, read aloud at every width. */}
      <ol className="mt-2 grid gap-y-2 min-[360px]:sr-only">
        {s.slots.map((h, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2">
            <span className="sr-only">{fill(w.slotWord, { n: i + 1 })}:</span>
            {h ? (
              <>
                <HeroPicture id={h.id} known={h.known} frame={rarityOf(h)?.frame} />
                <span className="min-w-0 flex-1 text-body-sm leading-tight">
                  <span translate="no" className="block break-words">
                    {h.name}
                  </span>
                  <HeroFacts h={h} />
                  <Stars icons={h.stars} label={h.starsLabel} />
                </span>
              </>
            ) : (
              <span className="text-body-sm text-ink/70">{w.emptySlot}</span>
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
      className={`flex flex-wrap gap-x-1.5 text-[12px] leading-4 whitespace-nowrap text-ink/75 tabular-nums ${center ? "justify-center" : ""}`}
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
      <span translate="no" className="mt-0.5 w-full truncate text-center text-[12px] leading-4">
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
      <span className="mt-0.5 text-center text-[12px] leading-4 text-ink/70">{word}</span>
    </>
  );
}

/** The game's five star icons: each in its colour, the next one partly filled in the colour it will take. */
function Stars({ icons, label }: { icons: StarIcon[]; label: string }) {
  return (
    <span role="img" aria-label={label} className="mt-0.5 flex gap-px">
      {icons.map((icon, i) => (
        <span key={i} className="relative inline-block size-[11px]">
          <StarShape colour={STAR_COLOUR[icon.base]} />
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

function StarShape({ colour }: { colour: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={`absolute top-0 left-0 size-[11px] max-w-none fill-current ${colour}`}
    >
      <path d={STAR_PATH} />
    </svg>
  );
}
