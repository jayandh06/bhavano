import { test as base, expect } from "@playwright/test";

/** `test` with the one thing every spec needs: the seeded demo user has no email, so the "Add your email" prompt opens over the page after a
 * moment and blocks every click behind it (seen on GitHub's slower runners: it made the header/footer and post-ad city checks time out on
 * a click). The handler dismisses it whenever it shows up; Playwright runs it before the next action that is blocked. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addLocatorHandler(page.getByRole("button", { name: "Not now" }), (button) => button.click());
    await use(page);
  },
});

export { expect };
