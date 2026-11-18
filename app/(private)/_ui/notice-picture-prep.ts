// A notice's picture in the browser (D119): decoded, drawn at most 1600 px on its long side and re-encoded as
// WebP (JPEG where the browser cannot encode WebP), the quality stepped down, then the size, until the file
// fits 400 KB. Re-encoding through a canvas drops EXIF and the location the phone may have written. The plan
// itself is pure, in lib/private/notice-picture-rules.ts; this file is the canvas work and the two requests.
import { attempts, MAX_PICTURE_BYTES, type PictureView } from "@/lib/private/notice-picture-rules";

import { isSignedOut, post } from "./screenshot-upload";

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The picture ready to upload, or null when it cannot be read or made small enough. */
export async function preparePicture(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  // A browser that cannot encode WebP gives a PNG back instead: then JPEG is used.
  let type = "image/webp";
  try {
    if (!context) return null;
    for (const a of attempts(bitmap.width, bitmap.height)) {
      if (canvas.width !== a.width || canvas.height !== a.height) {
        canvas.width = a.width;
        canvas.height = a.height;
        context.drawImage(bitmap, 0, 0, a.width, a.height);
      }
      let blob = await encode(canvas, type, a.quality);
      if (blob && blob.type !== type) {
        type = "image/jpeg";
        blob = await encode(canvas, type, a.quality);
      }
      if (blob && blob.size <= MAX_PICTURE_BYTES) return blob;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export type PictureFailure = "signedOut.text" | "notices.picture.failed";

const failure = (e: unknown): PictureFailure =>
  isSignedOut(e) ? "signedOut.text" : "notices.picture.failed";

/** Uploads the prepared picture to notice `id`; its address and size, or why not. */
export async function uploadPicture(
  slug: string,
  id: number,
  blob: Blob,
): Promise<{ picture: PictureView } | { failed: PictureFailure }> {
  try {
    const picture = (await post(
      `/api/w/${slug}/notices/picture?id=${id}`,
      blob,
      blob.type,
    )) as PictureView;
    return { picture };
  } catch (e) {
    return { failed: failure(e) };
  }
}

/** Removes notice `id`'s picture. */
export async function removePicture(
  slug: string,
  id: number,
): Promise<{ failed?: PictureFailure }> {
  try {
    await post(`/api/w/${slug}/notices/picture/remove`, JSON.stringify({ id }), "application/json");
    return {};
  } catch (e) {
    return { failed: failure(e) };
  }
}
