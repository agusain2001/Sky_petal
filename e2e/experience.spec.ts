import { test, expect } from "@playwright/test";

test("editorial navigation, fit discovery and newsletter consent", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Softness, in Every Form." }),
  ).toBeVisible();
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Shop", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "A world of softness" });
    await expect(menu.getByRole("link", { name: "Bodysuits" })).toBeVisible();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Bras & bralettes" }),
    ).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Your bust", exact: false }).click();
  await expect(
    page.getByText("Measure around the fullest part of your bust.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Let’s find your fit" }).click();
  await expect(
    page.getByRole("dialog", { name: "A little guidance. A beautiful fit." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const email = `sky-petal-qa-${Date.now()}@example.invalid`;
  await page.getByRole("textbox", { name: "Email for newsletter" }).fill(email);
  await page.getByRole("button", { name: "Subscribe to newsletter" }).click();
  await expect(page.locator(".newsletter-feedback")).toHaveCount(0);
  await page.locator(".newsletter-consent input").check();
  await page.getByRole("button", { name: "Subscribe to newsletter" }).click();
  await expect(page.locator(".newsletter-feedback")).toContainText(
    "You’re on the list",
  );
  expect(errors).toEqual([]);
});

test("silk shader and complete responsive editorial", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator(".hero-depth-scene, .hero-petals, .living-bloom-section, .bloom-explore")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause ambient motion" }).click();
  await expect(page.locator(".cinematic-home")).toHaveAttribute(
    "data-paused",
    "true",
  );
  await page.getByRole("button", { name: "Resume ambient motion" }).click();
  await page.locator(".silk-experience").scrollIntoViewIfNeeded();
  await expect(page.locator(".silk-experience canvas")).toBeVisible({
    timeout: 30000,
  });
  await page
    .locator(".silk-experience")
    .screenshot({ path: `artifacts/silk-${info.project.name}.png` });
  for (const section of [
    ".feeling-story",
    ".category-edit",
    ".petal-edit",
    ".loved-section",
    ".fit-editorial",
    ".being-you",
    ".ritual-section",
    ".closing-note",
    ".newsletter",
  ]) {
    await page.locator(section).scrollIntoViewIfNeeded();
    await expect(page.locator(section)).toBeVisible();
  }
  // Visit the horizontally offscreen categories too, so lazy loading gets a
  // chance to run just as it does when a customer swipes through the gallery.
  for (const image of await page.locator(".cinematic-home img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node) =>
            (node as HTMLImageElement).complete &&
            (node as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Freeze ambient effects and return to the top before a stitched full-page
  // capture, avoiding mobile smooth-scroll and sticky-header capture artifacts.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".petal-canvas")).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/cinematic-full-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
    scale: "css",
  });
  expect(errors).toEqual([]);
});
