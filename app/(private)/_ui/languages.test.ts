// The language buttons (client) and the workspace's languages (server) are written twice: one list each.
import { expect, it } from "vitest";

import { WORKSPACE_LANGUAGES } from "@/lib/private/dictionary";

import { LANGUAGE_CHOICES } from "./languages";

it("offers a button for every workspace language, in the same order", () => {
  expect(LANGUAGE_CHOICES.map((c) => c.id)).toEqual([...WORKSPACE_LANGUAGES]);
});
