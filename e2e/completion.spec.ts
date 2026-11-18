import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { totp } from "../src/lib/staff-mfa";
test.use({ trace: "off", screenshot: "off" });
test("staff MFA gates a new session; invoice PDFs are private; local deletion closes access", async ({
  page,
  browser,
}, info) => {
  const access = JSON.parse(
      await readFile(
        process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
        "utf8",
      ),
    ),
    fixture = access.completionFixtures?.[info.project.name];
  test.skip(!fixture, "Requires disposable completion fixtures");
  expect(
    (
      await page.request.post("/api/auth", {
        data: { action: "login", ...fixture.team },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/account/security");
  await page
    .getByLabel("Current password", { exact: true })
    .fill(fixture.team.password);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const seed = await page.locator("code").innerText();
  await page
    .getByLabel("Authenticator or unused recovery code")
    .fill(totp(seed));
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Save your recovery codes now." }),
  ).toBeVisible();
  const recovery = (await page.locator("pre").innerText()).split("\n")[0];
  const second = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:4317",
  });
  try {
    await second.request.post("/api/auth", {
      data: { action: "login", ...fixture.team },
    });
    expect((await second.request.get("/api/admin")).status()).toBe(403);
    expect(
      (
        await second.request.post("/api/security/mfa/verify", {
          data: { code: recovery },
        })
      ).ok(),
    ).toBe(true);
    expect((await second.request.get("/api/admin")).ok()).toBe(true);
    expect(
      (
        await second.request.post("/api/security/mfa/verify", {
          data: { code: recovery },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await second.close();
  }
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  await page.getByText("Approved seller settings", { exact: true }).click();
  for (const [label, value] of [
    ["Legal seller name", "Synthetic QA Seller"],
    ["Registered seller address", "123 Synthetic Seller Road, Mumbai"],
    ["GSTIN (leave empty only when applicable)", "27ABCDE1234F1Z5"],
    ["Two-digit issuer state code", "27"],
    ["Document prefix (1–3 uppercase letters)", "QA"],
    ["Merchant/accountant approval reference", "SYNTHETIC-TEST-ONLY"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Save approved settings", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Issue invoice", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Accepted order ID").fill(fixture.order_id);
  await page
    .getByRole("button", { name: "Issue invoice", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download PDF" }).first(),
  ).toBeVisible();
  const documents = await (
      await page.request.get(`/api/orders/${fixture.order_id}/documents`)
    ).json(),
    document = documents.find(
      (d: { order_id: string }) => d.order_id === fixture.order_id,
    );
  expect(document).toBeTruthy();
  const pdf = await page.request.get(`/api/documents/${document.id}.pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const customer = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:4317",
  });
  try {
    const email = `erase-${crypto.randomUUID()}@example.test`;
    expect(
      (
        await customer.request.post("/api/auth", {
          data: {
            action: "register",
            email,
            name: "Synthetic deletion QA",
            password: "Synthetic-Password-2026!",
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await customer.request.get(`/api/documents/${document.id}.pdf`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await customer.request.post("/api/admin/privacy/approve", {
          data: { id: "missing" },
        })
      ).status(),
    ).toBe(403);
    const deletion = await (
      await customer.request.post("/api/privacy", { data: { kind: "delete" } })
    ).json();
    await page.getByRole("tab", { name: "Privacy", exact: true }).click();
    await page.getByText("Approved retention policy", { exact: true }).click();
    await page.getByLabel("Financial retention days").fill("0");
    await page.getByLabel("Support retention days").fill("0");
    await page
      .getByLabel("Policy version", { exact: true })
      .fill("SYNTHETIC-1");
    await page
      .getByLabel("Approval reference", { exact: true })
      .fill("SYNTHETIC-TEST-ONLY");
    await page
      .getByRole("button", {
        name: "Save approved retention policy",
        exact: true,
      })
      .click();
    expect(
      (
        await page.request.post("/api/admin/privacy/approve", {
          data: { id: deletion.id },
        })
      ).ok(),
    ).toBe(true);
    expect((await customer.request.get("/api/orders")).status()).toBe(401);
    await page.getByRole("button", { name: "Refresh privacy status" }).click();
    await expect(
      page
        .getByText(
          "Local account and enumerated personal-data fields erased.",
          { exact: false },
        )
        .first(),
    ).toBeVisible();
  } finally {
    await customer.close();
  }
});
