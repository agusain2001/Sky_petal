import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test("owned item return, staff inspection, refund approval and private updates", async ({
  page,
  browser,
}) => {
  const access = JSON.parse(
      await readFile(
        process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
        "utf8",
      ),
    ),
    fixture = access.returnFixtures?.[test.info().project.name];
  test.skip(!fixture, "Requires disposable commerce fixtures");
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
  await page.goto(`/account/orders/${fixture.order_id}`);
  await page.locator("input[type=checkbox][name^=item_]").check();
  await page.getByLabel("Quantity to return", { exact: true }).fill("1");
  await page
    .getByLabel("Tell us what happened", { exact: true })
    .fill("One garment arrived with defective stitching. Please review.");
  await page
    .getByRole("button", { name: "Submit request for review", exact: true })
    .click();
  await expect(
    page.getByText("Your return request has been recorded for review.", {
      exact: true,
    }),
  ).toBeVisible();
  const rma = (
    await (
      await page.request.get(`/api/returns?order=${fixture.order_id}`)
    ).json()
  )[0];
  expect(rma.items[0].quantity).toBe(1);
  const staffContext = await browser.newContext({
      viewport: page.viewportSize(),
      isMobile: test.info().project.name === "mobile",
      hasTouch: test.info().project.name === "mobile",
    }),
    staff = await staffContext.newPage(),
    base = process.env.TEST_BASE_URL || "http://127.0.0.1:4317";
  try {
    expect(
      (
        await staff.request.post(`${base}/api/auth`, {
          data: {
            action: "login",
            email: access.email,
            password: access.password,
          },
        })
      ).ok(),
    ).toBe(true);
    await staff.goto(`${base}/admin`);
    await staff.getByRole("tab", { name: "Returns", exact: true }).click();
    const card = staff.locator("article").filter({
      has: staff.getByRole("heading", {
        name: new RegExp(`RMA ${rma.id.slice(0, 8).toUpperCase()}`),
      }),
    });
    await card
      .getByLabel("Customer-visible explanation", { exact: true })
      .fill("Approved for receipt and quality inspection.");
    await card
      .getByRole("button", { name: "Save return decision", exact: true })
      .click();
    await card
      .getByLabel("Actual return receipt / handover reference", { exact: true })
      .fill(`QA-RMA-${rma.id.slice(0, 8)}`);
    await card
      .getByLabel("Receipt note", { exact: true })
      .fill("Returned garment received at the QA warehouse.");
    await card
      .getByRole("button", { name: "Record received return", exact: true })
      .click();
    await card
      .getByRole("combobox", { name: /disposition/ })
      .selectOption("restock");
    await card
      .getByLabel("Condition findings", { exact: true })
      .fill("Synthetic QA inspection found intact saleable stock.");
    await card
      .getByLabel("Customer-visible inspection summary", { exact: true })
      .fill("Inspection completed and item disposition recorded.");
    await card
      .getByRole("button", { name: "Save inspection", exact: true })
      .click();
    await expect(
      card.getByRole("heading", { name: /inspected/ }),
    ).toBeVisible();
    await staff.getByRole("tab", { name: "Refunds", exact: true }).click();
    await staff.getByLabel("Order ID", { exact: true }).fill(fixture.order_id);
    await staff
      .getByLabel("Inspected RMA ID (optional for a separate adjustment)", {
        exact: true,
      })
      .fill(rma.id);
    await staff
      .getByLabel("Amount in paise", { exact: true })
      .fill(String(rma.items[0].refund_cap));
    await staff
      .getByLabel("Reason and adjustment basis", { exact: true })
      .fill("Approved inspected garment refund at copied net value.");
    await staff
      .getByRole("button", { name: "Record refund request", exact: true })
      .click();
    await expect(
      staff.getByText("Refund request recorded; approval is required.", {
        exact: true,
      }),
    ).toBeVisible();
    const refund = (
      await (await staff.request.get(`${base}/api/admin/refunds`)).json()
    ).find((row: { return_id: string }) => row.return_id === rma.id);
    const refundCard = staff
      .locator("article")
      .filter({ hasText: `Refund ${refund.id}` });
    await refundCard
      .getByRole("button", { name: "Approve refund", exact: true })
      .click();
    await expect(
      refundCard.getByRole("heading", { name: /approved/ }),
    ).toBeVisible();
    await staff
      .getByRole("tab", { name: "Background work", exact: true })
      .click();
    await expect(
      staff.getByRole("heading", { name: /refund.submit · pending/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh returns", exact: true })
      .click();
    await expect(page.getByText(/Refund records/)).toBeVisible();
    await expect(
      page.getByText(/approved · Original payment method/).first(),
    ).toBeVisible();
    await page.goto("/account/notifications");
    await expect(
      page.getByRole("heading", { name: "Your updates", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Refund under review", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Mark as read", exact: true })
      .first()
      .click();
    await page.reload();
    await expect(page.getByText(/ · Read$/).first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/rma-updates-${test.info().project.name}.png`,
      fullPage: true,
    });
    await staff.getByRole("tab", { name: "Returns", exact: true }).click();
    const adminAxe = await new AxeBuilder({ page: staff })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      adminAxe.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact || ""),
      ),
    ).toEqual([]);
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await staff.screenshot({
      path: `artifacts/rma-operations-${test.info().project.name}.png`,
      fullPage: true,
    });
  } finally {
    await staffContext.close();
  }
});
