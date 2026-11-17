// /w/[slug], an alliance's workspace (D71). Nothing is read here, so a link pasted in Discord previews no
// private data; each page checks access before it reads anything. The desk's own manifest (D110) replaces
// the public site's, so the desk installs as "Officers' Desk" and opens the desk.
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MASK_CLASS } from "@/lib/analytics/sanitise";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return { ...METADATA, manifest: `/w/${(await params).slug}/manifest.webmanifest` };
}

const METADATA: Metadata = {
  title: "Officers’ Desk",
  description: "Private.",
  robots: { index: false, follow: false },
  // No preview card: these drop the root opengraph-image, so /w pages carry no og: or twitter: tag
  // (checked in the rendered head of a production build, D73).
  openGraph: null,
  twitter: null,
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  // Session replay masks every text, attribute, image and field under this class (D77).
  return <div className={MASK_CLASS}>{children}</div>;
}
