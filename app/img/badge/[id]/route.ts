// GET /img/badge/[id]: an alliance's preset emblem (101–110) from the tracker site, cached for good (D22).
import { getAppContext } from "@/lib/app-context";
import { BADGE_CACHE, badgeSource, fetchImage, imageResponse, notFoundImage } from "@/lib/images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ctx = getAppContext();
  const source = /^\d{3}$/.test(id) ? badgeSource(Number(id), ctx.env.LAP_SITE_BASE_URL) : null;
  if (!source) return notFoundImage();
  const image = await fetchImage(source, ctx.fetch);
  return image ? imageResponse(image, BADGE_CACHE) : notFoundImage();
}
