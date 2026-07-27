import { expect, test } from "@playwright/test";

test("chat is the default mode and composer is usable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Portfolio", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Ask about my work." }),
  ).toBeVisible();
  await expect(page.getByLabel("Suggested questions")).toBeVisible();
  await expect(
    page.getByLabel("Ask about Pankit’s research portfolio"),
  ).toBeEditable();
});

test("real route switch preserves browser history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(
    page.getByRole("heading", { name: "Search. Remember. Verify. Act." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Portfolio", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Ask about my work." }),
  ).toBeVisible();
});

test("suggested question receives a grounded mock response", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  const send = page.getByRole("button", { name: "Send question" });
  await page
    .getByRole("button", { name: "Explain MemEquiv in simple terms." })
    .click();
  await expect(composer).toHaveValue("Explain MemEquiv in simple terms.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page.getByText("Explain MemEquiv in simple terms."),
  ).toBeVisible();
  await expect(page.getByText("Portfolio guide")).toBeVisible();
  await expect(page.getByLabel("Sources")).toBeVisible({ timeout: 15_000 });
});

test("verified MemEquiv and pending shortlist pages stay honest", async ({
  page,
}) => {
  await page.goto("/projects/memequiv");
  await expect(page.getByRole("heading", { name: "MemEquiv" })).toBeVisible();
  const repo = page.getByRole("link", { name: "View GitHub ↗" });
  await expect(repo).toHaveAttribute(
    "href",
    "https://github.com/pxnkit/memequiv",
  );
  await expect(
    page.getByRole("link", { name: "Ask about this project" }),
  ).toBeVisible();

  await page.goto("/projects/chaffmem");
  await expect(page.getByRole("heading", { name: "ChaffMem" })).toBeVisible();
  await expect(page.getByText("Rank 1 · Project 24")).toBeVisible();
  await expect(page.getByText("Verified details pending")).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: /repository on GitHub/i }),
  ).toHaveCount(0);
});

test("catalogue search and filters work locally", async ({ page }) => {
  await page.goto("/projects");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("memory correction");
  await expect(page.locator(".catalogue-summary")).toContainText("project");
  await search.fill("no-project-has-this-phrase");
  await expect(
    page.getByRole("heading", { name: "Try a broader research term." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Verification", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Verification", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("writing empty state and custom 404 are polished", async ({ page }) => {
  await page.goto("/writing");
  await expect(
    page.getByRole("heading", { name: "Research notes are being prepared." }),
  ).toBeVisible();
  await expect(page.getByText("No published articles yet")).toBeVisible();

  await page.goto("/this-route-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "This source is not in the index." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ask the portfolio guide" }),
  ).toBeVisible();
});

test("mobile layout has no body-level horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portfolio");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("link", { name: "Chat", exact: true }),
  ).toBeVisible();
});

test("skip link and composer support keyboard-only use", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  // Programmatic focus avoids engine/OS differences in whether Tab traverses
  // links unless Full Keyboard Access is enabled.
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  await composer.fill("What is MemEquiv?");
  await composer.press("Shift+Enter");
  await composer.type(" Include limitations.");
  await composer.press("Enter");
  await expect(page.getByText(/What is MemEquiv/)).toBeVisible();
});
