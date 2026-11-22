// The desk's navigation at tablet widths (issue 720): every page the sidebar lists at 1280 (destinations,
// their views and "See what members see") is a visible link of the side rail at 768 and at 1024, with the
// same words and address. The list comes from the sidebar itself, so a view added there is checked here too.
import { ALLIANCES } from "./fixtures/seed";
import { expect, signIn, test } from "./fixtures/test";

const desk = `/w/${ALLIANCES.a.slug}`;

test("every page the sidebar lists is on the rail at 768 and 1024", async ({ page, context }) => {
  await signIn(context, "a", "officer");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(desk);
  const nav = page.getByRole("navigation", { name: "Sections" });
  // Each link's words (its label, Home's count left out) and address.
  const links = await nav.getByRole("link").evaluateAll((els) =>
    els.map((a) => ({
      name: (a.querySelector("span:not([aria-hidden]):not(.sr-only)") ?? a).textContent?.trim(),
      href: a.getAttribute("href") ?? "",
    })),
  );
  expect(links.map((l) => l.name)).toEqual(
    expect.arrayContaining(["Former members", "Insights", "Caravans", "Notices", "Thefts"]),
  );
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const { name, href } of links) {
      const link = nav.locator(`a[href="${href}"]`);
      await expect(link, `${name} at ${width}`).toBeVisible();
      await expect(link).toContainText(name ?? "");
    }
  }
});
