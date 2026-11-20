// The shape every route handler shares (plan §11.1: auth → parse → call lib → respond): one DB
// connection per request, closed on every path; errors become a code, never a message.
import type { z } from "zod";

import { getAppContext, type AppContext } from "./app-context";
import { recordAppError } from "./app-errors";
import type { Db } from "./db";

export const errorResponse = (status: number, code: string): Response =>
  Response.json({ code }, { status });

type Handler = (ctx: AppContext, db: Db) => Promise<Response>;

/** Under /api/w/[slug], `slug` puts the workspace on the error's PostHog event (issue 452). */
export async function withContext(route: string, handler: Handler): Promise<Response>;
export async function withContext(route: string, slug: string, handler: Handler): Promise<Response>;
export async function withContext(
  route: string,
  ...rest: [Handler] | [string, Handler]
): Promise<Response> {
  const [slug, handler] = rest.length === 1 ? [undefined, rest[0]] : rest;
  const ctx = getAppContext();
  const { db, close } = ctx.openDb();
  try {
    return await handler(ctx, db);
  } catch (error) {
    await recordAppError(ctx, { route, kind: "route", digest: null, error, ...(slug && { slug }) });
    return errorResponse(500, "internal");
  } finally {
    await close();
  }
}

/** The query string through `schema` (strict: unknown keys fail); null when it doesn't parse. */
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.infer<T> | null {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(query);
  return result.success ? result.data : null;
}
