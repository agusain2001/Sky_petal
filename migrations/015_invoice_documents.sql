CREATE TABLE document_sequences(period TEXT NOT NULL,kind TEXT NOT NULL,counter INTEGER NOT NULL CHECK(counter BETWEEN 1 AND 999999),PRIMARY KEY(period,kind));
CREATE TABLE invoice_documents(
 id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,kind TEXT NOT NULL CHECK(kind IN ('invoice','credit_note')),
 order_id TEXT NOT NULL REFERENCES orders(id),invoice_id TEXT REFERENCES invoice_documents(id),
 refund_id TEXT UNIQUE REFERENCES refunds(id),total INTEGER NOT NULL CHECK(total>0),snapshot JSONB NOT NULL,
 issued_by TEXT NOT NULL REFERENCES users(id),issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((kind='invoice' AND invoice_id IS NULL AND refund_id IS NULL) OR (kind='credit_note' AND invoice_id IS NOT NULL AND refund_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_invoice_per_order ON invoice_documents(order_id) WHERE kind='invoice';
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_invoice_document BEFORE UPDATE OR DELETE ON invoice_documents FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
