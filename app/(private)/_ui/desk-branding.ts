// The desk's branding for this request (issue 462, D167): the layout's metadata and wrapper and the frame's
// header icon each read it, one small query on the request's own connection (no cache shared between
// requests, issue 471). Public on purpose, so no session is needed. Null for a bad slug.
import { withPageDb } from "@/lib/page";
import { workspaceBranding } from "@/lib/private/branding";
import { SLUG } from "@/lib/private/sign-in";

export const deskBranding = async (slug: string, fallback: string) =>
  SLUG.test(slug) ? withPageDb((db) => workspaceBranding(db, slug, fallback)) : null;
