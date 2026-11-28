// D162 (owner, 2026-11-28): while a workspace made before plans is grandfathered, Home tells its officers
// until when it keeps every feature, with a link to the Plans page (44 px). Home is officers only (a member's
// session goes to the board), so members never see it. OGs is never grandfathered: it keeps everything.
import { TextLink } from "@/lib/brand/components/TextLink";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { deletionDate } from "./Frame";

/** "Your alliance keeps every feature … until 28 Feb 2027. …": the UTC day with its year (a sentence end). */
export function grandfatheredLine(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  until: Date,
): string {
  return fill(t["plans.current.grandfathered"], { date: deletionDate(until, language) });
}

export function GrandfatherNotice(props: {
  slug: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  until: Date | null;
}) {
  if (!props.until) return null;
  return (
    <p className="mb-4 border-l-4 border-plum pl-3">
      {grandfatheredLine(props.t, props.language, props.until)}{" "}
      <TextLink
        href={`/w/${props.slug}/settings/plans`}
        className="inline-flex min-h-11 items-center"
      >
        {props.t["plans.see"]}
      </TextLink>
    </p>
  );
}
