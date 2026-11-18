import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
test("customer and staff support threads hide notes, resolve and reopen", async ({
  page,
  browser,
}) => {
  const email = `support-${crypto.randomUUID()}@example.test`,
    subject = `A fit question ${crypto.randomUUID()}`;
  expect(
    (
      await page.request.post("/api/auth", {
        data: {
          action: "register",
          email,
          name: "Support shopper",
          password: "Testing-Password-123!",
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/account/support");
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page
    .getByRole("combobox", { name: "Topic", exact: true })
    .selectOption("fit");
  await page
    .getByLabel("Tell us what happened", { exact: true })
    .fill("I would like help choosing a suitable fit for this garment.");
  await page
    .getByRole("button", { name: "Send support request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: subject, exact: true }),
  ).toBeVisible();
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4317";
  try {
    const access = JSON.parse(
      await readFile(
        process.env.TEST_OWNER_ACCESS_FILE || "data/local-access.json",
        "utf8",
      ),
    );
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
    await staff.getByRole("tab", { name: "Support", exact: true }).click();
    await staff.getByRole("button", { name: new RegExp(subject) }).click();
    await staff
      .getByLabel("Your reply", { exact: true })
      .fill("Internal fit assessment: this note is private.");
    await staff
      .getByRole("checkbox", {
        name: "Internal team note (hidden from customer)",
        exact: true,
      })
      .check();
    await staff
      .getByRole("button", { name: "Send reply", exact: true })
      .click();
    await expect(
      staff.getByText("Reply saved.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh conversations", exact: true })
      .click();
    await expect(
      page.getByText("Internal fit assessment: this note is private.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await staff
      .getByLabel("Your reply", { exact: true })
      .fill("Our care team can help with your measurements.");
    await staff
      .getByRole("button", { name: "Send reply", exact: true })
      .click();
    await expect(
      staff.getByText("Our care team can help with your measurements.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh conversations", exact: true })
      .click();
    await expect(
      page.getByText("Our care team can help with your measurements.", {
        exact: true,
      }),
    ).toBeVisible();
    await staff
      .getByRole("combobox", { name: "Request status", exact: true })
      .selectOption("resolved");
    await staff
      .getByLabel("Customer-visible resolution (required to resolve)", {
        exact: true,
      })
      .fill("We reviewed your fit question and recorded the guidance here.");
    await staff
      .getByRole("button", { name: "Update support request", exact: true })
      .click();
    await expect(
      staff.getByText("Support request updated.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh conversations", exact: true })
      .click();
    await expect(
      page.getByText("Replying reopens this conversation for the team.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("Your reply", { exact: true })
      .fill("I have a follow-up question about these measurements.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(page.getByText("Reply saved.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Status: waiting team/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      axe.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact || ""),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/support-thread-${test.info().project.name}.png`,
      fullPage: true,
    });
  } finally {
    await staffContext.close();
  }
});
