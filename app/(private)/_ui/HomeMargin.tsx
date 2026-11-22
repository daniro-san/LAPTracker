// Home's margin column (D122), split from the page for size: recent activity with who is on the desk now
// (D108), the members box with the thanks and Follow-up's two numbers (issue 585), then the board's reach
// (D145). Rendered on the server.
import { Suspense } from "react";

import type { WorkspaceAccess } from "@/lib/private/access";
import type { ActivityPage } from "@/lib/private/desk-activity";
import { activityView } from "@/lib/private/desk-activity-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn, thanksSwitches } from "@/lib/private/features";
import type { MembersView } from "@/lib/private/members";

import { BoardReach } from "./BoardReach";
import { OnDesk, RecentActivity } from "./DeskActivity";
import type { cards } from "./home-cards";
import { HomeMembers } from "./HomeMembers";

/**
 * D108: the other officers on the desk now, and what officers did lately; D119: the notice pictures the
 * weekly cleanup deletes soon; D124: the alliance's own tracker key; issue 585: Follow-up's two numbers (`cards`).
 */
export type HomeDesk = {
  names: string[];
  activity: ActivityPage;
  now: Date;
} & Awaited<ReturnType<typeof cards>>;

export function HomeMargin(props: {
  access: WorkspaceAccess;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  view: MembersView;
  desk: HomeDesk;
  /** Sunday or Monday, and the week's thanks not shared yet (D114). */
  nudge: boolean;
}) {
  const { t, language, desk, access } = props;
  return (
    <>
      <RecentActivity
        slug={access.slug}
        first={activityView(desk.activity, t, language, desk.now)}
        t={t}
        lead={<OnDesk names={desk.names} t={t} language={language} />}
      />
      <HomeMembers
        slug={access.slug}
        t={t}
        language={language}
        view={props.view}
        nudge={props.nudge}
        switches={{ ...thanksSwitches(access), channel: desk.channel }}
        followUp={desk.followUp}
      />
      {/* D145: the board's reach from PostHog, streamed; nothing while the board is off. */}
      {featureOn(access, "board") && (
        <Suspense fallback={null}>
          <BoardReach access={access} t={t} language={language} />
        </Suspense>
      )}
    </>
  );
}
