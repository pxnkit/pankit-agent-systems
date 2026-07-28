import { expect, test } from "@playwright/test";

test("portfolio has no full-width one-pixel color artifact", async ({
  page,
}) => {
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  const artifacts = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          selector:
            element.id || element.className || element.tagName.toLowerCase(),
          width: rect.width,
          height: rect.height,
          background: style.backgroundColor,
          borderTop: style.borderTopColor,
        };
      })
      .filter(
        (item) =>
          item.width >= viewportWidth * 0.9 &&
          item.height > 0 &&
          item.height <= 1.5 &&
          [item.background, item.borderTop].some((color) =>
            /rgb\((?:0,\s*255,\s*0|0,\s*2\d\d,\s*\d{1,2})\)/.test(color),
          ),
      );
  });
  expect(artifacts).toEqual([]);
});

test("portfolio desktop visual remains stable", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chromium owns the visual baseline.");
  test.skip(
    process.platform !== "win32",
    "The committed pixel baseline is generated on Windows.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("portfolio-desktop.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
