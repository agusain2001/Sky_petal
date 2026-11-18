import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("address book CRUD, defaults, billing and saved-address checkout", async ({
  page,
}) => {
  const email = `address-${crypto.randomUUID()}@example.test`;
  const registration = await page.request.post("/api/auth", {
    data: {
      action: "register",
      email,
      name: "Address QA",
      password: "Testing-Password-123!",
    },
  });
  expect(registration.ok()).toBe(true);
  await page.goto("/account?view=Addresses");
  await expect(
    page.getByRole("heading", { name: "Send a little softness." }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Address QA");
  await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Test Street");
  await page
    .getByLabel("Apartment / floor (optional)", { exact: true })
    .fill("Floor 2");
  await page.getByLabel("City", { exact: true }).fill("Mumbai");
  await page
    .getByLabel("State / union territory", { exact: true })
    .fill("Maharashtra");
  await page.getByLabel("PIN code", { exact: true }).fill("400001");
  await page
    .getByRole("button", { name: "Save this address", exact: true })
    .click();
  await expect(
    page.getByText("Your address is saved.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("article").getByText(/Default shipping/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Home address", exact: true })
    .click();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("456 Updated Street");
  await page
    .getByRole("button", { name: "Save this address", exact: true })
    .click();
  await expect(
    page.locator("article").getByText(/456 Updated Street/),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator("article").getByText(/456 Updated Street/),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/commerce-addresses-${test.info().project.name}.png`,
    fullPage: true,
  });

  const catalog = await (await page.request.get("/api/catalog")).json();
  const variant = catalog.products[0].variants.find(
    (variant: { stock: number }) => variant.stock > 0,
  );
  expect(
    (
      await page.request.post("/api/cart", {
        data: { variant_id: variant.id, quantity: 1 },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/checkout");
  await expect(
    page.getByRole("combobox", { name: "Shipping address", exact: true }),
  ).not.toHaveValue("");
  await expect(page.getByText(/456 Updated Street/).last()).toBeVisible();
  await expect(
    page.getByLabel("Billing address is the same as shipping"),
  ).toBeChecked();
  await page.getByLabel("Billing address is the same as shipping").uncheck();
  await expect(
    page.getByRole("combobox", { name: "Saved billing address", exact: true }),
  ).not.toHaveValue("");
  await page
    .getByRole("combobox", { name: "Saved billing address", exact: true })
    .selectOption("");
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/commerce-checkout-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/account?view=Addresses");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Home address", exact: true })
    .click();
  await expect(
    page.getByText("Address deleted.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("restricted payment operations and private order-detail boundary", async ({
  page,
}) => {
  const access = JSON.parse(
    await readFile(
      process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
      "utf8",
    ),
  );
  expect(
    (
      await page.request.post("/api/auth", {
        data: { ...access, action: "login" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Payment recovery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "No verified capture events recorded.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/payment-operations-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/account/orders/another-customers-order");
  await expect(
    page.getByRole("alert").filter({ hasText: "Order not found" }),
  ).toBeVisible();
  await page.goto(`/account/orders/${access.deliveredOrderId}`);
  await expect(
    page.getByRole("heading", { name: "Order history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Payment: captured · Fulfillment: delivered · Refund: none",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic test courier · QA-AWB-ONLY", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("article ol li")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Shipping address", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/commerce-order-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto(
    `/account/orders/${access.pendingOrderIds[test.info().project.name]}`,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Cancel unpaid order", exact: true })
    .click();
  await expect(
    page.getByText("Unpaid order cancelled. No refund was issued.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel unpaid order", exact: true }),
  ).toHaveCount(0);
});
