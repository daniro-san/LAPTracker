// GET /img/preview/player/[uid]: a player page's link preview (D65): the photo from the player's newest
// roster row inside that row's avatar frame, drawn as one square PNG. With no frame, or a frame that cannot
// be fetched or drawn, the photo alone as fetched. No photo: 404 (the page then keeps the site's preview).
import { ImageResponse } from "next/og";

import { getAppContext } from "@/lib/app-context";
import {
  AVATAR_CACHE,
  avatarSource,
  fetchImage,
  frameSource,
  type Image,
  imageResponse,
  logImageFailure,
  notFoundImage,
} from "@/lib/images";
import { findPhoto } from "@/lib/repo/alliance-snapshots";

/** Twice the 190 px frame file, so a phone's thumbnail stays sharp. */
const PX = 380;
/** The frame's hole: the middle 120 of 190 (D65). */
const HOLE = (PX * 120) / 190;
/** What the renderer decodes. */
const DRAWABLE = new Set(["image/png", "image/jpeg"]);
const ROUTE = "/img/preview/player";

const dataUri = (i: Image) => `data:${i.type};base64,${Buffer.from(i.body).toString("base64")}`;

/** The photo in the frame as a PNG, or null when either picture cannot be drawn. */
async function framed(photo: Image, frame: Image): Promise<Response | null> {
  if (!DRAWABLE.has(photo.type) || !DRAWABLE.has(frame.type)) return null;
  const inset = (PX - HOLE) / 2;
  try {
    const body = await new ImageResponse(
      <div style={{ display: "flex", position: "relative", width: PX, height: PX }}>
        <img
          src={dataUri(photo)}
          width={HOLE}
          height={HOLE}
          style={{
            position: "absolute",
            left: inset,
            top: inset,
            objectFit: "cover",
            borderRadius: 10,
          }}
          alt=""
        />
        <img
          src={dataUri(frame)}
          width={PX}
          height={PX}
          style={{ position: "absolute", left: 0, top: 0 }}
          alt=""
        />
      </div>,
      { width: PX, height: PX },
    ).arrayBuffer();
    return new Response(body, {
      headers: { "Content-Type": "image/png", "Cache-Control": AVATAR_CACHE },
    });
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
  const { uid } = await params;
  if (!/^\d{1,15}$/.test(uid)) return notFoundImage();
  const ctx = getAppContext();
  const { db, close } = ctx.openDb();
  try {
    const { avatarUrl, frameId } = await findPhoto(db, Number(uid));
    const source = avatarSource(avatarUrl);
    if (!source) return notFoundImage();
    const photo = await fetchImage(source, ctx.fetch);
    if (!("body" in photo)) {
      logImageFailure(ROUTE, uid, photo);
      return notFoundImage();
    }
    const frameUrl = frameId === null ? null : frameSource(frameId, ctx.env.LAP_SITE_BASE_URL);
    const frame = frameUrl ? await fetchImage(frameUrl, ctx.fetch) : null;
    if (frame && !("body" in frame)) logImageFailure(ROUTE, uid, frame);
    const drawn = frame && "body" in frame ? await framed(photo, frame) : null;
    return drawn ?? imageResponse(photo, AVATAR_CACHE);
  } catch {
    return notFoundImage();
  } finally {
    await close();
  }
}
