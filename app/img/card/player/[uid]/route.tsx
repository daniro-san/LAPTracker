// GET /img/card/player/[uid]: a player page's link preview card (issue 830, D164), from the page's shared read.
import { CARD_LOCALE, playerCard } from "@/app/_ui/link-card-facts";
import { sharedPlayer } from "@/app/_ui/public-reads";
import { copy } from "@/lib/copy";
import { notFoundImage } from "@/lib/images";
import { canonicalRedirect, linkCardResponse } from "@/lib/link-card";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
  const canonical = canonicalRedirect(request);
  if (canonical) return canonical;
  const { uid } = await params;
  if (!/^\d{1,15}$/.test(uid)) return notFoundImage();
  const player = await sharedPlayer(Number(uid));
  if (!player) return notFoundImage();
  return linkCardResponse(playerCard(player.history, copy, CARD_LOCALE));
}
