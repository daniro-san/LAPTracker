// What the desk's import routes accept (issue 299), checked at the boundary: pictures as their OCR text
// lines, an officer's pick of type, and a draft's save, discard or change of type.
import { z } from "zod";

import { MAX_PICTURES } from "./import";
import { SCOPED, type ImportKind, type Scope, type Screen } from "./import-kinds";
import { SAVED_KINDS } from "./import-save";

const kind = z.string().refine((k): k is ImportKind => SAVED_KINDS.includes(k as ImportKind));
const scope = z.enum(["daily", "weekly"]).nullable();

/** The kind with the tab it can have: Alliance Duel and Donation are daily or weekly (weekly when unsaid). */
export const screenOf = (k: ImportKind, s: Scope | null): Screen => ({
  kind: k,
  scope: SCOPED.includes(k) ? (s ?? "weekly") : null,
});

export const createBody = z
  .object({
    pictures: z
      .array(z.object({ lines: z.array(z.string().max(400)).max(400) }).strict())
      .min(1)
      .max(MAX_PICTURES),
    pick: z.object({ kind, scope }).strict().optional(),
    /** Lines from Members' "Paste updates" (D109), not a picture's text. */
    pasted: z.literal(true).optional(),
    // The type of the tab's button the pictures were sent with (D110).
    preset: kind.optional(),
  })
  .strict();

const uid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** A row's member: a game uid, or a pending member's (minus its serial id, D106). */
const rowUid = z
  .number()
  .int()
  .min(-2147483647)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((n) => n !== 0);

export const actionBody = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      version: z.number().int().positive(),
      scope,
      day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat"]).nullable(),
      weekBefore: z.boolean(),
      rows: z
        .array(
          z
            .object({
              // A member, or the name of a new member not in the roster yet (D106): one of the two.
              uid: rowUid.optional(),
              newName: z.string().trim().min(1).max(64).optional(),
              value: z.number().int().min(0).max(1e13),
              // A member update: the fact and the version the officer saw (D80).
              field: z.enum(["squadMight", "adTech"]).optional(),
              version: z.number().int().min(0).optional(),
            })
            .strict()
            .refine((r) => (r.uid === undefined) !== (r.newName === undefined)),
        )
        .max(500),
      // A Secret Ops report: whose it is (a member, or nobody known) and each entry kept, by row.
      report: z
        .object({
          victimUid: uid.nullable(),
          entries: z
            .array(
              z
                .object({
                  row: z.number().int().min(0),
                  name: z.string().max(64),
                  // What was taken, typed from the report's pictures of the items (D97).
                  items: z.string().max(200).optional(),
                })
                .strict(),
            )
            .max(200),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z.object({ action: z.literal("discard"), version: z.number().int().positive() }).strict(),
  z
    .object({ action: z.literal("retype"), version: z.number().int().positive(), kind, scope })
    .strict(),
]);
