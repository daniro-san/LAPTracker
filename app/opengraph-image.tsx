// Link preview image (Phase 5b): the line mark in paper on plum, with the product name under it in Alegreya
// 400, read from the TTF in lib/brand/fonts/ (the renderer takes TTF, not next/font's WOFF2), as
// lib/event-image.tsx does.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { MarkLine } from "@/lib/brand/components/Logo";
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: tokenColor("plum"),
        color: tokenColor("paper"),
      }}
    >
      <MarkLine size={340} />
      <div style={{ fontFamily: "Alegreya", fontSize: 96, lineHeight: 1 }}>{copy.site.name}</div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Alegreya",
          data: readFileSync(join(process.cwd(), "lib/brand/fonts/Alegreya-Regular.ttf")),
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
}
