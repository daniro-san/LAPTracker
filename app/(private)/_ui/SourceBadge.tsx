// Where a number comes from (issue 312, prototype v5): from the game, from a photo, typed by an officer,
// and for member facts (issue 297) from a message or from the sheet. A small framed word in the source's
// tone, the same on the Members page and in the first-use steps.
const TONE = {
  game: "text-sage",
  photo: "text-yarn",
  officer: "text-plum",
  message: "text-yarn",
  sheet: "text-ink/75",
} as const;

export function SourceBadge({ source, label }: { source: keyof typeof TONE; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-xs border border-current px-2 text-[12px] leading-5 font-semibold whitespace-nowrap ${TONE[source]}`}
    >
      {label}
    </span>
  );
}
