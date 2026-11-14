// GET /img/frame/[id]: an avatar frame from the tracker site, cached for good (D65). Served as fetched:
// the file is 190 × 190 and pages draw it at up to 89 px, so a redraw would save nothing.
import { getAppContext } from "@/lib/app-context";
import {
  FRAME_CACHE,
  fetchImage,
  frameSource,
  imageResponse,
  logImageFailure,
  notFoundImage,
} from "@/lib/images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ctx = getAppContext();
  const source = /^\d{1,9}$/.test(id) ? frameSource(Number(id), ctx.env.LAP_SITE_BASE_URL) : null;
  if (!source) return notFoundImage();
  const image = await fetchImage(source, ctx.fetch);
  if (!("body" in image)) {
    logImageFailure("/img/frame", id, image);
    return notFoundImage();
  }
  return imageResponse(image, FRAME_CACHE);
}
