// The top of Members: "Send a screenshot" (D110) and the Members · Former members · Insights switch (D107,
// issue 489), moved out of the page for its size.
import { chip } from "@/lib/brand/components/controls";
import type { WorkspaceAccess } from "@/lib/private/access";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";

import { TabSend } from "./ToReview";

/** Members · Former members (D107) · Insights (issue 489, when on): links, the open one pressed. */
export function ViewSwitch({
  slug,
  open,
  insights,
  t,
}: {
  slug: string;
  open: "current" | "former" | "insights";
  insights: boolean;
  t: WorkspaceDictionary;
}) {
  const link = (on: boolean, href: string, label: string) => (
    <a
      href={href}
      aria-current={on ? "page" : undefined}
      className={`${chip(on)} shrink-0 justify-center whitespace-nowrap`}
    >
      {label}
    </a>
  );
  return (
    // From 1280 the sidebar lists the views (D122), so this switch is hidden there. One row that scrolls
    // sideways inside itself when it does not fit (DESIGN.md "Nothing short wraps").
    <nav aria-label={t["members.view.aria"]} className="mt-2 flex gap-2 overflow-x-auto xl:hidden">
      {link(open === "current", `/w/${slug}/members`, t["members.view.current"])}
      {link(open === "former", `/w/${slug}/members?view=former`, t["members.view.former"])}
      {insights && link(open === "insights", `/w/${slug}/insights`, t["members.view.insights"])}
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
        insights={featureOn(access, "insights")}
        t={t}
      />
    </>
  );
}
