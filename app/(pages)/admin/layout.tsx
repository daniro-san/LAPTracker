// /admin is for the owner: kept out of search (also Disallow in robots.txt) and linked from nowhere public.
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MASK_CLASS } from "@/lib/analytics/sanitise";

export const metadata: Metadata = {
  title: "Admin · Event Ledger",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Per-member values live here (D76): session replay masks every text, attribute, image and field under
  // this class, the PIN field included (D77).
  return <div className={MASK_CLASS}>{children}</div>;
}
