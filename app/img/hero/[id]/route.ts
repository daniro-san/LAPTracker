// GET /img/hero/[id]: a hero's picture from the tracker site's static files (D117), only for an id in our
// stored hero catalog, so the route is never an open proxy and the browser never loads the tracker.
// Drawn at twice the card's 40 px.
import { getAppContext } from "@/lib/app-context";
import { HERO_CACHE, heroSource } from "@/lib/heroes";
import { fetchImage, imageResponse, logImageFailure, notFoundImage } from "@/lib/images";
import { isCatalogHero } from "@/lib/repo/hero-catalog";

import { resizedResponse } from "../../resize";

const HERO_PX = 80;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return notFoundImage();
  const ctx = getAppContext();
  const { db, close } = ctx.openDb();
  try {
    const source = (await isCatalogHero(db, Number(id)))
      ? heroSource(Number(id), ctx.env.LAP_SITE_BASE_URL)
      : null;
    if (!source) return notFoundImage();
    const image = await fetchImage(source, ctx.fetch);
    if (!("body" in image)) {
      logImageFailure("/img/hero", id, image);
      return notFoundImage();
    }
    return (
      (await resizedResponse(image, HERO_PX, "contain", HERO_CACHE)) ??
      imageResponse(image, HERO_CACHE)
    );
  } catch {
    return notFoundImage();
  } finally {
    await close();
  }
}
