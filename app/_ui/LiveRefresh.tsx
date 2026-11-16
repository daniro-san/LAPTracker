"use client";

// Refreshes the route once, `at` minus `renderedAt` after it was rendered (the next slot's sample is due
// plus a minute; both times are the server's clock, so a client clock that is ahead or behind does not
// matter), not on a short fixed interval: samples change every 15 minutes (Neon Free). Every render brings
// a new `renderedAt`, which re-arms the timer even when `at` is unchanged (a refresh that came back
// before the sample was there). A hidden tab holds no timer; on return it refreshes once if the wait is
// over. The server stops rendering this component when the event is no longer live, which stops it.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The shortest wait: a render that is already past `at` retries in a second, not in a tight loop. */
const MIN_WAIT_MS = 1000;

export function LiveRefresh({ at, renderedAt }: { at: string; renderedAt: string }) {
  const router = useRouter();
  useEffect(() => {
    const deadline = Date.now() + Math.max(MIN_WAIT_MS, Date.parse(at) - Date.parse(renderedAt));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(() => router.refresh(), Math.max(0, deadline - Date.now()));
    };
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [at, renderedAt, router]);
  return null;
}
