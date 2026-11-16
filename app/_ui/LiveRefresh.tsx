"use client";

// Refreshes the route once, at `at` (the next slot's sample is due plus a minute, computed on the server),
// not on a short fixed interval: samples change every 15 minutes (Neon Free). The refresh brings a new
// `at`, which re-arms the timer. A hidden tab holds no timer; on return it refreshes once if `at` passed.
// The server stops rendering this component when the event is no longer live, which stops it.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const due = Date.parse(at);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      timer = setTimeout(() => router.refresh(), Math.max(0, due - Date.now()));
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
  }, [at, router]);
  return null;
}
