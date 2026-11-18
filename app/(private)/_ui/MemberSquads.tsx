// The member card's "Squads (from the tracker)" (issue 413, D117): every squad the tracker saw, in squad
// order, with its might, when it was seen and what changed since the row before; then its heroes with
// picture, name, rarity (R / SSR / UR), level and stars as "★10". The strongest squad sits in the soft
// drawn frame with a plum tint and the word "Strongest"; the one top hero carries "Top hero" (owner,
// 2026-11-18). A word always carries the meaning, never the colour alone. A drop is in plain ink, never a
// warning, and no squad seen is one quiet line (D75). The words come from lib/private/member-squads.ts.
import { HeroPicture } from "@/app/_ui/Pictures";
import { Tag } from "@/lib/brand/components/Tag";
import type { HeroCard, SquadCard, SquadsCard } from "@/lib/private/member-squads";

export function MemberSquads({ squads }: { squads: SquadsCard }) {
  return (
    <section className="mt-3 border-t border-rule pt-3">
      <h3 className="text-body-sm font-semibold">{squads.head}</h3>
      {squads.squads.length === 0 ? (
        <p className="mt-1 text-body-sm text-ink/75">{squads.none}</p>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-ink/70">{squads.help}</p>
          <p className="text-[12px] text-ink/70">{squads.topRule}</p>
          <ul className="mt-1">
            {squads.squads.map((s) => (
              <Squad
                key={s.squad}
                s={s}
                strongestTag={squads.strongestTag}
                topTag={squads.topTag}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Squad({
  s,
  strongestTag,
  topTag,
}: {
  s: SquadCard;
  strongestTag: string;
  topTag: string;
}) {
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
      {/* Two columns at every width: the sheet is about 440 px wide even on a desktop, and a third
          column wrapped "★10" under the level. */}
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
        {s.heroes.map((h, i) => (
          <Hero key={`${h.id}-${i}`} h={h} topTag={topTag} />
        ))}
      </ul>
    </li>
  );
}

function Hero({ h, topTag }: { h: HeroCard; topTag: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <HeroPicture id={h.id} known={h.known} />
      <span className="min-w-0 flex-1 text-body-sm leading-tight">
        <span translate="no" className="block break-words">
          {h.name}
        </span>
        {/* "UR Lv 145 ★10": short parts that wrap as wholes, never past the column. */}
        <span className="flex flex-wrap gap-x-1.5 text-[12px] whitespace-nowrap text-ink/75 tabular-nums">
          {h.rarity && (
            <span translate="no" className="font-semibold">
              {h.rarity}
            </span>
          )}
          {h.level && <span>{h.level}</span>}
          {h.stars > 0 && (
            <span role="img" aria-label={h.starsLabel}>
              ★{h.stars}
            </span>
          )}
        </span>
        {h.top && (
          <span className="block">
            <Tag tone="progress">{topTag}</Tag>
          </span>
        )}
      </span>
    </li>
  );
}
