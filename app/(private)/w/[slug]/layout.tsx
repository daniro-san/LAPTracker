// /w/[slug], an alliance's workspace (D71). The metadata is static and nothing is read here, so a link
// pasted in Discord previews no private data; each page checks access before it reads anything.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Officers’ Desk",
  description: "Private.",
  robots: { index: false, follow: false },
  // No preview card: these drop the root opengraph-image, so /w pages carry no og: or twitter: tag
  // (checked in the rendered head of a production build, D73).
  openGraph: null,
  twitter: null,
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}
