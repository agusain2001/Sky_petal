import { getDB } from "./db";
/** Explicit projections keep credentials, staff notes, bank evidence and worker
 * payloads out of a customer download. Read one consistent database snapshot. */
export async function exportCustomerData(userId: string) {
  const db = await getDB();
  return db.transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const profile = (
      await tx.query("SELECT id,email,name,created_at FROM users WHERE id=$1", [
        userId,
      ])
    ).rows[0];
    if (!profile) throw new Error("Customer not found");
    const queries: Record<string, string> = {
      addresses:
        "SELECT id,content,created_at,updated_at FROM addresses WHERE user_id=$1",
      orders: "SELECT * FROM orders WHERE user_id=$1",
      order_items:
        "SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.user_id=$1",
      order_events:
        "SELECT e.id,e.order_id,e.order_state,e.payment_state,e.fulfillment_state,e.refund_state,e.source,e.created_at FROM order_status_events e JOIN orders o ON o.id=e.order_id WHERE o.user_id=$1",
      payments:
        "SELECT p.id,p.order_id,p.amount,p.status,p.provider FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=$1",
      payment_attempts:
        "SELECT a.order_id,a.amount,a.currency,a.state,a.created_at,a.updated_at FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE o.user_id=$1",
      payment_observations:
        "SELECT p.payment_id,p.amount,p.currency,p.state,p.source,p.created_at FROM payment_observations p JOIN orders o ON o.provider_id=p.provider_order_id WHERE o.user_id=$1",
      payment_client_events:
        "SELECT order_id,kind,created_at FROM payment_client_events WHERE user_id=$1",
      shipments:
        "SELECT s.* FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.user_id=$1",
      tracking:
        "SELECT t.id,t.order_id,t.label,t.status_code,t.occurred_at,t.scans FROM shipment_tracking_events t JOIN orders o ON o.id=t.order_id WHERE o.user_id=$1",
      returns:
        "SELECT id,order_id,reason,reason_code,resolution,status,review_note,policy_snapshot,created_at FROM returns WHERE user_id=$1",
      return_items:
        "SELECT i.* FROM return_items i JOIN returns r ON r.id=i.return_id WHERE r.user_id=$1",
      return_events:
        "SELECT e.id,e.return_id,e.status,e.message,e.created_at FROM return_events e JOIN returns r ON r.id=e.return_id WHERE r.user_id=$1",
      refunds:
        "SELECT r.id,r.order_id,r.return_id,r.amount,r.status,r.method,r.created_at FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.user_id=$1",
      support_tickets:
        "SELECT id,subject,body,order_id,topic,status,priority,created_at,updated_at FROM support_tickets WHERE user_id=$1",
      support_messages:
        "SELECT m.id,m.ticket_id,m.body,m.visibility,m.created_at FROM ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id WHERE t.user_id=$1 AND m.visibility='public'",
      wishlist: "SELECT product_id FROM wishlists WHERE user_id=$1",
      cart: "SELECT i.* FROM cart_items i JOIN carts c ON c.id=i.cart_id WHERE c.user_id=$1",
      reviews: "SELECT * FROM reviews WHERE user_id=$1",
      notifications:
        "SELECT id,event_key,order_id,title,message,read_at,created_at FROM account_notifications WHERE user_id=$1",
      privacy_requests:
        "SELECT id,kind,status,retain_until,decision,completed_at,external_followup,created_at FROM privacy_requests WHERE user_id=$1",
      exchanges:
        "SELECT id,return_id,replacement_order_id,original_value,replacement_total,created_at FROM exchange_cases WHERE user_id=$1",
      invoice_documents:
        "SELECT d.id,d.number,d.kind,d.total,d.snapshot,d.issued_at FROM invoice_documents d JOIN orders o ON o.id=d.order_id WHERE o.user_id=$1",
      newsletter:
        "SELECT n.email,n.status,n.consent_version,n.consent_source,n.consent_at FROM newsletter n JOIN users u ON lower(u.email)=n.email WHERE u.id=$1",
      consent_events:
        "SELECT e.id,e.email,e.decision,e.version,e.source,e.created_at FROM newsletter_consent_events e JOIN users u ON lower(u.email)=e.email WHERE u.id=$1",
    };
    const result: Record<string, unknown> = {
      profile,
      exported_at: new Date().toISOString(),
    };
    for (const [key, sql] of Object.entries(queries))
      result[key] = (await tx.query(sql, [userId])).rows;
    return result;
  });
}
