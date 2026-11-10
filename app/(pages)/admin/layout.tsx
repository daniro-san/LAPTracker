// /admin is for the owner: kept out of search (also Disallow in robots.txt) and linked from nowhere public.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin · Event Ledger",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
