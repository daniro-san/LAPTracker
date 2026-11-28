// The desk's branding for this request (issue 462, D167), read once per page view: the layout's metadata and
// wrapper and the frame's header icon share it. React's `cache` lasts one request only (the issue 471 rule
// keeps it out of app/(private), lib/private and lib/repo for that reason, so this is a module of its own).
// Public on purpose, so no session is needed. Null for a bad slug.
import { cache } from "react";

import { withPageDb } from "./page";
import { workspaceBranding } from "./repo/workspace-branding";
import { WORKSPACE_SLUG } from "./repo/workspaces";

export const deskBranding = cache(async (slug: string, fallback: string) =>
  WORKSPACE_SLUG.test(slug) ? withPageDb((db) => workspaceBranding(db, slug, fallback)) : null,
);
