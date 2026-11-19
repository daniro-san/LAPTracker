// Home's "On the desk now" line and "Recent activity" feed (D108). Server-rendered: the line sits under the
// title, the feed closes the page. The feed's first page is made here; ActivityFeed reads the next pages
// and opens a run's lines in place (2026-11-18).
import type { ActivityPageView } from "@/lib/private/desk-activity-words";
import { namesList } from "@/lib/private/desk-activity-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { ActivityFeed } from "./ActivityFeed";

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

/** The newest things officers did, newest first; older pages under "Show more". */
export function RecentActivity(props: {
  slug: string;
  first: ActivityPageView;
  t: WorkspaceDictionary;
}) {
  const { first, t } = props;
  return (
    <section aria-labelledby="home-activity" className="drawn-card mt-4 px-4 py-3">
      <h2 id="home-activity" className="font-subhead text-display-sm">
        {t["activity.head"]}
      </h2>
      {first.lines.length === 0 ? (
        <p className="mt-1">{t["activity.none"]}</p>
      ) : (
        <ActivityFeed
          slug={props.slug}
          first={first}
          words={{
            more: t["activity.more"],
            less: t["activity.less"],
            failed: t["activity.moreFailed"],
          }}
        />
      )}
    </section>
  );
}
