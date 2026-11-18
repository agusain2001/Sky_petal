import { test, expect } from "@playwright/test";

test("remaining silk animation, pause and reduced motion stay functional", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.locator(".bloom-intro").waitFor({ state: "detached" });
  await expect(page.locator(".hero-depth-scene, .hero-petals, .living-bloom-section, .bloom-explore")).toHaveCount(0);
  await page.locator(".silk-experience").scrollIntoViewIfNeeded();
  const bloom = page.locator(".silk-experience canvas");
  await expect(bloom).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(2700);
  const moving = await bloom.screenshot();
  await page.waitForTimeout(450);
  expect((await bloom.screenshot()).equals(moving)).toBe(false);
  await page.getByRole("button", { name: "Pause page motion" }).click();
  await page.waitForTimeout(800);
  const paused = await bloom.screenshot();
  await page.waitForTimeout(400);
  expect((await bloom.screenshot()).equals(paused)).toBe(true);
  await page.getByRole("button", { name: "Resume page motion" }).click();
  await expect(
    page.getByRole("heading", { name: /A little luxury. A lot of comfort./ }),
  ).toBeVisible();
  await page.locator(".silk-experience").screenshot({
    path: `artifacts/remaining-silk-${info.project.name}.png`,
    scale: "css",
  });
  await page
    .getByRole("button", { name: "Little rituals", exact: true })
    .click();
  await expect(page.locator(".loved-section .product-card")).toHaveCount(1);
  await expect(page.locator(".loved-section .product-title")).toHaveText(
    "The Rose Ritual",
  );
  await page.getByRole("button", { name: "New arrivals", exact: true }).click();
  await expect(page.locator(".loved-section .product-card")).toHaveCount(4);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".petal-canvas")).toHaveCount(0);
  await page.locator(".silk-experience").scrollIntoViewIfNeeded();
  await expect(page.locator(".silk-fallback")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("the page keeps its visuals and shopping links without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).includes("webgl")) return null;
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Softness, in Every Form." }),
  ).toBeVisible();
  await page.locator(".silk-experience").scrollIntoViewIfNeeded();
  await expect(page.locator(".silk-fallback")).toBeVisible();
  await expect(page.locator(".petal-canvas")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Explore collection", exact: true }),
  ).toHaveAttribute("href", "/shop");
});
