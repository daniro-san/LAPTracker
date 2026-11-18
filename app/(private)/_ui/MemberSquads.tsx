// The member card's "Squads (from the tracker)" (issue 413, D117): each squad the tracker saw, its might
// and when it was seen, then its heroes with picture, name, rarity (R / SSR / UR), level and stars as
// "★10". The words come from the server (lib/private/member-squads.ts). Plain information: no squad seen is one quiet line, never a warning (D75).
import { HeroPicture } from "@/app/_ui/Pictures";
import type { SquadsCard } from "@/lib/private/member-squads";

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
              <li key={s.squad} className="border-t border-rule py-2">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                  <span className="font-semibold">{s.title}</span>
                  <span translate="no" className="tabular-nums">
                    {s.might}
                  </span>
                </p>
                {s.seen && <p className="text-[12px] text-ink/70">{s.seen}</p>}
                {/* Two columns at every width: the sheet is about 440 px wide even on a desktop, and a
                    third column wrapped "★10" under the level. */}
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {s.heroes.map((h, i) => (
                    <li key={`${h.id}-${i}`} className="flex min-w-0 items-center gap-2">
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
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
