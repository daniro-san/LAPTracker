// Where a refused visitor of a workspace page goes (D71, D73, D99): no such workspace is a 404; a session
// past its end or waiting for its role check goes through Discord again without a click; a blocked account
// goes to the no-access page. A member's session goes to the members' board, the only page it opens (D105).
// A visitor who is signed out (or signed in to another workspace) goes to Home, which shows the sign-in.
// Each sign-in carries `path`, the page asked for, so it returns there.
import { notFound, redirect } from "next/navigation";

import type { Refusal } from "@/lib/private/access";
import { returnPath } from "@/lib/private/sign-in";

/** `?next=<path>` for a page other than Home, else "". */
export function nextQuery(slug: string, path: string | null | undefined): string {
  const back = returnPath(slug, path);
  return back && back !== `/w/${slug}` ? `next=${encodeURIComponent(back)}` : "";
}

/** Home calls it with its own path and then shows the sign-in; every other page is sent on from here. */
export function refuse(slug: string, reason: Refusal["reason"], path = `/w/${slug}`): void {
  if (reason === "no_workspace") notFound();
  if (reason === "member") redirect(`/w/${slug}/board`);
  const next = nextQuery(slug, path);
  if (reason === "expired") redirect(`/api/w/${slug}/login?silent=1${next && `&${next}`}`);
  if (reason === "blocked") redirect(`/w/${slug}/no-access?why=blocked`);
  if (path !== `/w/${slug}`) redirect(`/w/${slug}${next && `?${next}`}`);
}
