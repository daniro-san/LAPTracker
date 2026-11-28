import type { Metadata } from "next";

import { CARD_SIZE } from "@/lib/link-card";

/** A page's link preview as the large card (issue 830, D164): the picture our own /img/card route draws, and
 * the page's title and facts as og:title and og:description, so chat apps show both when the link is pasted. */
export const cardPreview = (
  url: string,
  title: string,
  description: string,
): Pick<Metadata, "openGraph" | "twitter"> => ({
  openGraph: { title, description, images: [{ url, ...CARD_SIZE, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [{ url, alt: title }] },
});
