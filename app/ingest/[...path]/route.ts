// /ingest/* — PostHog's same-origin reverse proxy (D77). What is forwarded, and why not a rewrite:
// lib/analytics/ingest.ts.
import { forwardToPostHog } from "@/lib/analytics/ingest";

export const GET = forwardToPostHog;
export const POST = forwardToPostHog;
