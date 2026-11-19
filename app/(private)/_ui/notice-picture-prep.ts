// A notice's picture in the browser (D119): decoded, drawn at most 1600 px on its long side and re-encoded as
// WebP (JPEG where the browser cannot encode WebP), the quality stepped down, then the size, until the file
// fits 400 KB. Re-encoding through a canvas drops EXIF and the location the phone may have written. The plan
// itself is pure, in lib/private/notice-picture-rules.ts; this file is the canvas work and the two requests.
import {
  attempts,
  fitWithin,
  MAX_PICTURE_BYTES,
  type PictureView,
} from "@/lib/private/notice-picture-rules";
import { pictureSize } from "@/lib/screenshot/picture-size";

import { isSignedOut, post } from "./screenshot-upload";

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The header's size: the first 256 KB hold it for every JPEG, WebP and PNG a phone makes. */
const HEADER_BYTES = 256 * 1024;

/**
 * Whether a JPEG's EXIF orientation (5 to 8) turns it a quarter turn: the browser applies it before it
 * resizes, so the header's width and height swap.
 */
function quarterTurn(b: Uint8Array): boolean {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let at = 2; at + 10 < b.length && b[at] === 0xff; at += 2 + v.getUint16(at + 2)) {
    if (b[at + 1] !== 0xe1 || String.fromCharCode(...b.subarray(at + 4, at + 8)) !== "Exif")
      continue;
    const tiff = at + 10;
    const little = b[tiff] === 0x49;
    const ifd = tiff + v.getUint32(tiff + 4, little);
    for (let i = 0; i < v.getUint16(ifd, little); i++) {
      const entry = ifd + 2 + i * 12;
      if (v.getUint16(entry, little) === 0x0112) return v.getUint16(entry + 8, little) >= 5;
    }
  }
  return false;
}

/** The size to decode at, from the header (a quarter-turned JPEG's swapped); null when none is needed. */
async function uploadSize(
  file: File,
): Promise<{ resizeWidth: number; resizeHeight: number } | null> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const raw = pictureSize(head);
  const turned = raw && head[0] === 0xff && quarterTurn(head);
  const size = turned ? { width: raw.height, height: raw.width } : raw;
  const fit = size && fitWithin(size.width, size.height);
  return fit && size.width > fit.width
    ? { resizeWidth: fit.width, resizeHeight: fit.height }
    : null;
}

/**
 * The file decoded straight at its upload size when its header says it (a 48 MP photo is never decoded at
 * full size on a low-end phone, review of PR 422), else as it is.
 */
async function decode(file: File): Promise<ImageBitmap | null> {
  // Odd metadata never blocks a good photo: without a size read, the file is decoded as it is.
  const size = await uploadSize(file).catch(() => null);
  const resized = size
    ? await createImageBitmap(file, { ...size, resizeQuality: "high" }).catch(() => null)
    : null;
  return resized ?? createImageBitmap(file).catch(() => null);
}

/** The picture ready to upload, or null when it cannot be read or made small enough. */
export async function preparePicture(file: File): Promise<Blob | null> {
  const bitmap = await decode(file).catch(() => null);
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

/**
 * Why a picture write failed: "deleted", the notice is in the trash (410 notice_deleted, D118);
 * "notices.picture.unusable", the server refused this picture (413, 415, 422): try another one.
 */
export type PictureFailure =
  "signedOut.text" | "notices.picture.failed" | "notices.picture.unusable" | "deleted";

const status = (e: unknown) => (e instanceof Error ? e.message : "");

function failure(e: unknown): PictureFailure {
  if (isSignedOut(e)) return "signedOut.text";
  if (status(e) === "410") return "deleted";
  return ["413", "415", "422"].includes(status(e))
    ? "notices.picture.unusable"
    : "notices.picture.failed";
}

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
