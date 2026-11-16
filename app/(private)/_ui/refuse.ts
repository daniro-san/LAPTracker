// Where a refused visitor of a workspace page goes (D71, D73): no such workspace is a 404, an expired
// session goes through Discord again without a click, a blocked account to the no-access page. A visitor
// who is signed out (or signed in to another workspace) returns: each page shows or links the sign-in.
import { notFound, redirect } from "next/navigation";

import type { Refusal } from "@/lib/private/access";

export function refuse(slug: string, reason: Refusal["reason"]): void {
  if (reason === "no_workspace") notFound();
  if (reason === "expired") redirect(`/api/w/${slug}/login?silent=1`);
  if (reason === "blocked") redirect(`/w/${slug}/no-access?why=blocked`);
}
