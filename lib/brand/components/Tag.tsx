// A tag (DESIGN.md "Workspace components"): a word that describes, never one to tap. Flat: label type, no
// frame, no fill, no 44 px box, so it cannot be mistaken for a button. `neutral` is sage (a source, "For
// members", "Every week"); `attention` is yarn, the workspace's "needs a look" (an open theft); `progress`
// is plum, something under way (a theft talked about).
import type { ReactNode } from "react";

const TONE = { neutral: "text-sage", attention: "text-yarn", progress: "text-plum" } as const;

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONE;
  children: ReactNode;
}) {
  return (
    <span className={`text-label font-semibold whitespace-nowrap ${TONE[tone]}`}>{children}</span>
  );
}
