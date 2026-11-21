// Home's "Board reach" (D145, issue 484): a margin note with how many members opened the members' board in
// the last 7 days, from PostHog. An async server component that Home streams
// inside Suspense, so PostHog never holds up the page. No key, PostHog down, or under 5 members: nothing.
import { getAppContext } from "@/lib/app-context";
import { MarginNote } from "@/lib/brand/components/layout/MarginNote";
import { fill } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/private/access";
import { boardReach } from "@/lib/private/board-reach";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { LINK } from "./BoardText";

/** The members' board's line (D145): shown while the desk can show the reach, it says what officers see. */
export function ReachLine({ t }: { t: WorkspaceDictionary }) {
  return (
    <p className="mt-8 border-t border-rule pt-3 text-body-sm text-ink/75">
      {t["board.reach.members"]}
    </p>
  );
}

export async function BoardReach({
  access,
  t,
  language,
}: {
  access: WorkspaceAccess;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const visitors = await boardReach(getEnv(), getAppContext().fetch, access);
  if (visitors === null) return null;
  return (
    <MarginNote id="home-reach" title={t["board.reach.head"]}>
      <div className="py-2">
        <p>{fill(t["board.reach.visitors"], { n: visitors.toLocaleString(language) })}</p>
        <a href={`/w/${access.slug}/board`} className={LINK}>
          {t["board.seeMembers"]}
        </a>
      </div>
      <p className="py-2 text-body-sm text-ink/75">{t["board.reach.note"]}</p>
    </MarginNote>
  );
}
