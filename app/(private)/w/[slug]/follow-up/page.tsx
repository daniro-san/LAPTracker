// /w/[slug]/follow-up (issue 340, D104): the leadership's weekly worklist. The members to look at this
// week under "Check in", "New" and "A tip to share" (D140), alphabetical in each, with a warm line for each
// reason and every fact still to ask by name; each row has one-tap "Talked to them", "Add a note" and a
// link to Members, and a tap on the person opens their panel (a sheet, beside the list from 1024, D122):
// why, a ready message in their language, what to fill in, how it went and the last notes. Then the
// thefts whose follow-up is still open, each linked to its entry in the thefts log. People first (D75):
// notes for the officers, nothing is sent, no ranking, a warm line when nobody is on it. Issue 585: the head
// leads with the week's two numbers, and "Noted this week" says who an officer already noted, by whom.
// Slice 2: "Needs help" comes first, each row saying since when, who and why, and last week's note is context.
import { getEnv } from "@/lib/env";
import { featureOn } from "@/lib/private/features";
import { followUpView, type FollowUpView } from "@/lib/private/follow-up";
import { cardFormats } from "@/lib/private/member-card";

import { editorWords } from "../../../_ui/facts-form";
import { groupsOf } from "../../../_ui/follow-up-groups";
import { followUpWords } from "../../../_ui/follow-up-words";
import { FollowUpList } from "../../../_ui/FollowUpList";
import { FollowUpFoot, FollowUpHead } from "../../../_ui/FollowUpWeek";
import { SignedInFrame } from "../../../_ui/Frame";
import { openRollCall } from "../../../_ui/roll-call-page";

export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await openRollCall<FollowUpView>(
    params,
    "follow-up",
    async (db, access, _today, _l, zone) => {
      const view = await followUpView(db, access, new Date(), zone);
      // D126: with the thefts log off, its section and links are left out (the thefts stay stored).
      return featureOn(access, "thefts") ? view : { ...view, thefts: [] };
    },
    "follow_up",
  );
  const { access, slug, t, language, today, data } = page;
  const f = cardFormats(language, page.zone, page.now);
  const groups = groupsOf(data.items, t, f, language);
  const open = (await searchParams).m;
  const editor = {
    slug,
    words: editorWords(t),
    shots: featureOn(access, "ocr"),
    language,
    serverZone: getEnv().SERVER_TZ,
    used: data.zones,
  };
  return (
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="review"
      waiting={page.waiting}
    >
      <FollowUpHead data={data} t={t} language={language} />
      {/* Always mounted, so the saved line with Undo stays after the last member leaves. */}
      <FollowUpList
        slug={slug}
        groups={groups}
        today={today}
        language={language}
        words={followUpWords(t)}
        editor={editor}
        initialOpen={typeof open === "string" ? open : null}
        foot={<FollowUpFoot slug={slug} data={data} t={t} f={f} />}
      />
    </SignedInFrame>
  );
}
