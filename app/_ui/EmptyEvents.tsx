import { EmptyState } from "./EmptyState";
import { requestCopy } from "./locale";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export async function EmptyEvents() {
  const copy = await requestCopy();
  return (
    <>
      <SiteHeader events={[]} currentId={null} homeId={null} copy={copy} />
      <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 text-center">
        <h1 className="sr-only">{copy.site.name}</h1>
        <EmptyState>{copy.empty.kettle}</EmptyState>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
