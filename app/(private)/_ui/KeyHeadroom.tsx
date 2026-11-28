// Alliance settings → Tracker key: today's calls on the key by feature, what the plan still needs and what the
// key has left (issue 869). Counts only, from our own tables; the key is never in it. A feature whose calls
// are not attributable to one workspace says "not counted" instead of a guess. At 360 px each row is a label
// and its number on one line.
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { Headroom } from "@/lib/private/key-headroom";
import { fill } from "@/lib/words";

const ROWS = [
  ["headroom.squads", "squads"],
  ["headroom.shield", "shield"],
  ["headroom.afterReset", "afterReset"],
  ["headroom.recruit", "recruit"],
] as const;
const UNCOUNTED = ["headroom.raid", "headroom.daily"] as const;

export function KeyHeadroom(props: {
  headroom: Headroom;
  /** The saved key is the site's own: its quota is shared, so no plan check is made (issue 855). */
  siteKey: boolean;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { headroom: h, t } = props;
  const n = new Intl.NumberFormat(props.language);
  const { planned, left } = h;
  return (
    <section className="mt-4 border-t border-ink/15 pt-3" aria-labelledby="key-headroom">
      <h3 id="key-headroom" className="font-semibold">
        {t["headroom.head"]}
      </h3>
      <ul className="mt-1 text-body-sm tabular-nums">
        {ROWS.map(([label, feature]) => (
          <li key={feature} className="flex justify-between gap-3 py-0.5">
            <span>{t[label]}</span>
            <span>{n.format(h.calls[feature])}</span>
          </li>
        ))}
        {UNCOUNTED.map((label) => (
          <li key={label} className="flex justify-between gap-3 py-0.5 text-ink/70">
            <span>{t[label]}</span>
            <span>{t["headroom.notCounted"]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-body-sm tabular-nums">
        {fill(t["headroom.planned"], { n: n.format(planned) })}
      </p>
      <p className="text-body-sm tabular-nums">
        {left === null ? t["headroom.leftNone"] : fill(t["headroom.left"], { n: n.format(left) })}
      </p>
      {props.siteKey ? (
        <p className="mt-1 text-body-sm">{t["headroom.shared"]}</p>
      ) : (
        left !== null && (
          <p className={`mt-1 ${h.short ? "font-semibold text-seal" : "text-body-sm"}`}>
            {h.short
              ? fill(t[h.peak ? "headroom.shortSaturday" : "headroom.short"], {
                  planned: n.format(planned),
                  left: n.format(left),
                })
              : t["headroom.fits"]}
          </p>
        )
      )}
    </section>
  );
}
