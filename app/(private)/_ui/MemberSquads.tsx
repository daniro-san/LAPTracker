// The member card's "Squads (from the tracker)" (issue 413, D117): every squad the tracker saw, in squad
// order, with its might, when it was seen and what changed since the row before; then its heroes with
// picture, name, rarity and level, and the game's five star icons. The strongest squad sits in the soft
// drawn frame with a plum tint and the word "Strongest" (owner, 2026-11-18). Rarity is in the game's
// colours (SR blue, SSR purple, UR gold) and stars in its yellow and red, but a word always carries the
// meaning: the rarity's letters, and "Star level 7 of 10" for screen readers. A drop is in plain ink, never
// a warning, and no squad seen is one quiet line (D75). The words come from lib/private/member-squads.ts.
import { HeroPicture } from "@/app/_ui/Pictures";
import { Tag } from "@/lib/brand/components/Tag";
import type {
  HeroCard,
  Rarity,
  SquadCard,
  SquadsCard,
  StarIcon,
} from "@/lib/private/member-squads";

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

export function MemberSquads({ squads }: { squads: SquadsCard }) {
  return (
    <section className="mt-3 border-t border-rule pt-3">
      <h3 className="text-body-sm font-semibold">{squads.head}</h3>
      {squads.squads.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/75">{squads.none}</p>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-ink/70">{squads.help}</p>
          <ul className="mt-1">
            {squads.squads.map((s) => (
              <Squad key={s.squad} s={s} strongestTag={squads.strongestTag} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Squad({ s, strongestTag }: { s: SquadCard; strongestTag: string }) {
  // "seen Tue, Nov 17" on its line, then what changed: "+1.20M since Sun, Nov 15 · Heroes changed".
  const change = [s.change, s.heroesChanged].filter((n): n is string => n !== null).join(" · ");
  return (
    <li
      className={
        s.strongest ? "drawn-frame-soft my-2 bg-plum/5 px-2 py-2" : "border-t border-rule py-2"
      }
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{s.title}</span>
          {s.strongest && <Tag tone="progress">{strongestTag}</Tag>}
        </span>
        <span translate="no" className="tabular-nums">
          {s.might}
        </span>
      </p>
      {s.seen && <p className="text-[12px] text-ink/70">{s.seen}</p>}
      {change && <p className="text-[12px] text-ink/70 tabular-nums">{change}</p>}
      {/* Two columns at every width: the sheet is about 440 px wide even on a desktop. */}
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
        {s.heroes.map((h, i) => (
          <Hero key={`${h.id}-${i}`} h={h} />
        ))}
      </ul>
    </li>
  );
}

function Hero({ h }: { h: HeroCard }) {
  const look = h.rarity ? RARITY_LOOK[h.rarity] : null;
  return (
    <li className="flex min-w-0 items-center gap-2">
      <HeroPicture id={h.id} known={h.known} frame={look?.frame} />
      <span className="min-w-0 flex-1 text-body-sm leading-tight">
        <span translate="no" className="block break-words">
          {h.name}
        </span>
        {/* "UR Lv 150": short parts that wrap as wholes, never past the column. */}
        <span className="flex flex-wrap gap-x-1.5 text-[12px] whitespace-nowrap text-ink/75 tabular-nums">
          {h.rarity && (
            <span translate="no" className={`font-semibold ${look?.text ?? ""}`}>
              {h.rarity}
            </span>
          )}
          {h.level && <span>{h.level}</span>}
        </span>
        <Stars icons={h.stars} label={h.starsLabel} />
      </span>
    </li>
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
