import { copy } from "@/lib/copy";

import { EmptyState } from "./EmptyState";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function EmptyEvents() {
  return (
    <>
      <SiteHeader events={[]} currentId={null} />
      <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 text-center">
        <h1 className="sr-only">{copy.site.name}</h1>
        <EmptyState>{copy.empty.kettle}</EmptyState>
        <p className="text-ink/70">
          The first snapshot is taken shortly before the next Saturday event.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
