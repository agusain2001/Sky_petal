import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

test("quoted COD checkout stays unpaid and collection/remittance require finance evidence", async ({
  page,
  playwright,
}) => {
  const access = JSON.parse(
    await readFile(
      process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
      "utf8",
    ),
  );
  const fixture = access.commerceFixtures?.[test.info().project.name];
  test.skip(
    !fixture,
    "Run the disposable acceptance setup with TEST_COMMERCE_FIXTURES=true",
  );
  expect(
    (
      await page.request.post("/api/auth", {
        data: {
          action: "login",
          email: fixture.email,
          password: fixture.password,
        },
      })
    ).ok(),
  ).toBe(true);
  // The courier response is an explicit synthetic fixture. The order is created
  // through the real protected HTTP/DB checkout path and revalidates its quote.
  await page.route("**/api/checkout/quote", (route) =>
    route.fulfill({ json: fixture.quote }),
  );
  await page.goto("/checkout");
  await page
    .getByRole("radio", {
      name: "Cash on Delivery (subject to eligibility)",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Check delivery & totals", exact: true })
    .click();
  await expect(page.getByText(/Synthetic acceptance courier/)).toBeVisible();
  const checkout = page.getByRole("button", { name: /Place COD order/ });
  await expect(checkout).toBeEnabled();
  await page.screenshot({
    path: `artifacts/quoted-cod-checkout-${test.info().project.name}.png`,
    fullPage: true,
  });
  const resultPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/checkout") &&
      response.request().method() === "POST",
  );
  await checkout.click();
  const response = await resultPromise;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  await expect(page).toHaveURL(
    new RegExp(`/account/orders/${result.local_order_id}$`),
  );
  await expect(
    page.getByText("Payment: due · Fulfillment: unfulfilled · Refund: none", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/cod")).status()).toBe(403);

  const staff = await playwright.request.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:4317",
  });
  try {
    expect(
      (
        await staff.post("/api/auth", {
          data: {
            action: "login",
            email: access.email,
            password: access.password,
          },
        })
      ).ok(),
    ).toBe(true);
    for (const status of ["processing", "shipped", "delivered"])
      expect(
        (
          await staff.post("/api/admin/order", {
            data: {
              id: result.local_order_id,
              status,
              carrier: "Synthetic acceptance courier",
              tracking: "SYNTHETIC-AWB-ONLY",
            },
          })
        ).ok(),
      ).toBe(true);
    const delivered = await (
      await page.request.get(`/api/orders/${result.local_order_id}`)
    ).json();
    expect(delivered.payment_state).toBe("due");
    expect(
      (
        await page.request.post("/api/auth", {
          data: {
            action: "login",
            email: access.email,
            password: access.password,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/admin");
    await page.getByRole("tab", { name: "COD", exact: true }).click();
    const occurred = await page.evaluate(() => {
      const d = new Date();
      d.setMinutes(d.getMinutes() + 1, 0, 0);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    });
    for (const kind of ["collection", "remittance"]) {
      await page
        .getByRole("combobox", { name: "Delivered COD order", exact: true })
        .selectOption(result.local_order_id);
      await page
        .getByRole("combobox", { name: "Evidence type", exact: true })
        .selectOption(kind);
      await page
        .getByLabel("Gross amount (INR)", { exact: true })
        .fill((result.amount / 100).toFixed(2));
      await page
        .getByLabel("Remittance deductions (INR)", { exact: true })
        .fill(kind === "remittance" ? "12.34" : "0");
      await page
        .getByLabel("Statement / transaction reference", { exact: true })
        .fill(`SYNTHETIC-${kind}-${crypto.randomUUID()}`);
      await page
        .getByLabel("Evidence date and time", { exact: true })
        .fill(occurred);
      await page
        .getByLabel("Verification evidence", { exact: true })
        .fill("Synthetic statement checked for acceptance testing only");
      await page
        .getByRole("checkbox", {
          name: "I verified this evidence against the courier statement or bank record.",
          exact: true,
        })
        .check();
      await page
        .getByRole("button", { name: "Record COD evidence", exact: true })
        .click();
      await expect(
        page.getByText("Verified COD evidence recorded.", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("row")
          .filter({ hasText: result.local_order_id.slice(0, 8).toUpperCase() }),
      ).toContainText(kind === "collection" ? "collected" : "remitted");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/cod-finance-${test.info().project.name}.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      axe.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact || ""),
      ),
    ).toEqual([]);
  } finally {
    await staff.dispose();
  }
});
