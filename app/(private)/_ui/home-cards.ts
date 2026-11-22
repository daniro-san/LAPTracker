// Home's notes after its digest (split from the page for size): D119's notice pictures due for the cleanup,
// D124's tracker key state, and the members' Discord channel's name for the thanks sheet (D129: the
// workspace's own, else the site's; never its webhook), and the members' "This is me" links waiting for an
// officer (D142). Issue 585: Follow-up's two numbers, read as soon as the members view is in.
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/private/access";
import { channelNames } from "@/lib/private/discord-webhooks";
import { followUpCounts } from "@/lib/private/follow-up";
import { linkReviews } from "@/lib/private/me-link";
import type { MembersView } from "@/lib/private/members";
import { picturesDue } from "@/lib/private/notice-picture-due";
import { trackerKeyView } from "@/lib/private/tracker-key";

export async function cards(
  db: Db,
  access: WorkspaceAccess,
  clock: { now: Date; zone: string },
  members: Promise<MembersView>,
) {
  const { now, zone } = clock;
  const [due, key, channel, links, followUp] = await Promise.all([
    picturesDue(db, access, now, { SERVER_TZ: zone }),
    trackerKeyView(db, access, getEnv(), now).then((v) => v.state),
    channelNames(db, access, getEnv()).then((c) => c.members),
    linkReviews(db, access),
    members.then((view) => followUpCounts(db, access, view, now, zone)),
  ]);
  return { due, key, channel, links, followUp };
}
