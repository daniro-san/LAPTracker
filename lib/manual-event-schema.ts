// The manual round's name and visibility as the routes accept them (D28): one definition for create and rename.
import { z } from "zod";

/** Plain text, 1–80 characters, no control characters. */
export const manualName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\p{Cc}]+$/u);

export const manualVisibility = z.enum(["admin", "standalone", "history"]);
