"use client";

// Alliance badges and player photos (DESIGN.md `alliance-badge`, `avatar`; DECISIONS D22). Both load
// from our own /img routes, lazily, with alt="" because the name is always printed beside them.
// Without a photo or badge, or when the image does not load (the route answers 404 when the upstream
// picture cannot be fetched, D22), the drawn placeholder stands in (lib/brand/components/Placeholders.tsx),
// never the browser's broken-image icon. A client component: only `onError` can tell.
import { useState, type ReactNode } from "react";

import { NoBadge, NoPhoto } from "@/lib/brand/components/Placeholders";

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

export function PlayerAvatar({
  uid,
  hasAvatar,
  size = "sm",
}: {
  uid: number;
  hasAvatar: boolean;
  size?: keyof typeof AVATAR;
}) {
  const n = AVATAR[size];
  const noPhoto = <NoPhoto className="size-full text-ink/45" />;
  return (
    <Framed px={n}>
      {hasAvatar ? (
        <Picture
          src={`/img/avatar/${uid}`}
          n={n}
          className="size-full object-cover"
          fallback={noPhoto}
        />
      ) : (
        noPhoto
      )}
    </Framed>
  );
}
