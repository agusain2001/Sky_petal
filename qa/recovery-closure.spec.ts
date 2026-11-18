import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("COD evidence correction is requested and independently approved without rewriting the payout", async ({
  page,
  browser,
}, info) => {
  const access = JSON.parse(
    await readFile(process.env.TEST_OWNER_ACCESS_FILE!, "utf8"),
  );
  const fixture = access.commerceFixtures[info.project.name];
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
  const order = (await (await page.request.get("/api/orders")).json()).find(
    (o: { payment_method: string; status: string }) =>
      o.payment_method === "cod" && o.status === "delivered",
  );
  expect(order).toBeTruthy();
  expect(
    (
      await page.request.post("/api/admin/refunds/evidence-corrections", {
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(
        "/api/admin/refunds/evidence-corrections/approve",
        { data: {} },
      )
    ).status(),
  ).toBe(403);
  const finance = access.roles.finance;
  expect(
    (
      await page.request.post("/api/auth", {
        data: {
          action: "login",
          email: finance.email,
          password: finance.password,
        },
      })
    ).ok(),
  ).toBe(true);
  const refundResponse = await page.request.post("/api/admin/refunds", {
    data: {
      order_id: order.id,
      amount: 100,
      reason: "Synthetic COD refund evidence closure test",
      request_key: crypto.randomUUID(),
    },
  });
  expect(refundResponse.ok()).toBe(true);
  const refund = await refundResponse.json();
  const ownerContext = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL,
    viewport: page.viewportSize() || undefined,
  });
  try {
    const owner = await ownerContext.newPage();
    const reviewer = access.roles.administrator;
    expect(
      (
        await owner.request.post("/api/auth", {
          data: {
            action: "login",
            email: reviewer.email,
            password: reviewer.password,
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await owner.request.post("/api/admin/refunds/review", {
          data: { id: refund.id, approve: true },
        })
      ).ok(),
    ).toBe(true);
    const original = "SYNTHETIC-ORIGINAL-" + crypto.randomUUID();
    expect(
      (
        await page.request.post("/api/admin/refunds/manual-confirm", {
          data: {
            id: refund.id,
            reference: original,
            evidence: "Synthetic bank statement for local testing only",
            occurred_at: new Date().toISOString(),
            verified: true,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Refunds", exact: true }).click();
    const card = page
      .locator("article")
      .filter({ hasText: `Refund ${refund.id}` });
    const corrected = "SYNTHETIC-CORRECTED-" + crypto.randomUUID();
    await card
      .getByLabel("Corrected statement reference", { exact: true })
      .fill(corrected);
    await card
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic reference transcription correction for acceptance");
    await card
      .getByLabel("Independent statement proof", { exact: true })
      .fill(
        "Synthetic independent bank record proof; no actual bank operation",
      );
    await card
      .getByRole("button", { name: "Request correction", exact: true })
      .click();
    await expect(
      card.getByText("Awaiting independent approval", { exact: false }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Approve correction", exact: true }),
    ).toHaveCount(0);
    await owner.goto("/admin");
    await owner.getByRole("tab", { name: "Refunds", exact: true }).click();
    const approval = owner
      .locator("article")
      .filter({ hasText: `Refund ${refund.id}` });
    await approval
      .getByLabel("Independent reconciliation reference", { exact: true })
      .fill("SYNTHETIC-RECONCILIATION-" + crypto.randomUUID());
    await approval
      .getByRole("button", { name: "Approve correction", exact: true })
      .click();
    await expect(
      owner.getByText("Correction approved; original evidence retained.", {
        exact: true,
      }),
    ).toBeVisible();
    const saved = (
      await (await owner.request.get("/api/admin/refunds")).json()
    ).find((r: { id: string }) => r.id === refund.id);
    expect(saved.evidence_ref).toBe(original);
    expect(saved.status).toBe("processed");
    expect(saved.amount).toBe(100);
    expect(
      saved.corrections.find((c: { approved_by: string }) => c.approved_by)
        .corrected_ref,
    ).toBe(corrected);
    expect(
      (
        await page.request.post("/api/admin/refunds/manual-confirm", {
          data: {
            id: refund.id,
            reference: corrected,
            evidence: "Attempted overwrite must be rejected",
            occurred_at: new Date().toISOString(),
            verified: true,
          },
        })
      ).ok(),
    ).toBe(false);
  } finally {
    await ownerContext.close();
  }
});

test("HTTP privacy export includes persisted support data and excludes the other customer", async ({
  request,
}) => {
  const password = "Synthetic-Password-" + crypto.randomUUID();
  const register = async () => {
    const response = await request.post("/api/auth", {
      data: {
        action: "register",
        email: `recovery-export-${crypto.randomUUID()}@example.test`,
        password,
        name: "Recovery synthetic customer",
      },
    });
    expect(response.ok()).toBe(true);
  };
  const ticket = async () => {
    const response = await request.post("/api/support/tickets", {
      data: {
        subject: "Privacy export regression",
        body: "Synthetic persistent support data for export coverage",
        idempotency_key: crypto.randomUUID(),
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  await register();
  const other = await ticket();
  await request.post("/api/logout", { data: {} });
  await register();
  const owned = await ticket();
  expect((await request.get("/api/support/tickets/" + owned.id)).ok()).toBe(
    true,
  );
  const response = await request.post("/api/privacy", {
    data: { kind: "export" },
  });
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(JSON.stringify(result)).toContain(owned.id);
  expect(JSON.stringify(result)).not.toContain(other.id);
  expect(result.support_messages).toHaveLength(1);
  expect(result.profile.password_hash).toBeUndefined();
});
