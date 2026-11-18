import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("storefront, SKU selection, persistent guest bag and sign-in gate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /softness, in every form/i }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore collection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "All things lovely." }),
  ).toBeVisible();
  await page.goto("/products/the-petal-bralette");
  await page.getByRole("button", { name: "Petal Rose", exact: true }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Your bag (1)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open bag, 1 items" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Your bag (1)" })
      .getByRole("heading", { name: "The Petal Bralette" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Checkout securely" }).click();
  await expect(page).toHaveURL(/account\?next=\/checkout/);
  await expect(
    page.getByText("Your lovely bag is right where you left it.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("URL filters and sorting preserve state on reload", async ({ page }) => {
  await page.goto(
    "/shop?category=bras&size=M&color=Petal+Rose&stock=true&sort=price-asc",
  );
  await expect(
    page.getByRole("heading", { name: "Bras & bralettes", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Sort products" }),
  ).toHaveValue("price-asc");
  await expect(page.locator(".product-card")).toHaveCount(2);
});
test("responsive layout, reduced motion and accessible storefront", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /softness, in every form/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".petal-canvas")).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/sky-petal-${test.info().project.name}.png`,
    fullPage: false,
  });
});
test("admin is protected from unauthenticated visitors", async ({ page }) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "A space for our team." }),
  ).toBeVisible();
  const r = await page.request.get("/api/admin");
  expect(r.status()).toBe(401);
});
