import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { getDB, getProducts } from "../src/lib/db";
import { reserveOrder } from "../src/lib/commerce";
import {
  createTicket,
  listTickets,
  ticketDetail,
  replyToTicket,
  updateTicket,
} from "../src/lib/support";

test("private order-linked support and audited staff resolution", async (t) => {
  process.env.DATABASE_DIR = await mkdtemp(
    path.join(os.tmpdir(), "sky-petal-support-"),
  );
  delete process.env.DATABASE_URL;
  const db = await getDB();
  async function user(role = "customer") {
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,name,role) VALUES($1,$2,'Support QA',$3)",
      [id, `${id}@example.test`, role],
    );
    return { id, email: `${id}@example.test`, name: "Support QA", role };
  }
  const customer = await user(),
    other = await user(),
    staff = await user("support"),
    finance = await user("finance");
  const cart = randomUUID(),
    variant = (await getProducts())[0].variants.find((v) => v.stock > 0)!;
  await db.query("INSERT INTO carts VALUES($1,$2)", [cart, customer.id]);
  await db.query("INSERT INTO cart_items VALUES($1,$2,1)", [cart, variant.id]);
  const order = await reserveOrder(
    customer.id,
    cart,
    {
      name: "Support QA",
      phone: "9876543210",
      line1: "123 Synthetic Street",
      city: "Mumbai",
      state: "Maharashtra",
      postal: "400001",
    },
    "",
    randomUUID(),
  );
  const input = {
    subject: "Help with a product issue",
    body: "The item needs care-team review for a defect.",
    topic: "defect",
    order_id: order.id,
    idempotency_key: randomUUID(),
  };
  try {
    const [one, two] = await Promise.all([
      createTicket(customer, input),
      createTicket(customer, input),
    ]);
    await t.test(
      "concurrent identical requests create one owned ticket and one initial message",
      async () => {
        assert.equal(one.id, two.id);
        assert.equal(one.priority, "high");
        assert.equal((await ticketDetail(customer, one.id)).messages.length, 1);
        await assert.rejects(
          createTicket(customer, {
            ...input,
            body: "A changed request with the same key",
          }),
          /different details/,
        );
        await assert.rejects(
          createTicket(other, { ...input, idempotency_key: randomUUID() }),
          /own orders/,
        );
      },
    );
    await t.test(
      "customers cannot inspect/reply to another ticket or use staff operations",
      async () => {
        assert.equal((await listTickets(other)).tickets.length, 0);
        await assert.rejects(ticketDetail(other, one.id), /not found/);
        await assert.rejects(
          replyToTicket(other, one.id, { body: "A forged reply" }),
          /not found/,
        );
        await assert.rejects(
          replyToTicket(customer, one.id, {
            body: "A secret note",
            visibility: "internal",
          }),
          /permission/,
        );
        await assert.rejects(listTickets(customer, true), /permission/);
        await assert.rejects(listTickets(finance, true), /permission/);
        await assert.rejects(
          updateTicket(customer, one.id, { status: "resolved" }),
          /permission/,
        );
      },
    );
    await t.test(
      "staff notes remain private while public replies set the waiting state",
      async () => {
        await replyToTicket(
          staff,
          one.id,
          {
            body: "Internal assessment of the request",
            visibility: "internal",
          },
          true,
        );
        assert.equal((await ticketDetail(customer, one.id)).messages.length, 1);
        assert.equal(
          (await ticketDetail(staff, one.id, true)).messages.length,
          2,
        );
        await replyToTicket(
          staff,
          one.id,
          {
            body: "Please share the packaging condition.",
            visibility: "public",
          },
          true,
        );
        const detail = await ticketDetail(customer, one.id);
        assert.equal(detail.messages.length, 2);
        assert.equal(detail.ticket.status, "waiting_customer");
        await replyToTicket(customer, one.id, {
          body: "The packaging is intact.",
        });
        assert.equal(
          (await ticketDetail(customer, one.id)).ticket.status,
          "waiting_team",
        );
      },
    );
    await t.test(
      "assignment is restricted and resolution requires a customer-visible explanation",
      async () => {
        await assert.rejects(
          updateTicket(staff, one.id, {
            status: "resolved",
            priority: "high",
            assigned_to: staff.id,
            resolution: "",
          }),
          /resolution/,
        );
        await assert.rejects(
          updateTicket(staff, one.id, {
            status: "open",
            priority: "high",
            assigned_to: customer.id,
          }),
          /authorized support/,
        );
        await updateTicket(staff, one.id, {
          status: "resolved",
          priority: "high",
          assigned_to: staff.id,
          resolution:
            "Your request was reviewed and the next steps are recorded here.",
        });
        const detail = await ticketDetail(customer, one.id);
        assert.equal(detail.ticket.status, "resolved");
        assert.equal(detail.ticket.assigned_to, null);
        assert.ok(detail.messages.some((m) => m.body.includes("next steps")));
        assert.equal(
          (await listTickets(staff, true, "resolved")).tickets.length,
          1,
        );
        await replyToTicket(customer, one.id, {
          body: "I have a follow-up question.",
        });
        assert.equal(
          (await ticketDetail(customer, one.id)).ticket.status,
          "waiting_team",
        );
      },
    );
    await t.test(
      "messages and ownership history are immutable; staff read and mutation actions are audited",
      async () => {
        await assert.rejects(
          db.query("UPDATE support_tickets SET user_id=$1 WHERE id=$2", [
            other.id,
            one.id,
          ]),
          /immutable/,
        );
        await assert.rejects(
          db.query("DELETE FROM ticket_messages WHERE ticket_id=$1", [one.id]),
          /append-only/,
        );
        await assert.rejects(
          db.query("DELETE FROM support_tickets WHERE id=$1", [one.id]),
          /retained/,
        );
        assert.ok(
          (
            await db.query(
              "SELECT * FROM audit_logs WHERE target_id=$1 AND action='support.read'",
              [one.id],
            )
          ).rows.length > 0,
        );
      },
    );
    await t.test(
      "browser RLS hides other customers and internal messages",
      async () => {
        await db.exec(
          "CREATE ROLE support_browser NOLOGIN; GRANT USAGE ON SCHEMA public TO support_browser; GRANT SELECT ON support_tickets,ticket_messages TO support_browser;",
        );
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE support_browser");
          await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
            customer.id,
          ]);
          const messages = await tx.query<{ visibility: string }>(
            "SELECT * FROM ticket_messages",
          );
          assert.ok(
            messages.rows.every((message) => message.visibility === "public"),
          );
        });
        await db.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE support_browser");
          await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
            other.id,
          ]);
          assert.equal(
            (await tx.query("SELECT * FROM support_tickets")).rows.length,
            0,
          );
          assert.equal(
            (await tx.query("SELECT * FROM ticket_messages")).rows.length,
            0,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
