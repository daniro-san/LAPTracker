// Page footer: the ledger's byline on the right and one corner ornament at the bottom left, out of the
// content's way (DESIGN.md ornament budget): the yarn ball by default, the Granny Doctor on the error
// and player pages. Under the byline, the build line (D58): release or branch and short commit, inlined
// by next.config.ts, then the build time in the page's clock like every other date.
import { GrannyStanding } from "@/lib/brand/components/Mascot";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import type { Dictionary } from "@/lib/copy";

import type { Clock } from "./format";

export function SiteFooter({
  ornament = "yarn",
  clock,
  copy,
}: {
  ornament?: "yarn" | "granny";
  /** The page's clock; null in the client error boundaries, which then show no build time. */
  clock: Clock | null;
  copy: Dictionary;
}) {
  const builtAt = process.env.BUILD_AT;
  const build = [process.env.BUILD_LABEL, builtAt && clock ? clock.at(new Date(builtAt)) : null];
  return (
    <footer
      className={`relative mx-auto mt-8 max-w-[960px] px-4 text-plum sm:px-6 ${ornament === "granny" ? "h-36" : "h-28"}`}
    >
      <hr className="drawn-rule mb-4 text-plum/40" />
      <p className="text-right text-body-sm text-ink/70">
        {copy.site.ledger} · {copy.site.byline}
      </p>
      <p className="mt-1 text-right text-xs text-ink/65 tabular-nums">
        {build.filter(Boolean).join(" · ")}
      </p>
      {ornament === "granny" ? (
        <GrannyStanding className="absolute bottom-2 left-2 w-20" />
      ) : (
        <YarnCorner className="absolute bottom-2 left-0" />
      )}
    </footer>
  );
}
