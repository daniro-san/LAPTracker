// Page footer: the ledger's byline on the right and one corner ornament at the bottom left, out of the
// content's way (DESIGN.md ornament budget): the yarn ball by default, the Granny Doctor on the error
// and player pages. Under the byline, the live version (D59), inlined at build time by next.config.ts.
import { GrannyStanding } from "@/lib/brand/components/Mascot";
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import type { Dictionary } from "@/lib/copy";

export function SiteFooter({
  ornament = "yarn",
  copy,
}: {
  ornament?: "yarn" | "granny";
  copy: Dictionary;
}) {
  return (
    <footer
      className={`relative mx-auto mt-8 max-w-[960px] px-4 text-plum sm:px-6 ${ornament === "granny" ? "min-h-36 pb-28 sm:pb-0" : "min-h-28 pb-20 sm:pb-0"}`}
    >
      <hr className="drawn-rule mb-4 text-plum/40" />
      <p className="text-right text-body-sm text-ink/70">
        {copy.site.ledger} · {copy.site.byline}
      </p>
      <p className="mt-1 ml-auto max-w-[60ch] text-right text-xs text-ink/65">
        {copy.site.disclaimer}
      </p>
      <p className="mt-1 text-right text-xs text-ink/65 tabular-nums">
        {process.env.BUILD_VERSION}
      </p>
      {ornament === "granny" ? (
        <GrannyStanding className="absolute bottom-2 left-2 w-20" />
      ) : (
        <YarnCorner className="absolute bottom-2 left-0" />
      )}
    </footer>
  );
}
