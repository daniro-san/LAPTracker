// Home's "On the desk now" line and "Recent activity" feed (D108). Server-rendered: one margin note of
// Home's spread (D122), the line as its first row, then the feed. The feed's first page is made here; ActivityFeed reads the next pages
// and opens a run's lines in place (2026-11-18).
import type { ReactNode } from "react";

import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
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
    <p className="py-2 text-body-sm">
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
  /** The row above the feed: "On the desk now". */
  lead: ReactNode;
}) {
  const { first, t } = props;
  return (
    <MarginNote id="home-activity" title={t["activity.head"]}>
      {props.lead}
      {first.lines.length === 0 ? (
        <p className="py-2">{t["activity.none"]}</p>
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
    </MarginNote>
  );
}
