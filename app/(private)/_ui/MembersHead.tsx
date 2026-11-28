// The top of Members: "Send a screenshot" (D110) and the Members · Former members · Insights · Recruit check ·
// Requests switch (D107, issues 489, 833 and 868), moved out of the page for its size.
import { chip } from "@/lib/brand/components/controls";
import type { WorkspaceAccess } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import type { Feature } from "@/lib/workspace-features";

import { TabSend } from "./ToReview";

/** Members · Former members (D107) · Insights (issue 489) · Recruit check (issue 833), each when its switch is
 * on (`on`, D126): links, the open one pressed. */
export function ViewSwitch({
  slug,
  open,
  on,
  t,
}: {
  slug: string;
  open: "current" | "former" | "insights" | "recruit" | "requests";
  on: ReadonlySet<Feature>;
  t: WorkspaceDictionary;
}) {
  const link = (here: boolean, href: string, label: string) => (
    <a
      href={href}
      aria-current={here ? "page" : undefined}
      className={`${chip(here)} shrink-0 justify-center whitespace-nowrap`}
    >
      {label}
    </a>
  );
  return (
    // From 768 the rail and the sidebar list the views (D122, issue 720), so this switch is hidden there. One row that scrolls
    // sideways inside itself when it does not fit (DESIGN.md "Nothing short wraps").
    <nav aria-label={t["members.view.aria"]} className="mt-2 flex gap-2 overflow-x-auto md:hidden">
      {link(open === "current", `/w/${slug}/members`, t["members.view.current"])}
      {link(open === "former", `/w/${slug}/members?view=former`, t["members.view.former"])}
      {on.has("insights") &&
        link(open === "insights", `/w/${slug}/insights`, t["members.view.insights"])}
      {on.has("recruit_check") &&
        link(open === "recruit", `/w/${slug}/recruit`, t["members.view.recruit"])}
      {on.has("discord_join") && link(open === "requests", `/w/${slug}/requests`, t["join.view"])}
    </nav>
  );
}

export function MembersHead(props: {
  access: WorkspaceAccess;
  former: boolean;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { access, t } = props;
  return (
    <>
      <TabSend slug={access.slug} t={t} language={props.language} tab="members" />
      <ViewSwitch
        slug={access.slug}
        open={props.former ? "former" : "current"}
        on={access.features.on}
        t={t}
      />
    </>
  );
}
