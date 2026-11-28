// GET /img/card/alliance/[unionId]: an alliance page's link preview card (issue 830, D164): its name and its
// ranks board line's Might and Kills with their rank, from a shared read.
import { allianceLabel } from "@/app/_ui/format";
import { boardCard, CARD_LOCALE } from "@/app/_ui/link-card-facts";
import { sharedAllianceCard } from "@/app/_ui/public-reads";
import { copy } from "@/lib/copy";
import { notFoundImage } from "@/lib/images";
import { linkCardResponse } from "@/lib/link-card";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unionId: string }> },
): Promise<Response> {
  const { unionId } = await params;
  if (!/^\d{1,15}$/.test(unionId)) return notFoundImage();
  const read = await sharedAllianceCard(Number(unionId));
  if (!read) return notFoundImage();
  const label = allianceLabel(read.tag ?? unionId, read.name);
  return linkCardResponse(boardCard(label, read.board, copy, CARD_LOCALE));
}
