import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("two PDP tabs atomically add both quantities", async ({ context }) => {
  const catalog = await (await context.request.get("/api/catalog")).json();
  const p = catalog.products.find(
    (p: { slug: string }) => p.slug === "the-petal-bralette",
  );
  const v = p.variants.find(
    (v: { size: string; color: string; stock: number }) =>
      v.size === "M" && v.color === "Petal Rose" && v.stock >= 3,
  );
  expect(v).toBeTruthy();
  expect(
    (
      await context.request.post("/api/cart", {
        data: { variant_id: v.id, quantity: 1 },
      })
    ).ok(),
  ).toBe(true);
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto("/products/" + p.slug);
    await page.getByRole("button", { name: "Petal Rose", exact: true }).click();
    await page.getByRole("button", { name: "M", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Open bag, 1 items", exact: true }),
    ).toBeVisible();
  }
  let arrivals = 0,
    release: () => void = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("**/api/cart", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    expect(route.request().postDataJSON()).toMatchObject({
      operation: "increment",
      quantity: 1,
    });
    if (++arrivals === 2) release();
    await barrier;
    await route.continue();
  });
  try {
    await Promise.all(
      pages.map((page) =>
        page.getByRole("button", { name: "Add to bag", exact: true }).click(),
      ),
    );
    await Promise.all(
      pages.map((page) => expect(page.getByRole("dialog")).toBeVisible()),
    );
    const cart = await (await context.request.get("/api/cart")).json();
    expect(
      cart.items.find((i: { variant_id: string }) => i.variant_id === v.id)
        .quantity,
    ).toBe(3);
  } finally {
    release();
    await context.unroute("**/api/cart");
  }
});

test("search Escape restores trigger focus and open/closed filters meet automated AA", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shop");
  const trigger = page.getByRole("button", {
    name: "Search products",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Find something lovely" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(
    () => document.activeElement?.closest("dialog") !== null,
  );
  expect(inside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const scan = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
    ).toEqual([]);
  };
  await scan();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").locator(".dialog-content")).toHaveCSS(
      "opacity",
      "1",
    );
    await scan();
    await page.keyboard.press("Escape");
    await scan();
  }
});

test("SEO endpoints have correct formats; product canonical and structured offers are truthful", async ({
  request,
  page,
}, info) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toContain("Disallow: /");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).not.toContain("/account");
  await page.goto("/products/the-petal-bralette");
  const mainImage = page.locator("img.detail-main-image");
  const imageBox = await mainImage.boundingBox();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.height / imageBox!.width).toBeCloseTo(
    info.project.name === "mobile" ? 4.7 / 4 : 5 / 4,
    1,
  );
  if (process.env.QA_EVIDENCE_DIR)
    await page.screenshot({
      path: `${process.env.QA_EVIDENCE_DIR}/pdp-${info.project.name}.png`,
    });
  expect(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
  ).toMatch(/\/products\/the-petal-bralette$/);
  const data = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(data["@type"]).toBe("Product");
  expect(data.aggregateRating).toBeUndefined();
  const catalog = await (await request.get("/api/catalog")).json();
  const product = catalog.products.find(
    (p: { slug: string }) => p.slug === "the-petal-bralette",
  );
  for (const offer of data.offers) {
    const v = product.variants.find(
      (v: { sku: string }) => v.sku === offer.sku,
    );
    expect(offer.price).toBe((v.price / 100).toFixed(2));
    expect(offer.priceCurrency).toBe("INR");
    expect(offer.availability).toBe(
      `https://schema.org/${v.stock > 0 ? "InStock" : "OutOfStock"}`,
    );
  }
});

test("newsletter API refuses false/missing consent and unsubscribe works", async ({
  request,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  expect(
    (
      await request.post("/api/newsletter", { data: { email, consent: false } })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/newsletter", { data: { email } })).status(),
  ).toBe(400);
  const subscribed = await request.post("/api/newsletter", {
    data: { email, consent: true },
  });
  expect(subscribed.ok()).toBe(true);
  const { unsubscribe_token } = await subscribed.json();
  expect(unsubscribe_token).toMatch(/^[a-f0-9]{64}$/);
  expect(
    (
      await request.post("/api/newsletter/unsubscribe", {
        data: { token: unsubscribe_token },
      })
    ).ok(),
  ).toBe(true);
});
