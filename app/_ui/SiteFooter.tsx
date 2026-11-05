// Page footer: the ledger's byline on the right, the page's one yarn corner (DESIGN.md ornament budget)
// at the bottom left, out of the content's way. Error pages pass corner={false}: their vignette is
// already the page's ornament.
import { YarnCorner } from "@/lib/brand/components/YarnCorner";
import { copy } from "@/lib/copy";

export function SiteFooter({ corner = true }: { corner?: boolean }) {
  return (
    <footer
      className={`relative mx-auto mt-8 max-w-[960px] px-4 text-plum sm:px-6 ${corner ? "h-28" : "pb-8"}`}
    >
      <p className="text-right text-body-sm text-ink/70">
        {copy.site.ledger} · {copy.site.byline}
      </p>
      {corner && <YarnCorner className="absolute bottom-2 left-0" />}
    </footer>
  );
}
