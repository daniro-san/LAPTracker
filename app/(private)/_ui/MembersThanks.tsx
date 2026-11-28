// The Members page's thanks box (issues 296, 347, 404, 465), rendered on the server: top donors, then who
// helped and did quests every day this week (names only), then progress this week in name order, not a
// ranking (D109), with "Share the thanks" under it (D114).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { progressText, type CardFormats } from "@/lib/private/member-card";
import type { MembersView } from "@/lib/private/members";

import type { ShareThanksProps } from "./share-thanks-data";
import { ShareThanks } from "./ShareThanks";

/** A group of names in name order, no numbers, never who is missing (D75). */
function NameGroup(props: { title: string; why: string; names: string[] }) {
  return (
    <div className="mt-4 border-t-2 border-rule pt-2">
      <h3 className="font-semibold">{props.title}</h3>
      <p className="text-body-sm text-ink/75">{props.why}</p>
      {/* ph-no-capture: names grouped by their coins, quests or Alliance Duel points never reach session
          replay. */}
      <ul className="ph-no-capture text-body-sm">
        {props.names.map((name) => (
          <li key={name}>
            <bdi translate="no" className="font-semibold">
              {name}
            </bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The top donors with their week's donations, as the game shows them. */
function Donors(props: { title: string; donors: MembersView["thanks"]["donors"]; f: CardFormats }) {
  return (
    <div className="mt-2 min-w-0 border-t border-rule pt-1">
      <h3 className="text-body-sm font-semibold text-ink/75">{props.title}</h3>
      {/* ph-no-capture (issue 549): each name's week of donations, in their order, never reaches session
          replay. */}
      <ol className="ph-no-capture text-body-sm">
        {props.donors.map((x) => (
          <li key={x.uid} className="flex justify-between gap-2">
            <span translate="no" className="min-w-0 truncate font-semibold">
              {x.name}
            </span>
            <span className="tabular-nums">{props.f.compact(x.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MembersThanks(props: {
  view: MembersView;
  t: WorkspaceDictionary;
  f: CardFormats;
  share: ShareThanksProps;
}) {
  const { view, t, f } = props;
  const donors = view.thanks.donors;
  const { help, quests } = view.thanks.steady;
  const improved = view.thanks.improved;
  const people = props.share.people;
  if (donors.length + help.length + quests.length + people.length + improved.length === 0)
    return null;
  return (
    <section aria-labelledby="thanks" className="drawn-card mt-4 px-4 py-3">
      <h2 id="thanks" className="font-subhead text-display-sm">
        {t["thanks.head"]}
      </h2>
      {donors.length + help.length + quests.length + improved.length > 0 && (
        <p className="text-body-sm">{t["thanks.intro"]}</p>
      )}
      {donors.length > 0 && <Donors title={t["thanks.donors"]} donors={donors} f={f} />}
      {/* Issue 465: every day with a read, in name order, not a ranking; days with no read never count. */}
      {help.length > 0 && (
        <NameGroup
          title={t["thanks.help"]}
          why={t["thanks.helpWhy"]}
          names={help.map((x) => x.name)}
        />
      )}
      {quests.length > 0 && (
        <NameGroup
          title={t["thanks.quests"]}
          why={t["thanks.questsWhy"]}
          names={quests.map((x) => x.name)}
        />
      )}
      {/* Issue 467: who improved in Alliance Duel, in name order, not a ranking; never who did not. */}
      {improved.length > 0 && (
        <NameGroup title={t["thanks.improved"]} why={t["thanks.improvedWhy"]} names={improved} />
      )}
      {/* D114: its own block under the top lists, with the share button. */}
      {people.length > 0 && (
        <div className="mt-4 border-t-2 border-rule pt-2">
          {view.thanks.progress.length > 0 && (
            <>
              <h3 className="font-semibold">{t["thanks.progress"]}</h3>
              <ul className="text-body-sm">
                {view.thanks.progress.map((p) => (
                  <li key={p.uid}>
                    <bdi translate="no" className="font-semibold">
                      {p.name}
                    </bdi>{" "}
                    {progressText(p, t)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <ShareThanks {...props.share} />
        </div>
      )}
    </section>
  );
}
