// Where a number comes from (issue 312, prototype v5): from the game, from a photo, or typed by an
// officer. A small framed word in the source's tone, the same on the Members page and in the first-use steps.
const TONE = { game: "text-sage", photo: "text-yarn", officer: "text-plum" } as const;

export function SourceBadge({ source, label }: { source: keyof typeof TONE; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-xs border border-current px-2 text-[12px] leading-5 font-semibold whitespace-nowrap ${TONE[source]}`}
    >
      {label}
    </span>
  );
}
