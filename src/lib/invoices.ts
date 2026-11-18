import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDB } from "./db";
import { stateCode } from "./commerce-config";
import type { User, Order } from "./types";
import {
  allocateDiscount,
  type QueryClient,
  type QuotedLine,
  type TaxBreakdown,
} from "./pricing";
const text = z.string().trim().min(2).max(300);
export const invoiceConfigSchema = z.object({
  legal_name: text,
  address: text,
  gstin: z
    .string()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
  state_code: z.string().regex(/^\d{2}$/),
  prefix: z.string().regex(/^[A-Z]{1,3}$/),
  approval_reference: text,
});
export type InvoiceConfig = z.infer<typeof invoiceConfigSchema>;
type CreditSource = TaxBreakdown & {
  reference: string;
  label: string;
  net_paise: number;
};
type CreditLine = TaxBreakdown & {
  reference: string;
  label: string;
  amount: number;
};
type Snapshot = {
  issuer: InvoiceConfig;
  buyer: Record<string, string>;
  order_reference: string;
  payment_method: string;
  payment_state: string;
  lines: QuotedLine[];
  shipping: number;
  cod_fee: number;
  discount: number;
  total: number;
  tax: TaxBreakdown;
  original_number?: string;
  refund_reference?: string;
  credit_tax?: TaxBreakdown;
  sources?: CreditSource[];
  credit_lines?: CreditLine[];
  return_reference?: string;
};
export type InvoiceDocument = {
  id: string;
  number: string;
  kind: "invoice" | "credit_note";
  order_id: string;
  invoice_id: string | null;
  refund_id: string | null;
  total: number;
  snapshot: Snapshot;
  issued_at: string;
};
function finance(actor: User) {
  if (!["owner", "administrator", "finance"].includes(actor.role))
    throw new Error("You do not have permission to manage invoices");
}
export async function invoiceConfig() {
  return (
    (
      await (
        await getDB()
      ).query<{ value: InvoiceConfig }>(
        "SELECT value FROM site_settings WHERE key='invoicing'",
      )
    ).rows[0]?.value || null
  );
}
export async function saveInvoiceConfig(actor: User, input: unknown) {
  if (!["owner", "administrator"].includes(actor.role))
    throw new Error("You do not have permission to configure invoices");
  const config = invoiceConfigSchema.parse(input),
    db = await getDB();
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO site_settings VALUES('invoicing',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(config)],
    );
    await tx.query(
      "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,'invoice.configure','invoicing',$3)",
      [
        randomUUID(),
        actor.id,
        JSON.stringify({ approval_reference: config.approval_reference }),
      ],
    );
  });
  return config;
}
export function financialPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year =
    Number(parts.find((p) => p.type === "year")!.value) -
    (Number(parts.find((p) => p.type === "month")!.value) < 4 ? 1 : 0);
  return String(year).slice(-2) + String(year + 1).slice(-2);
}
async function number(tx: QueryClient, kind: string, prefix: string) {
  const period = financialPeriod();
  const row = (
    await tx.query<{ counter: number }>(
      "INSERT INTO document_sequences VALUES($1,$2,1) ON CONFLICT(period,kind) DO UPDATE SET counter=document_sequences.counter+1 RETURNING counter",
      [period, kind],
    )
  ).rows[0];
  return `${prefix}${kind === "credit_note" ? "C" : ""}/${period}/${String(row.counter).padStart(6, "0")}`;
}
function validateSnapshot(
  order: Order,
  lines: QuotedLine[],
  tax: TaxBreakdown,
) {
  if (
    !lines.length ||
    lines.some(
      (l) =>
        !Number.isInteger(l.net_paise) ||
        !l.hsn ||
        !Number.isInteger(l.tax_paise),
    ) ||
    !tax ||
    !Number.isInteger(tax.tax_paise) ||
    lines.reduce((n, l) => n + l.net_paise, 0) +
      order.shipping +
      order.cod_fee !==
      order.total
  )
    throw new Error(
      "Approved tax and pricing snapshots are required before invoicing this order",
    );
}
async function orderSources(tx: QueryClient, orderId: string) {
  const lines = (
    await tx.query<{ id: string; title: string; pricing_snapshot: QuotedLine }>(
      "SELECT id,title,pricing_snapshot FROM order_items WHERE order_id=$1 ORDER BY id",
      [orderId],
    )
  ).rows;
  const sources: CreditSource[] = lines.map((l) => ({
    reference: `item:${l.id}`,
    label: l.title,
    net_paise: l.pricing_snapshot.net_paise,
    taxable_paise: l.pricing_snapshot.taxable_paise,
    tax_paise: l.pricing_snapshot.tax_paise,
    cgst_paise: l.pricing_snapshot.cgst_paise,
    sgst_paise: l.pricing_snapshot.sgst_paise,
    igst_paise: l.pricing_snapshot.igst_paise,
  }));
  const quote = (
    await tx.query<{
      content: {
        shipping: number;
        cod_fee: number;
        shipping_tax: TaxBreakdown;
        cod_tax: TaxBreakdown;
      };
    }>(
      "SELECT q.content FROM checkout_quotes q JOIN orders o ON o.quote_id=q.id WHERE o.id=$1",
      [orderId],
    )
  ).rows[0]?.content;
  if (!quote)
    throw new Error(
      "Immutable delivery and tax allocation snapshots are unavailable",
    );
  if (quote.shipping > 0)
    sources.push({
      reference: "shipping",
      label: "Delivery charge",
      net_paise: quote.shipping,
      ...quote.shipping_tax,
    });
  if (quote.cod_fee > 0)
    sources.push({
      reference: "cod_fee",
      label: "COD fee",
      net_paise: quote.cod_fee,
      ...quote.cod_tax,
    });
  return sources;
}
export async function issueInvoice(actor: User, orderId: string) {
  finance(actor);
  const config = invoiceConfigSchema.parse(await invoiceConfig()),
    db = await getDB();
  return db.transaction(async (tx) => {
    const order = (
      await tx.query<Order & { tax_snapshot: TaxBreakdown }>(
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    if (!order) throw new Error("Order not found");
    const old = (
      await tx.query<InvoiceDocument>(
        "SELECT * FROM invoice_documents WHERE order_id=$1 AND kind='invoice'",
        [orderId],
      )
    ).rows[0];
    if (old) return old;
    if (
      (
        await tx.query(
          "SELECT id FROM privacy_requests WHERE user_id=$1 AND kind='delete' AND status='completed'",
          [order.user_id],
        )
      ).rows.length
    )
      throw new Error(
        "Personal invoice data has passed its approved retention period",
      );
    if (
      !["confirmed", "processing", "shipped", "delivered", "paid"].includes(
        order.status,
      ) ||
      !["captured", "due", "collected", "remitted"].includes(
        order.payment_state,
      )
    )
      throw new Error(
        "An accepted order with verified payment terms is required",
      );
    const items = (
      await tx.query<{ pricing_snapshot: QuotedLine }>(
        "SELECT pricing_snapshot FROM order_items WHERE order_id=$1 ORDER BY id",
        [orderId],
      )
    ).rows;
    const lines = items.map((i) => i.pricing_snapshot);
    if (lines.some((l) => !l))
      throw new Error("Approved pricing snapshots are missing");
    validateSnapshot(order, lines, order.tax_snapshot);
    if (
      (config.gstin && config.gstin.slice(0, 2) !== config.state_code) ||
      (order.tax_snapshot.tax_paise > 0 && !config.gstin)
    )
      throw new Error(
        "Approved GST registration must match the issuer state and charged tax",
      );
    const shipping = (
      await tx.query<{ shipping_snapshot: { origin_state?: string } | null }>(
        "SELECT shipping_snapshot FROM orders WHERE id=$1",
        [orderId],
      )
    ).rows[0];
    if (
      !shipping.shipping_snapshot?.origin_state ||
      stateCode(shipping.shipping_snapshot.origin_state) !== config.state_code
    )
      throw new Error(
        "Invoice issuer state does not match the immutable checkout tax origin",
      );
    const snapshot: Snapshot = {
      issuer: config,
      buyer: order.billing_address || order.address,
      order_reference: order.id,
      payment_method: order.payment_method,
      payment_state: order.payment_state,
      lines,
      shipping: order.shipping,
      cod_fee: order.cod_fee,
      discount: order.discount,
      total: order.total,
      tax: order.tax_snapshot,
      sources: await orderSources(tx, orderId),
    };
    return insert(
      tx,
      actor,
      order.id,
      "invoice",
      order.total,
      snapshot,
      config.prefix,
    );
  });
}
async function insert(
  tx: QueryClient,
  actor: User,
  orderId: string,
  kind: string,
  total: number,
  snapshot: Snapshot,
  prefix: string,
  invoiceId: string | null = null,
  refundId: string | null = null,
) {
  const document = (
    await tx.query<InvoiceDocument>(
      "INSERT INTO invoice_documents(id,number,kind,order_id,invoice_id,refund_id,total,snapshot,issued_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [
        randomUUID(),
        await number(tx, kind, prefix),
        kind,
        orderId,
        invoiceId,
        refundId,
        total,
        JSON.stringify(snapshot),
        actor.id,
      ],
    )
  ).rows[0];
  await tx.query(
    "INSERT INTO audit_logs(id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      actor.id,
      `document.${kind}.issued`,
      document.id,
      JSON.stringify({ order_id: orderId, number: document.number }),
    ],
  );
  return document;
}
export async function issueCreditNote(
  actor: User,
  refundId: string,
  input?: unknown,
) {
  finance(actor);
  const specifiedAllocations = z
    .array(
      z.object({
        reference: z.string().min(1).max(200),
        amount: z.number().int().positive(),
      }),
    )
    .max(100)
    .optional()
    .parse(input);
  const db = await getDB();
  return db.transaction(async (tx) => {
    const refund = (
      await tx.query<{
        order_id: string;
        status: string;
        amount: number;
        return_id: string | null;
      }>("SELECT order_id,status,amount,return_id FROM refunds WHERE id=$1", [
        refundId,
      ])
    ).rows[0];
    if (!refund) throw new Error("Refund not found");
    await tx.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [
      refund.order_id,
    ]);
    const old = (
      await tx.query<InvoiceDocument>(
        "SELECT * FROM invoice_documents WHERE refund_id=$1",
        [refundId],
      )
    ).rows[0];
    if (old) {
      if (specifiedAllocations?.length) {
        const canonical = (lines: { reference: string; amount: number }[]) =>
          JSON.stringify(
            lines
              .map((l) => ({ reference: l.reference, amount: l.amount }))
              .sort((a, b) => a.reference.localeCompare(b.reference)),
          );
        if (
          canonical(specifiedAllocations) !==
          canonical(old.snapshot.credit_lines || [])
        )
          throw new Error(
            "Credit note already issued with different allocations",
          );
      }
      return old;
    }
    if (refund.status !== "processed")
      throw new Error(
        "A verified completed refund is required for a credit note",
      );
    const invoice = (
      await tx.query<InvoiceDocument>(
        "SELECT * FROM invoice_documents WHERE order_id=$1 AND kind='invoice'",
        [refund.order_id],
      )
    ).rows[0];
    if (!invoice)
      throw new Error("Issue the original invoice before a credit note");
    const notes = (
      await tx.query<InvoiceDocument>(
        "SELECT * FROM invoice_documents WHERE invoice_id=$1",
        [invoice.id],
      )
    ).rows;
    const prior = notes.reduce((n, d) => n + d.total, 0);
    if (prior + refund.amount > invoice.total)
      throw new Error("Credit notes exceed the original invoice");
    const sources =
      invoice.snapshot.sources || (await orderSources(tx, invoice.order_id));
    if (
      sources.reduce((sum, s) => sum + s.net_paise, 0) !== invoice.total ||
      notes.some((n) => !n.snapshot.credit_lines)
    )
      throw new Error(
        "Original credit allocation requires financial review before further issuance",
      );
    const previously = (reference: string, filter = notes) =>
      filter
        .flatMap((n) => n.snapshot.credit_lines || [])
        .filter((l) => l.reference === reference)
        .reduce((sum, l) => sum + l.amount, 0);
    const eligible = new Map(
      sources.map((s) => [s.reference, s.net_paise - previously(s.reference)]),
    );
    if (refund.return_id) {
      const items = (
        await tx.query<{ order_item_id: string; refund_cap: number }>(
          "SELECT order_item_id,refund_cap FROM return_items WHERE return_id=$1",
          [refund.return_id],
        )
      ).rows;
      const rmaNotes = notes.filter(
        (n) => n.snapshot.return_reference === refund.return_id,
      );
      for (const source of sources) {
        const item = items.find(
          (i) => `item:${i.order_item_id}` === source.reference,
        );
        eligible.set(
          source.reference,
          item
            ? Math.min(
                eligible.get(source.reference)!,
                item.refund_cap - previously(source.reference, rmaNotes),
              )
            : 0,
        );
      }
    }
    let allocations = specifiedAllocations;
    if (!allocations?.length) {
      if (
        !refund.return_id &&
        refund.amount !== [...eligible.values()].reduce((a, b) => a + b, 0)
      )
        throw new Error(
          "Allocate this partial refund to its original invoice lines or charges before issuing the credit note",
        );
      if ([...eligible.values()].reduce((a, b) => a + b, 0) < refund.amount)
        throw new Error("Refund exceeds remaining eligible invoice lines");
      const parts = allocateDiscount(
        sources.map((s) => eligible.get(s.reference)!),
        refund.amount,
      );
      allocations = sources
        .map((s, i) => ({ reference: s.reference, amount: parts[i] }))
        .filter((a) => a.amount > 0);
    }
    if (
      new Set(allocations.map((a) => a.reference)).size !==
        allocations.length ||
      allocations.reduce((n, a) => n + a.amount, 0) !== refund.amount ||
      allocations.some(
        (a) =>
          !eligible.has(a.reference) || a.amount > eligible.get(a.reference)!,
      )
    )
      throw new Error(
        "Credit allocations must match the verified refund and remaining original line values",
      );
    const cumulative = (source: CreditSource, net: number) => {
      const tax = Number(
        (BigInt(source.tax_paise) * BigInt(net)) / BigInt(source.net_paise),
      );
      const cgst = source.igst_paise
        ? 0
        : source.tax_paise
          ? Number(
              (BigInt(tax) * BigInt(source.cgst_paise)) /
                BigInt(source.tax_paise),
            )
          : 0;
      return {
        tax_paise: tax,
        cgst_paise: cgst,
        sgst_paise: source.igst_paise ? 0 : tax - cgst,
        igst_paise: source.igst_paise ? tax : 0,
      };
    };
    const credit_lines: CreditLine[] = allocations.map((a) => {
      const source = sources.find((s) => s.reference === a.reference)!,
        before = cumulative(source, previously(a.reference)),
        after = cumulative(source, previously(a.reference) + a.amount),
        tax = after.tax_paise - before.tax_paise;
      return {
        reference: a.reference,
        label: source.label,
        amount: a.amount,
        taxable_paise: a.amount - tax,
        tax_paise: tax,
        cgst_paise: after.cgst_paise - before.cgst_paise,
        sgst_paise: after.sgst_paise - before.sgst_paise,
        igst_paise: after.igst_paise - before.igst_paise,
      };
    });
    const credit_tax = credit_lines.reduce(
      (t, l) => ({
        taxable_paise: t.taxable_paise + l.taxable_paise,
        tax_paise: t.tax_paise + l.tax_paise,
        cgst_paise: t.cgst_paise + l.cgst_paise,
        sgst_paise: t.sgst_paise + l.sgst_paise,
        igst_paise: t.igst_paise + l.igst_paise,
      }),
      {
        taxable_paise: 0,
        tax_paise: 0,
        cgst_paise: 0,
        sgst_paise: 0,
        igst_paise: 0,
      },
    );
    return insert(
      tx,
      actor,
      invoice.order_id,
      "credit_note",
      refund.amount,
      {
        ...invoice.snapshot,
        total: refund.amount,
        original_number: invoice.number,
        refund_reference: refundId,
        credit_tax,
        credit_lines,
        return_reference: refund.return_id || undefined,
      },
      invoice.snapshot.issuer.prefix,
      invoice.id,
      refundId,
    );
  });
}
export async function listDocuments(actor: User, orderId?: string) {
  const staff = ["owner", "administrator", "finance"].includes(actor.role);
  return (
    await (
      await getDB()
    ).query<InvoiceDocument>(
      `SELECT d.* FROM invoice_documents d JOIN orders o ON o.id=d.order_id WHERE ${staff ? "true" : "o.user_id=$1"} ${orderId ? `AND o.id=$${staff ? 1 : 2}` : ""} ORDER BY d.issued_at DESC,d.id LIMIT 100`,
      [...(!staff ? [actor.id] : []), ...(orderId ? [orderId] : [])],
    )
  ).rows;
}
export async function readDocument(actor: User, id: string) {
  const staff = ["owner", "administrator", "finance"].includes(actor.role);
  const row = (
    await (
      await getDB()
    ).query<InvoiceDocument>(
      `SELECT d.* FROM invoice_documents d JOIN orders o ON o.id=d.order_id WHERE d.id=$1 ${staff ? "" : "AND o.user_id=$2"}`,
      [id, ...(!staff ? [actor.id] : [])],
    )
  ).rows[0];
  if (!row) throw new Error("Document not found");
  return row;
}
export async function documentPdf(document: InvoiceDocument) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib"),
    pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]),
    y = 795;
  function line(value: string, size = 10, heading = false) {
    const parts = value.match(/.{1,85}(?:\s|$)|.{1,85}/g) || [value];
    for (const part of parts) {
      if (y < 55) {
        page = pdf.addPage([595, 842]);
        y = 795;
      }
      try {
        page.drawText(part.trim(), {
          x: 44,
          y,
          size,
          font: heading ? bold : font,
          color: rgb(0.15, 0.1, 0.14),
        });
      } catch {
        throw new Error(
          "Document contains characters unsupported by the PDF font; download the exact JSON snapshot or contact finance",
        );
      }
      y -= size + 7;
    }
  }
  const s = document.snapshot,
    amount = (n: number) => `INR ${(n / 100).toFixed(2)}`;
  line(document.kind === "invoice" ? "INVOICE" : "CREDIT NOTE", 22, true);
  line(document.number, 14, true);
  line(
    `Issued: ${new Date(document.issued_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`,
  );
  line(s.issuer.legal_name, 12, true);
  line(s.issuer.address);
  if (s.issuer.gstin) line(`GSTIN: ${s.issuer.gstin}`);
  line(`Order: ${s.order_reference}`);
  line(`Bill to: ${Object.values(s.buyer).filter(Boolean).join(", ")}`);
  y -= 8;
  if (document.kind === "invoice") {
    for (const l of s.lines) {
      line(`${l.title} - ${l.color} / ${l.size}`, 11, true);
      line(
        `SKU ${l.sku}; HSN ${l.hsn}; Qty ${l.quantity}; Net ${amount(l.net_paise)}`,
      );
      line(
        `Taxable ${amount(l.taxable_paise)}; CGST ${amount(l.cgst_paise)}; SGST ${amount(l.sgst_paise)}; IGST ${amount(l.igst_paise)}`,
      );
    }
    line(`Discount included: ${amount(s.discount)}`);
    line(`Delivery: ${amount(s.shipping)}; COD fee: ${amount(s.cod_fee)}`);
  } else {
    line(`Original invoice: ${s.original_number}`);
    line(`Completed refund reference: ${s.refund_reference}`);
    line(
      "Credit allocated to original invoice items/charges; original document remains unchanged.",
    );
    for (const item of s.credit_lines || []) {
      line(`${item.label}: ${amount(item.amount)}`, 11, true);
      line(
        `Taxable ${amount(item.taxable_paise)}; CGST ${amount(item.cgst_paise)}; SGST ${amount(item.sgst_paise)}; IGST ${amount(item.igst_paise)}`,
      );
    }
  }
  const tax = s.credit_tax || s.tax;
  line(`Taxable: ${amount(tax.taxable_paise)}`);
  line(
    `CGST: ${amount(tax.cgst_paise)}; SGST: ${amount(tax.sgst_paise)}; IGST: ${amount(tax.igst_paise)}`,
  );
  line(`TOTAL ${amount(document.total)}`, 16, true);
  if (document.kind === "invoice")
    line(
      `Payment terms: ${s.payment_method}; state at issue: ${s.payment_state}. This invoice is not proof of collection.`,
    );
  line(`Policy approval reference: ${s.issuer.approval_reference}`, 9);
  pdf.setTitle(document.number);
  return pdf.save();
}
