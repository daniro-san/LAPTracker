// Alliance badges and player photos (DESIGN.md `alliance-badge`, `avatar`; DECISIONS D22). Both load
// from our own /img routes, lazily, with alt="" because the name is always printed beside them.
// Without a photo or badge the drawn placeholder stands in (lib/brand/components/Placeholders.tsx).
import { NoBadge, NoPhoto } from "@/lib/brand/components/Placeholders";

const BADGE = { sm: 28, md: 40 } as const;
const AVATAR = { sm: 32, lg: 56 } as const;
const SIZE = { 28: "size-7", 32: "size-8", 40: "size-10", 56: "size-14" } as const;

export function AllianceBadge({
  badgeId,
  size = "sm",
}: {
  badgeId: number | null | undefined;
  size?: keyof typeof BADGE;
}) {
  const n = BADGE[size];
  if (badgeId == null) return <NoBadge className={`${SIZE[n]} shrink-0 text-ink/45`} />;
  return (
    <img
      src={`/img/badge/${badgeId}`}
      alt=""
      width={n}
      height={n}
      loading="lazy"
      decoding="async"
      className={`${SIZE[n]} shrink-0 object-contain`}
    />
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
  return (
    <span
      className={`drawn-frame-soft inline-flex shrink-0 overflow-visible bg-paper text-ink/60 ${SIZE[n]}`}
      aria-hidden="true"
    >
      {hasAvatar ? (
        <img
          src={`/img/avatar/${uid}`}
          alt=""
          width={n}
          height={n}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <NoPhoto className="size-full text-ink/45" />
      )}
    </span>
  );
}
