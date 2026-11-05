"use client";
// The player search form and its results (DESIGN.md `search-pending`). Submitting navigates inside a
// transition, so the header, title and field stay while the server looks the name up; if the new
// results take longer than HOLD_MS, the old ones give way to the Granny Doctor with her magnifier.
// Without JavaScript the form is a plain GET and the browser does the waiting.
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState, useTransition } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { GrannyLedger } from "@/lib/brand/components/Mascot";
import { copy } from "@/lib/copy";

const HOLD_MS = 300;

export function PlayerSearch({
  q,
  maxLength,
  children,
}: {
  q: string;
  maxLength: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Held back for HOLD_MS so a quick answer swaps the results without a flash of the drawing.
  const [held, setHeld] = useState(false);
  const waiting = pending && held;

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setHeld(true), HOLD_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("q") ?? "");
    setHeld(false);
    startTransition(() => router.push(`/players?${new URLSearchParams({ q: next })}`));
  }

  return (
    <>
      <form
        action="/players"
        method="get"
        role="search"
        onSubmit={onSubmit}
        className="my-3 flex gap-2"
      >
        <input
          key={q}
          type="search"
          name="q"
          defaultValue={q}
          maxLength={maxLength}
          placeholder={copy.search.placeholder}
          aria-label={copy.search.placeholder}
          className="drawn-field min-h-11 min-w-0 flex-1 px-3"
        />
        <button type="submit" className={buttonClass("primary")}>
          {copy.search.submit}
        </button>
      </form>
      <div role="status">
        {waiting && (
          <div className="flex flex-col items-center py-8 text-center">
            <GrannyLedger className="w-40 text-plum" />
            <p className="mt-3 max-w-[32ch] font-subhead text-display-sm font-semibold">
              {copy.search.pending}
            </p>
          </div>
        )}
      </div>
      {!waiting && children}
    </>
  );
}
