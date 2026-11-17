// The top of Members: "Send a screenshot" (D110) and the Members · Former members switch (D107), moved out
// of the page for its size.
import { chip } from "@/lib/brand/components/controls";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { TabSend } from "./ToReview";

/** Members · Former members (D107): two links, the open one pressed. */
function ViewSwitch({
  slug,
  former,
  t,
}: {
  slug: string;
  former: boolean;
  t: WorkspaceDictionary;
}) {
  const link = (on: boolean, href: string, label: string) => (
    <a href={href} aria-current={on ? "page" : undefined} className={`${chip(on)} justify-center`}>
      {label}
    </a>
  );
  return (
    <nav aria-label={t["members.view.aria"]} className="mt-2 flex gap-2">
      {link(!former, `/w/${slug}/members`, t["members.view.current"])}
      {link(former, `/w/${slug}/members?view=former`, t["members.view.former"])}
    </nav>
  );
}

export function MembersHead(props: {
  slug: string;
  former: boolean;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const { slug, t } = props;
  return (
    <>
      <TabSend slug={slug} t={t} language={props.language} tab="members" />
      <ViewSwitch slug={slug} former={props.former} t={t} />
    </>
  );
}
