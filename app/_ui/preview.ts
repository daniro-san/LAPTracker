import type { Metadata } from "next";

/** A page's link preview as a small square picture beside the title (the "summary" card): the alliance's
 * badge or the player's photo, through our own image routes (D22). A page without one keeps the site's. */
export const previewImage = (
  url: string,
  alt: string,
): Pick<Metadata, "openGraph" | "twitter"> => ({
  openGraph: { images: [{ url, alt }] },
  twitter: { card: "summary", images: [{ url, alt }] },
});
