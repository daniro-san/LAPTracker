// GET /img/card/event/[id]/alliance/[unionId]: an alliance-in-an-event page's link preview card (issue 830,
// D164): its totals with their change and its rank, from the event page's shared read.
import { eventCardRows } from "@/app/_ui/event-page";
import { allianceCard, CARD_LOCALE } from "@/app/_ui/link-card-facts";
import { getAppContext } from "@/lib/app-context";
import { copy } from "@/lib/copy";
import { discordClock } from "@/lib/discord-format";
import { notFoundImage } from "@/lib/images";
import { linkCardResponse } from "@/lib/link-card";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; unionId: string }> },
): Promise<Response> {
  const { id, unionId } = await params;
  if (!/^\d{1,9}$/.test(id) || !/^\d{1,15}$/.test(unionId)) return notFoundImage();
  const read = await eventCardRows(Number(id));
  const row = read?.rows.find((r) => r.unionId === Number(unionId));
  if (!read || !row) return notFoundImage();
  const day = discordClock(getAppContext().env.SERVER_TZ).day(read.detail.eventAtUtc);
  return linkCardResponse(allianceCard(row, day, copy, CARD_LOCALE));
}
