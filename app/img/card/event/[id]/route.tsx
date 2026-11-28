// GET /img/card/event/[id]: an event page's link preview card (issue 830, D164): its title, its day and the
// ledger's first rows, from the page's shared read.
import { eventCardRows } from "@/app/_ui/event-page";
import { eventTitle } from "@/app/_ui/EventLabel";
import { CARD_LOCALE, eventCard } from "@/app/_ui/link-card-facts";
import { getAppContext } from "@/lib/app-context";
import { discordClock } from "@/lib/discord-format";
import { notFoundImage } from "@/lib/images";
import { canonicalRedirect, linkCardResponse } from "@/lib/link-card";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const canonical = canonicalRedirect(request);
  if (canonical) return canonical;
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return notFoundImage();
  const read = await eventCardRows(Number(id));
  if (!read) return notFoundImage();
  const day = discordClock(getAppContext().env.SERVER_TZ).day(read.detail.eventAtUtc);
  const named = eventTitle(read.detail);
  return linkCardResponse(
    eventCard(named ?? day, named === null ? null : day, read.rows, CARD_LOCALE),
  );
}
