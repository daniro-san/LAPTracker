// Link preview image (Phase 5b): the mark large, in paper on plum. No text: the preview's own title
// carries the name, and the display serif is not available to the image renderer.
import { ImageResponse } from "next/og";

import { Mark } from "@/lib/brand/components/Logo";
import { tokenColor } from "@/lib/brand/palette";
import { copy } from "@/lib/copy";

export const alt = copy.site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: tokenColor("plum"),
        color: tokenColor("paper"),
      }}
    >
      <Mark size={440} />
    </div>,
    size,
  );
}
