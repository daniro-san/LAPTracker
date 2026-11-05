import { SiteHeader } from "./SiteHeader";

export function EmptyEvents() {
  return (
    <>
      <SiteHeader events={[]} currentId={null} />
      <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 text-center">
        <h1 className="text-xl font-bold">Nothing recorded yet. The kettle is on.</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          The first snapshot is taken shortly before the next Saturday event.
        </p>
      </main>
    </>
  );
}
