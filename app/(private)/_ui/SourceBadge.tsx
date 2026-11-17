// Where a number comes from (issue 312, prototype v5): from the game, from a photo, typed by an officer,
// and for member facts (issue 297) from a message or from the sheet. A neutral tag (DESIGN.md "Workspace
// components"), the same on the Members page and in the first-use steps: the word names the source, and
// no source takes yarn, which in the workspace means "needs a look".
import { Tag } from "@/lib/brand/components/Tag";

type Source = "game" | "photo" | "officer" | "message" | "sheet";

export function SourceBadge({ label }: { source: Source; label: string }) {
  return <Tag>{label}</Tag>;
}
