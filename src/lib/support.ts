import { randomUUID } from "node:crypto";
import { notifyAccount } from "./jobs";
import { z } from "zod";
import { getDB } from "./db";
import type { User } from "./types";
export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  order_id: string | null;
  topic: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};
export type TicketMessage = {
  id: string;
  ticket_id: string;
  actor_id: string;
  body: string;
  visibility: "public" | "internal";
  created_at: string;
  name?: string;
};
const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(4000),
  order_id: z.string().min(1).max(150).nullable().default(null),
  topic: z
    .enum(["order", "fit", "return", "defect", "privacy", "grievance", "other"])
    .default("other"),
  idempotency_key: z.string().min(1).max(150),
});
const staffRoles = ["owner", "administrator", "support"];
function checkStaff(actor: User) {
  if (!staffRoles.includes(actor.role))
    throw new Error("You do not have permission to manage support");
}
export async function createTicket(user: User, body: unknown) {
  const input = ticketSchema.parse(body),
    db = await getDB();
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [
      user.id,
    ]);
    const previous = (
      await tx.query<SupportTicket>(
        "SELECT * FROM support_tickets WHERE user_id=$1 AND idempotency_key=$2",
        [user.id, input.idempotency_key],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.subject !== input.subject ||
        previous.body !== input.body ||
        previous.topic !== input.topic ||
        previous.order_id !== input.order_id
      )
        throw new Error(
          "This support request key already records different details",
        );
      return previous;
    }
    if (
      input.order_id &&
      !(
        await tx.query("SELECT id FROM orders WHERE id=$1 AND user_id=$2", [
          input.order_id,
          user.id,
        ])
      ).rows.length
    )
      throw new Error("Choose one of your own orders");
    const id = randomUUID();
    const result = (
      await tx.query<SupportTicket>(
        "INSERT INTO support_tickets(id,user_id,subject,body,order_id,topic,priority,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          id,
          user.id,
          input.subject,
          input.body,
          input.order_id,
          input.topic,
          ["defect", "grievance"].includes(input.topic) ? "high" : "standard",
          input.idempotency_key,
        ],
      )
    ).rows[0];
    await tx.query(
      "INSERT INTO ticket_messages(id,ticket_id,actor_id,body,visibility) VALUES($1,$2,$3,$4,'public')",
      [randomUUID(), id, user.id, input.body],
    );
    return result;
  });
}
export async function listTickets(actor: User, staff = false, status?: string) {
  if (staff) checkStaff(actor);
  const db = await getDB();
  const filter = z
    .enum(["all", "open", "waiting_customer", "waiting_team", "resolved"])
    .parse(status || "all");
  const tickets = (
    await db.query<SupportTicket>(
      `SELECT * FROM support_tickets WHERE ($1::boolean OR user_id=$2) AND ($3='all' OR status=$3) ORDER BY CASE WHEN priority='high' THEN 0 ELSE 1 END,updated_at DESC,id LIMIT 100`,
      [staff, actor.id, filter],
    )
  ).rows;
  const members = staff
    ? (
        await db.query<{ id: string; name: string }>(
          "SELECT id,name FROM users WHERE role IN ('owner','administrator','support') ORDER BY name,id",
        )
      ).rows
    : [];
  if (staff)
    await db.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'support.queue.read','support',$3)",
      [
        randomUUID(),
        actor.id,
        JSON.stringify({ status: filter, count: tickets.length }),
      ],
    );
  return {
    tickets: staff
      ? tickets
      : tickets.map((ticket) => ({ ...ticket, assigned_to: null })),
    members,
  };
}
export async function ticketDetail(
  actor: User,
  ticketId: string,
  staff = false,
) {
  if (staff) checkStaff(actor);
  const db = await getDB();
  const ticket = (
    await db.query<SupportTicket>(
      "SELECT * FROM support_tickets WHERE id=$1 AND ($2::boolean OR user_id=$3)",
      [ticketId, staff, actor.id],
    )
  ).rows[0];
  if (!ticket) throw new Error("Support ticket not found");
  const messages = (
    await db.query<TicketMessage>(
      `SELECT m.id,m.ticket_id,m.actor_id,m.body,m.visibility,m.created_at,
    CASE WHEN m.actor_id=$3 THEN 'You' WHEN m.actor_id=$4 THEN 'Customer' ELSE 'Sky Petal care' END AS name FROM ticket_messages m WHERE m.ticket_id=$1 AND ($2::boolean OR visibility='public') ORDER BY m.created_at DESC,m.id DESC LIMIT 200`,
      [ticketId, staff, actor.id, ticket.user_id],
    )
  ).rows.reverse();
  if (staff)
    await db.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'support.read',$3,'{}')",
      [randomUUID(), actor.id, ticketId],
    );
  // Internal assignment metadata belongs to staff, and never accompanies a customer response.
  return {
    ticket: staff ? ticket : { ...ticket, assigned_to: null },
    messages,
  };
}
export async function replyToTicket(
  actor: User,
  ticketId: string,
  body: unknown,
  staff = false,
) {
  if (staff) checkStaff(actor);
  const input = z
    .object({
      body: z.string().trim().min(2).max(4000),
      visibility: z.enum(["public", "internal"]).default("public"),
    })
    .parse(body);
  if (!staff && input.visibility !== "public")
    throw new Error("You do not have permission to write internal notes");
  const db = await getDB();
  await db.transaction(async (tx) => {
    const ticket = (
      await tx.query<SupportTicket>(
        "SELECT * FROM support_tickets WHERE id=$1 AND ($2::boolean OR user_id=$3) FOR UPDATE",
        [ticketId, staff, actor.id],
      )
    ).rows[0];
    if (!ticket) throw new Error("Support ticket not found");
    const messageId = randomUUID();
    await tx.query(
      "INSERT INTO ticket_messages(id,ticket_id,actor_id,body,visibility) VALUES($1,$2,$3,$4,$5)",
      [messageId, ticketId, actor.id, input.body, input.visibility],
    );
    if (staff && input.visibility === "public")
      await notifyAccount(
        tx,
        ticket.user_id,
        `support:${messageId}`,
        "Customer care replied",
        "A reply is available in your private customer-care conversation.",
        ticket.order_id || undefined,
      );
    await tx.query("UPDATE support_tickets SET status=$1 WHERE id=$2", [
      input.visibility === "internal"
        ? ticket.status
        : staff
          ? "waiting_customer"
          : "waiting_team",
      ticketId,
    ]);
    if (staff)
      await tx.query(
        "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'support.reply',$3,$4)",
        [
          randomUUID(),
          actor.id,
          ticketId,
          JSON.stringify({ visibility: input.visibility }),
        ],
      );
  });
}
export async function updateTicket(
  actor: User,
  ticketId: string,
  body: unknown,
) {
  checkStaff(actor);
  const input = z
    .object({
      status: z.enum(["open", "waiting_customer", "waiting_team", "resolved"]),
      priority: z.enum(["standard", "high"]),
      assigned_to: z.string().min(1).max(150).nullable(),
      resolution: z.string().trim().max(4000).default(""),
    })
    .refine(
      (v) => v.status !== "resolved" || v.resolution.length >= 10,
      "Provide a customer-visible resolution of at least 10 characters",
    )
    .parse(body);
  const db = await getDB();
  await db.transaction(async (tx) => {
    const ticket = (
      await tx.query<SupportTicket>(
        "SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE",
        [ticketId],
      )
    ).rows[0];
    if (!ticket) throw new Error("Support ticket not found");
    if (
      input.assigned_to &&
      !(
        await tx.query(
          "SELECT id FROM users WHERE id=$1 AND role IN ('owner','administrator','support')",
          [input.assigned_to],
        )
      ).rows.length
    )
      throw new Error("Choose an authorized support team member");
    if (input.status === "resolved")
      await tx.query(
        "INSERT INTO ticket_messages(id,ticket_id,actor_id,body,visibility) VALUES($1,$2,$3,$4,'public')",
        [randomUUID(), ticketId, actor.id, input.resolution],
      );
    await tx.query(
      "UPDATE support_tickets SET status=$1,priority=$2,assigned_to=$3 WHERE id=$4",
      [input.status, input.priority, input.assigned_to, ticketId],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'support.update',$3,$4)",
      [randomUUID(), actor.id, ticketId, JSON.stringify(input)],
    );
  });
}
