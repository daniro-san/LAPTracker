// A notice's picture (D119): the caps the browser resizes to and the server checks again, and the browser's
// resize plan (pure, browser-safe: the canvas work is in app/(private)/_ui/notice-picture-prep.ts).

/** The most a stored picture may weigh: 400 KB. */
export const MAX_PICTURE_BYTES = 400 * 1024;
/** The longest side a stored picture may have, in pixels. */
export const MAX_PICTURE_SIDE = 1600;
/** The formats the server stores; the browser sends WebP, or JPEG where it cannot encode WebP. */
export const PICTURE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type PictureType = (typeof PICTURE_TYPES)[number];

/** The qualities tried in turn, best first, until the file fits MAX_PICTURE_BYTES. */
export const QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46] as const;
/** When the lowest quality still does not fit, the picture is made this much smaller and tried again. */
export const SHRINK = 0.8;
/** The smallest long side the plan goes down to before it gives up. */
export const MIN_SIDE = 320;

/** What a page needs to draw a stored picture: its address, versioned by the bytes' hash, and its size. */
export interface PictureView {
  src: string;
  width: number;
  height: number;
  /** "Keep" (D119): who kept it and when; only on the desk's notice reads. */
  kept?: {
    by: string | null;
    at: Date;
    /** The day it was kept, as words on the server's clock, made by the page (issue 585 batch 4). */
    on?: string;
  } | null;
}

export const pictureView = (p: {
  noticeId: number;
  hash: string;
  width: number;
  height: number;
}): PictureView => ({
  src: `/img/notice/${p.noticeId}?v=${p.hash}`,
  width: p.width,
  height: p.height,
});

export interface Attempt {
  width: number;
  height: number;
  quality: number;
}

/** `width` × `height` brought within `max` on its long side, proportions kept; never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_PICTURE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The encodes to try for a picture of `width` × `height`, in order: each quality at 1600 px on the long
 * side, then each quality at 80 % of that, and so on down to MIN_SIDE. The browser stops at the first that
 * fits MAX_PICTURE_BYTES.
 */
export function attempts(width: number, height: number): Attempt[] {
  const out: Attempt[] = [];
  let side = Math.min(MAX_PICTURE_SIDE, Math.max(width, height));
  for (;;) {
    const size = fitWithin(width, height, side);
    for (const quality of QUALITIES) out.push({ ...size, quality });
    if (side <= MIN_SIDE) return out;
    side = Math.max(MIN_SIDE, Math.round(side * SHRINK));
  }
}
