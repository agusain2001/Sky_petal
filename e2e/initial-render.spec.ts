import { test, expect } from "@playwright/test";

test("initial shopping content and critical imagery do not wait for JavaScript", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: info.project.use.viewport || { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    for (const [route, heading, image] of [
      ["/", "Softness, in Every Form.", ".bloom-art img"],
      ["/shop", "All things lovely.", ".product-card img"],
      [
        "/products/the-petal-bralette",
        "The Petal Bralette",
        ".detail-main-image",
      ],
    ]) {
      await page.goto(
        (process.env.TEST_BASE_URL || "http://127.0.0.1:4317") + route,
      );
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      const critical = page.locator(image).first();
      await expect(critical).toBeVisible();
      await expect(critical).not.toHaveAttribute("loading", "lazy");
      await expect
        .poll(() =>
          critical.evaluate(
            (node) =>
              (node as HTMLImageElement).complete &&
              (node as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
  } finally {
    await context.close();
  }
});
