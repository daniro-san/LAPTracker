// GET /img/avatar/[uid]: the player's photo, looked up in our own roster rows and fetched only from
// the photo host. The upstream URL never leaves the server (D22).
import { getAppContext } from "@/lib/app-context";
import {
  AVATAR_CACHE,
  avatarSource,
  fetchImage,
  imageResponse,
  logImageFailure,
  notFoundImage,
} from "@/lib/images";
import { findAvatarUrl } from "@/lib/repo/alliance-snapshots";

import { resizedResponse } from "../../resize";

/** Twice the largest drawn photo (56 px beside the player page title). */
const AVATAR_PX = 112;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> },
): Promise<Response> {
  const { uid } = await params;
  if (!/^\d{1,15}$/.test(uid)) return notFoundImage();
  const ctx = getAppContext();
  const { db, close } = ctx.openDb();
  try {
    const source = avatarSource(await findAvatarUrl(db, Number(uid)));
    if (!source) return notFoundImage();
    const image = await fetchImage(source, ctx.fetch);
    if (!("body" in image)) {
      logImageFailure("/img/avatar", uid, image);
      return notFoundImage();
    }
    return (
      (await resizedResponse(image, AVATAR_PX, "cover", AVATAR_CACHE)) ??
      imageResponse(image, AVATAR_CACHE)
    );
  } catch {
    return notFoundImage();
  } finally {
    await close();
  }
}
