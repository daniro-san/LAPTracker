// What a desk page shows at its own address when the site's owner turned its feature off for the alliance
// (D126): the page's name, one calm line, that nothing was deleted, and the way back to Home. The tab is
// gone from the navigation; this answers an old link or a bookmark.
import { createElement } from "react";

import type { WorkspaceAccess } from "@/lib/private/access";
import type { WorkspaceKey } from "@/lib/private/dictionary";
import type { Feature } from "@/lib/workspace-features";

import type { DeskView } from "./DeskNav";
import { SignedInFrame, workspaceWords } from "./Frame";
import type { TabId } from "./TabIcon";

/** The features that have pages of their own, by the name the desk already gives each page. */
export type PageFeature = Extract<
  Feature,
  "roll_call" | "garrison" | "thefts" | "follow_up" | "caravans" | "notices" | "board"
>;
const NAME: Record<PageFeature, WorkspaceKey> = {
  roll_call: "tab.mark",
  garrison: "garrison.title",
  thefts: "thefts.nav",
  follow_up: "tab.review",
  caravans: "calendar.nav.caravans",
  notices: "calendar.nav.notices",
  board: "features.name.board",
};
/** The destination or view each page sits under. */
const CURRENT: Record<PageFeature, TabId | DeskView> = {
  roll_call: "mark",
  garrison: "days",
  thefts: "thefts",
  follow_up: "review",
  caravans: "caravans",
  notices: "notices",
  board: "days",
};

export async function TurnedOff({
  access,
  feature,
  waiting,
}: {
  access: WorkspaceAccess;
  feature: PageFeature;
  waiting: number;
}) {
  const { language, t } = await workspaceWords();
  const current = CURRENT[feature];
  return (
    <SignedInFrame access={access} language={language} t={t} current={current} waiting={waiting}>
      <h1 className="font-display text-display-lg">{t[NAME[feature]]}</h1>
      <section className="drawn-card mt-4 max-w-xl px-4 py-3" role="status">
        <p className="font-semibold">{t["features.off.page"]}</p>
        <p className="mt-2 text-body-sm text-ink/80">{t["features.off.kept"]}</p>
        <a
          href={`/w/${access.slug}`}
          className="mt-1 inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
        >
          {t["features.off.home"]}
        </a>
      </section>
    </SignedInFrame>
  );
}

/** The page to show instead when `feature` is off for the workspace, or null; for the page openers. */
export const turnedOffPage = (access: WorkspaceAccess, feature: PageFeature, waiting: number) =>
  access.features.on.has(feature) ? null : createElement(TurnedOff, { access, feature, waiting });
