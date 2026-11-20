// /w/invite and /w/request, a new alliance's pages (D130): like a workspace's, not indexed, no link preview,
// and masked in session replay (D77), since they show Discord names and server names.
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MASK_CLASS } from "@/lib/analytics/sanitise";

export const metadata: Metadata = {
  title: "Officers’ Desk",
  description: "Private.",
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <div className={MASK_CLASS}>{children}</div>;
}
