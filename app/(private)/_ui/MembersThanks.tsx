// The Members page's thanks box (issues 296, 347, 404), rendered on the server: top donors and most active,
// then progress this week in name order, not a ranking (D109), with "Share the thanks" under it (D114).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { progressText, type CardFormats } from "@/lib/private/member-card";
import type { MembersView } from "@/lib/private/members";

import type { ShareThanksProps } from "./share-thanks-data";
import { ShareThanks } from "./ShareThanks";

export function MembersThanks(props: {
  view: MembersView;
  t: WorkspaceDictionary;
  f: CardFormats;
  share: ShareThanksProps;
}) {
  const { view, t, f } = props;
  const rows = (["donors", "activity"] as const).filter((k) => view.thanks[k].length > 0);
  const progress = view.thanks.progress;
  const improved = view.thanks.improved;
  if (rows.length === 0 && progress.length === 0 && improved.length === 0) return null;
  return (
    <section aria-labelledby="thanks" className="drawn-card mt-4 px-4 py-3">
      <h2 id="thanks" className="font-subhead text-display-sm">
        {t["thanks.head"]}
      </h2>
      {rows.length > 0 && <p className="text-body-sm">{t["thanks.intro"]}</p>}
      <div className="mt-2 grid grid-cols-2 gap-x-4">
        {rows.map((k) => (
          <div key={k} className="min-w-0 border-t border-rule pt-1">
            <h3 className="text-body-sm font-semibold text-ink/75">{t[`thanks.${k}`]}</h3>
            {/* ph-no-capture (issue 549): each name's week of donations or quest points, in their order,
                never reaches session replay. */}
            <ol className="ph-no-capture text-body-sm">
              {view.thanks[k].map((x) => (
                <li key={x.uid} className="flex justify-between gap-2">
                  <span translate="no" className="min-w-0 truncate font-semibold">
                    {x.name}
                  </span>
                  <span className="tabular-nums">{f.compact(x.value)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {/* Issue 467: who improved in Alliance Duel, in name order, not a ranking; never who did not. */}
      {improved.length > 0 && (
        <div className="mt-4 border-t-2 border-rule pt-2">
          <h3 className="font-semibold">{t["thanks.improved"]}</h3>
          <p className="text-body-sm text-ink/75">{t["thanks.improvedWhy"]}</p>
          {/* ph-no-capture: names grouped by their Alliance Duel points never reach session replay. */}
          <ul className="ph-no-capture text-body-sm">
            {improved.map((name) => (
              <li key={name}>
                <bdi translate="no" className="font-semibold">
                  {name}
                </bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* D114: its own block under the top lists, with the share button. */}
      {progress.length > 0 && (
        <div className="mt-4 border-t-2 border-rule pt-2">
          <h3 className="font-semibold">{t["thanks.progress"]}</h3>
          <ul className="text-body-sm">
            {progress.map((p) => (
              <li key={p.uid}>
                <bdi translate="no" className="font-semibold">
                  {p.name}
                </bdi>{" "}
                {progressText(p, t)}
              </li>
            ))}
          </ul>
          <ShareThanks {...props.share} />
        </div>
      )}
    </section>
  );
}
