// Pictures served at the size the pages draw them (07c S11): badges arrive as 300 × 300 PNGs and are shown
// at 28–40 px. `next/og` (already part of Next, no new dependency) redraws the image into a square PNG
// at twice the largest drawn size. PNG and JPEG only (what its renderer decodes); anything else, a
// failure, or a result no smaller than the original is served as fetched.
import { ImageResponse } from "next/og";

const DRAWABLE = new Set(["image/png", "image/jpeg"]);

export async function resizedResponse(
  image: { body: Uint8Array<ArrayBuffer>; type: string },
  px: number,
  fit: "contain" | "cover",
  cache: string,
): Promise<Response | null> {
  if (!DRAWABLE.has(image.type)) return null;
  try {
    const src = `data:${image.type};base64,${Buffer.from(image.body).toString("base64")}`;
    const drawn = new ImageResponse(
      <img src={src} width={px} height={px} style={{ objectFit: fit }} alt="" />,
      { width: px, height: px },
    );
    // Read it here, so a picture the renderer cannot decode falls back instead of failing mid-stream.
    const body = await drawn.arrayBuffer();
    // A small JPEG photo can grow as a PNG: then the original is the lighter file.
    if (body.byteLength >= image.body.byteLength) return null;
    return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": cache } });
  } catch {
    return null;
  }
}
