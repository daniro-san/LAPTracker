// Favicon and the 192/512 px app icons (Phase 5b): the mark in paper on a plum square, from
// lib/brand/components/Logo.tsx: the solid mark at 32 px, the line mark at 192/512 px (two cuts, DESIGN.md
// "Mark"). The large sizes keep the mark inside the maskable safe zone (80 %).
import { ImageResponse } from "next/og";

import { Mark, MarkLine } from "@/lib/brand/components/Logo";
import { tokenColor } from "@/lib/brand/palette";

const SIZES = [32, 192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((s) => ({
    id: String(s),
    size: { width: s, height: s },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  const mark = size <= 32 ? size : Math.round(size * 0.66);
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
      {size <= 32 ? <Mark size={mark} /> : <MarkLine size={mark} />}
    </div>,
    { width: size, height: size },
  );
}
