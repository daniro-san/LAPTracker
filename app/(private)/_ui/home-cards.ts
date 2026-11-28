// Home's notes after its digest (split from the page for size): D119's notice pictures due for the cleanup,
// D124's tracker key state, and the members' Discord channel's name for the thanks sheet (D129: the
// workspace's own, else the site's; never its webhook), and the members' "This is me" links waiting for an
// officer (D142). Issue 585: Follow-up's two numbers, read as soon as the members view is in. D154: the
// members who sent their own info and no officer has seen it yet. Issue 782: the What's new title this
// officer has not opened yet.
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/private/access";
import { channelNames } from "@/lib/private/discord-webhooks";
import { followUpCounts } from "@/lib/private/follow-up";
import { headroomWarning } from "@/lib/private/key-headroom";
import { linkReviews } from "@/lib/private/me-link";
import type { MembersView } from "@/lib/private/members";
import { picturesDue } from "@/lib/private/notice-picture-due";
import { reportReviews } from "@/lib/private/self-report";
import { trackerKeyView } from "@/lib/private/tracker-key";
import { whatsNewLine } from "@/lib/private/whats-new";

export async function cards(
  db: Db,
  access: WorkspaceAccess,
  clock: { now: Date; zone: string },
  members: Promise<MembersView>,
) {
  const { now, zone } = clock;
  const [due, keyRead, channel, links, followUp, reports, whatsNew] = await Promise.all([
    picturesDue(db, access, now, { SERVER_TZ: zone }),
    // Issue 869: the key's state, and a warning only when today's plan needs more than the key has left.
    trackerKeyView(db, access, getEnv(), now).then(async (v) => ({
      state: v.state,
      headroom: await headroomWarning(db, access, v, now),
    })),
    channelNames(db, access, getEnv()).then((c) => c.members),
    linkReviews(db, access),
    members.then((view) => followUpCounts(db, access, view, now, zone)),
    // D154: members who sent their own info, only those in the newest roster.
    members.then((view) =>
      reportReviews(db, access, new Map(view.members.map((m) => [m.uid, m.name]))),
    ),
    whatsNewLine(db, access),
  ]);
  const { state: key, headroom } = keyRead;
  return { due, key, headroom, channel, links, followUp, reports, whatsNew };
}
