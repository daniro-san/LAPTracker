// The members' board for Lantern Keep's member, whose "This is me" link an officer approved (D142): their own
// page, and the desk closed to them (D105).
import { ALLIANCES, LINKED_MEMBER } from "./fixtures/seed";
import { expect, signIn, test } from "./fixtures/test";

const A = ALLIANCES.a;
const linked = A.names[LINKED_MEMBER] as string;

test.beforeEach(async ({ context }) => {
  await signIn(context, "a", "member");
});

test("Me: the member's own page, with their own numbers only", async ({ page }) => {
  await page.goto(`/w/${A.slug}/board/me`);
  await expect(page.getByRole("heading", { name: "Your page" })).toBeVisible();
  await expect(page.getByText(`In the game, you are ${linked}.`)).toBeVisible();
  await expect(page.getByText("Your progress")).toBeVisible();
  // Raid prep marked this member "No shield" (the seed's Shield mark for them).
  await expect(page.getByText(/Raid prep, .*: No shield/)).toBeVisible();
  for (const other of A.names.filter((n) => n !== linked)) {
    await expect(page.getByText(other)).toHaveCount(0);
  }
});

test("a member's session opens the board, not the desk", async ({ page }) => {
  await page.goto(`/w/${A.slug}/members`);
  await expect(page).toHaveURL(new RegExp(`/w/${A.slug}/board`));
  await expect(page.getByText(A.names[0] as string)).toHaveCount(0);
});
