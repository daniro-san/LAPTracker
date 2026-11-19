"use client";

// Alliance badges and player photos (DESIGN.md `alliance-badge`, `avatar`; docs/decisions/D22). Both load
// from our own /img routes, lazily, with alt="" because the name is always printed beside them.
// Without a photo or badge, or when the image does not load (the route answers 404 when the upstream
// picture cannot be fetched, D22), the drawn placeholder stands in (lib/brand/components/Placeholders.tsx),
// never the browser's broken-image icon. A client component: only `onError` can tell.
import { useState, type ReactNode } from "react";

import { NoBadge, NoPhoto } from "@/lib/brand/components/Placeholders";
import type { Photo } from "@/lib/queries";

const BADGE = { sm: 28, md: 40 } as const;
const AVATAR = { sm: 32, lg: 56 } as const;
const SIZE = { 28: "size-7", 32: "size-8", 40: "size-10", 56: "size-14" } as const;

/** The soft drawn frame every picture sits in, like the chips and controls. */
function Framed({ px, children }: { px: keyof typeof SIZE; children: React.ReactNode }) {
  return (
    <span
      className={`drawn-frame-soft inline-flex shrink-0 bg-paper text-ink/60 ${SIZE[px]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/** The image, or `fallback` once it has failed. An image that failed before hydration is caught by the
 * ref check, because React never sees its `error` event. */
function Picture({
  src,
  n,
  className,
  fallback,
}: {
  src: string;
  n: number;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return (
    <img
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setFailed(true);
      }}
      src={src}
      alt=""
      width={n}
      height={n}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export function AllianceBadge({
  badgeId,
  size = "sm",
}: {
  badgeId: number | null | undefined;
  size?: keyof typeof BADGE;
}) {
  const n = BADGE[size];
  const noBadge = <NoBadge className="size-full p-px text-ink/45" />;
  return (
    <Framed px={n}>
      {badgeId == null ? (
        noBadge
      ) : (
        <Picture
          src={`/img/badge/${badgeId}`}
          n={n}
          className="size-full object-contain p-px"
          fallback={noBadge}
        />
      )}
    </Framed>
  );
}

/** The game's frame around the photo (D65). The photo sits in the frame's hole, the middle 120 × 120 of
 * the 190 × 190 frame. Small: the box is 190/120 of the 32 px photo, so the photo keeps its size. Large:
 * 80 px (a 50 px photo), not 89, so a long name beside it still fits one line at 360 px. */
const IN_FRAME = {
  sm: { px: 51, box: "size-[51px]" },
  lg: { px: 80, box: "size-20" },
} as const;

export function PlayerAvatar({
  uid,
  photo: { hasAvatar, frameId },
  size = "sm",
}: {
  uid: number;
  /** A frameId of null keeps the drawn frame (rows stored before frames). */
  photo: Photo;
  size?: keyof typeof AVATAR;
}) {
  const n = AVATAR[size];
  const noPhoto = <NoPhoto className="size-full text-ink/45" />;
  const picture = hasAvatar ? (
    <Picture
      src={`/img/avatar/${uid}`}
      n={n}
      className="size-full object-cover"
      fallback={noPhoto}
    />
  ) : (
    noPhoto
  );
  if (frameId === null) return <Framed px={n}>{picture}</Framed>;
  const framed = IN_FRAME[size];
  return (
    <span className={`relative inline-flex shrink-0 ${framed.box}`} aria-hidden="true">
      <span className="absolute inset-[18.4%] flex overflow-hidden rounded-[3px] bg-paper">
        {picture}
      </span>
      {/* A frame that fails to load leaves the photo alone, never a broken-image icon. */}
      <Picture
        src={`/img/frame/${frameId}`}
        n={framed.px}
        className="absolute inset-0 size-full"
        fallback={null}
      />
    </span>
  );
}

/**
 * A hero's picture (D117) at 40 px; a hero outside the catalog, or a picture that fails, is a plain box.
 * `frame` is the rarity's border class (SR blue, SSR purple, UR gold), when the rarity is known.
 */
export function HeroPicture({
  id,
  known,
  frame,
}: {
  id: number;
  known: boolean;
  frame?: string | undefined;
}) {
  const box = `size-10 shrink-0 rounded-[3px] ${frame ?? ""}`;
  const placeholder = <span aria-hidden="true" className={`${box} border border-rule`} />;
  if (!known) return placeholder;
  return (
    <Picture
      src={`/img/hero/${id}`}
      n={40}
      className={`${box} object-contain`}
      fallback={placeholder}
    />
  );
}
