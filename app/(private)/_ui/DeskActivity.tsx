// Home's "On the desk now" line and "Recent activity" feed (D108). Server-rendered: the line sits under the
// title, the feed closes the page. "Show more" is a <details>, so it works without script and is never
// hover-only; its summary is a 44 px target.
import type { ActivityItem } from "@/lib/private/desk-activity";
import { ACTIVITY_SHOWN } from "@/lib/private/desk-activity";
import { activityAgo, activityLine, namesList } from "@/lib/private/desk-activity-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

/** "On the desk now: Ana and Wren", or "Nobody else right now." */
export function OnDesk(props: {
  names: string[];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { names, t } = props;
  return (
    <p className="mt-2 text-body-sm">
      <span className="font-semibold text-ink/75">{t["desk.now"]}</span>
      <span aria-hidden="true"> · </span>
      {names.length > 0 ? (
        <span translate="no" className="font-semibold">
          {namesList(names, props.language)}
        </span>
      ) : (
        <span className="text-ink/75">{t["desk.alone"]}</span>
      )}
    </p>
  );
}

function Lines(props: {
  items: ActivityItem[];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  now: Date;
}) {
  return (
    <ul className="mt-1 divide-y divide-rule">
      {props.items.map((item, i) => (
        <li key={`${item.at.getTime()}-${i}`} className="py-2">
          {activityLine(item, props.t)}
          <span className="whitespace-nowrap text-body-sm text-ink/70">
            {" · "}
            <time dateTime={item.at.toISOString()}>
              {activityAgo(item.at, props.now, props.language, props.t)}
            </time>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The newest things officers did, newest first; the rest under "Show more". */
export function RecentActivity(props: {
  items: ActivityItem[];
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  now: Date;
}) {
  const { items, t } = props;
  const first = items.slice(0, ACTIVITY_SHOWN);
  const more = items.slice(ACTIVITY_SHOWN);
  return (
    <section aria-labelledby="home-activity" className="mt-4 border border-rule px-4 py-3">
      <h2 id="home-activity" className="font-subhead text-display-sm">
        {t["activity.head"]}
      </h2>
      {items.length === 0 ? (
        <p className="mt-1">{t["activity.none"]}</p>
      ) : (
        <Lines {...props} items={first} />
      )}
      {more.length > 0 && (
        <details className="group border-t border-rule">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-plum underline underline-offset-4 group-open:hidden">
            {t["activity.more"]}
          </summary>
          <Lines {...props} items={more} />
        </details>
      )}
    </section>
  );
}
