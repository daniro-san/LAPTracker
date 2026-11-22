// The check-in line Home and Members show (issue 585), rendered on the server: Follow-up's two numbers,
// linked to Follow-up, while its tab is on; Members' own count of its "Check in and Needs help" group, linked
// to that group, while the tab is off (D126: no link to a turned-off tab).
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { WeekCounts } from "@/lib/private/follow-up";
import { weekCountLine } from "@/lib/private/follow-up-rules";
import type { MembersView } from "@/lib/private/members";
import { needsAWord, whoOf } from "@/lib/private/members-list";
import { type Formats } from "@/lib/private/members-sheet";
import { fill, plural } from "@/lib/words";

import { LINK } from "./BoardText";

/** The line's words and where it leads; null when there is nothing to say. */
export function checkInLink(
  slug: string,
  view: MembersView,
  followUp: WeekCounts | null,
  t: WorkspaceDictionary,
  f: Formats,
): { text: string; href: string } | null {
  if (followUp) {
    const text = weekCountLine(followUp, t, f.language);
    return text === null ? null : { text, href: `/w/${slug}/follow-up` };
  }
  const n = view.members.filter((m) => needsAWord(whoOf(m))).length;
  if (n === 0) return null;
  const text = fill(
    plural(
      n,
      { one: t["members.checkinCount.one"], other: t["members.checkinCount.other"] },
      f.language,
    ),
    { n },
  );
  return { text, href: `/w/${slug}/members?order=rank#ml-heading` };
}

/** Members' head line: the check-in link, or "Everyone looks fine this week." (`none`). */
export function CheckInLine(props: {
  check: ReturnType<typeof checkInLink>;
  none: string;
  className: string;
}) {
  const { check } = props;
  return (
    <p className={props.className}>
      {check === null ? (
        props.none
      ) : (
        <a href={check.href} className={`${LINK} py-2`}>
          {check.text}
        </a>
      )}
    </p>
  );
}
