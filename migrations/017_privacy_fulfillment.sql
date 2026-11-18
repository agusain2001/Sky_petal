ALTER TABLE privacy_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','retained','processing','completed','cancelled'));
ALTER TABLE privacy_requests ADD COLUMN reviewed_by TEXT REFERENCES users(id);
ALTER TABLE privacy_requests ADD COLUMN policy_snapshot JSONB;
ALTER TABLE privacy_requests ADD COLUMN retain_until TIMESTAMPTZ;
ALTER TABLE privacy_requests ADD COLUMN decision TEXT;
ALTER TABLE privacy_requests ADD COLUMN subject_email TEXT;
ALTER TABLE privacy_requests ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE privacy_requests ADD COLUMN external_followup BOOLEAN NOT NULL DEFAULT false;
WITH duplicates AS (SELECT id,row_number() OVER(PARTITION BY user_id ORDER BY created_at DESC,id DESC) rank FROM privacy_requests WHERE kind='delete')
UPDATE privacy_requests SET status='cancelled',decision='Duplicate historical request retained; latest request remains open' WHERE id IN (SELECT id FROM duplicates WHERE rank>1);
CREATE UNIQUE INDEX one_open_deletion ON privacy_requests(user_id) WHERE kind='delete' AND status IN ('requested','retained','processing');
CREATE TABLE privacy_events(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES privacy_requests(id),actor_id TEXT REFERENCES users(id),status TEXT NOT NULL,detail TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE privacy_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_privacy_events BEFORE UPDATE OR DELETE ON privacy_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();

-- A short-lived, reviewed retention-expiry transaction may erase PERSONAL fields
-- only. Accounting identity, amounts, statuses, inventory and timestamps remain
-- subject to their original guards. Ordinary UPDATEs still use those guards.
CREATE FUNCTION sky_privacy_row_allowed(tab TEXT,prior JSONB,updated JSONB) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE request privacy_requests; owner_id TEXT; fields TEXT[];
BEGIN
 SELECT * INTO request FROM privacy_requests WHERE id=NULLIF(current_setting('sky.privacy_request',true),'')
 AND kind='delete' AND status='processing' AND reviewed_by IS NOT NULL AND retain_until<=now();
 IF NOT FOUND THEN RETURN false; END IF;
 CASE tab
 WHEN 'orders' THEN owner_id:=prior->>'user_id';fields:=ARRAY['address','billing_address'];
 WHEN 'checkout_quotes' THEN
   owner_id:=prior->>'user_id';fields:=ARRAY['content'];
   IF (prior->'content')-ARRAY['address','billing_address'] IS DISTINCT FROM (updated->'content')-ARRAY['address','billing_address'] THEN RETURN false; END IF;
 WHEN 'invoice_documents' THEN
   SELECT user_id INTO owner_id FROM orders WHERE id=prior->>'order_id';fields:=ARRAY['snapshot'];
   IF (prior->'snapshot')-'buyer' IS DISTINCT FROM (updated->'snapshot')-'buyer' THEN RETURN false; END IF;
 WHEN 'shipment_bookings' THEN SELECT user_id INTO owner_id FROM orders WHERE id=prior->>'order_id';fields:=ARRAY['request_snapshot','label_url','manifest_url','last_error'];
 WHEN 'shipment_tracking_events' THEN SELECT user_id INTO owner_id FROM orders WHERE id=prior->>'order_id';fields:=ARRAY['scans','label'];
 WHEN 'returns' THEN owner_id:=prior->>'user_id';fields:=ARRAY['reason','policy_snapshot','review_note','receipt_reference'];
 WHEN 'return_events' THEN SELECT user_id INTO owner_id FROM returns WHERE id=prior->>'return_id';fields:=ARRAY['message'];
 WHEN 'return_inspections' THEN SELECT r.user_id INTO owner_id FROM return_items i JOIN returns r ON r.id=i.return_id WHERE i.id=prior->>'return_item_id';fields:=ARRAY['condition_note'];
 WHEN 'support_tickets' THEN owner_id:=prior->>'user_id';fields:=ARRAY['subject','body'];
 WHEN 'ticket_messages' THEN SELECT user_id INTO owner_id FROM support_tickets WHERE id=prior->>'ticket_id';fields:=ARRAY['body'];
 WHEN 'refunds' THEN SELECT user_id INTO owner_id FROM orders WHERE id=prior->>'order_id';fields:=ARRAY['reason','evidence_ref'];
 WHEN 'refund_events' THEN SELECT o.user_id INTO owner_id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE f.id=prior->>'refund_id';fields:=ARRAY['evidence_ref'];
 WHEN 'refund_evidence_corrections' THEN SELECT o.user_id INTO owner_id FROM refunds f JOIN orders o ON o.id=f.order_id WHERE f.id=prior->>'refund_id';fields:=ARRAY['reason','independent_proof','original_ref','previous_ref','corrected_ref'];
 WHEN 'refund_evidence_approvals' THEN SELECT o.user_id INTO owner_id FROM refund_evidence_corrections c JOIN refunds f ON f.id=c.refund_id JOIN orders o ON o.id=f.order_id WHERE c.id=prior->>'correction_id';fields:=ARRAY['reconciliation_ref'];
 WHEN 'cod_ledger' THEN SELECT user_id INTO owner_id FROM orders WHERE id=prior->>'order_id';fields:=ARRAY['evidence','reference'];
 WHEN 'newsletter_consent_events' THEN
   IF prior->>'email'=request.subject_email THEN owner_id:=request.user_id; END IF;fields:=ARRAY['email'];
 WHEN 'audit_logs' THEN
   IF prior->>'actor_id'=request.user_id OR EXISTS(SELECT 1 FROM orders WHERE user_id=request.user_id AND id=prior->>'target_id') OR EXISTS(SELECT 1 FROM returns WHERE user_id=request.user_id AND id=prior->>'target_id') OR EXISTS(SELECT 1 FROM refunds f JOIN orders o ON o.id=f.order_id WHERE o.user_id=request.user_id AND f.id=prior->>'target_id') THEN owner_id:=request.user_id; END IF;fields:=ARRAY['details'];
 ELSE RETURN false;
 END CASE;
 RETURN COALESCE(owner_id=request.user_id AND prior-fields=updated-fields,false);
END $$;

-- Preserve every original trigger for ordinary operations. Split its UPDATE
-- arm so the narrowly scoped erasure above does not require disabling triggers.
DO $$ DECLARE t record; remaining TEXT; timing TEXT; BEGIN
 FOR t IN SELECT tg.tgname,tg.tgtype,c.relname,p.proname FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_proc p ON p.oid=tg.tgfoid
 WHERE NOT tg.tgisinternal AND (tg.tgtype & 16)>0 AND c.relname IN ('orders','checkout_quotes','invoice_documents','shipment_bookings','shipment_tracking_events','returns','return_events','return_inspections','support_tickets','ticket_messages','refunds','refund_events','refund_evidence_corrections','refund_evidence_approvals','cod_ledger','newsletter_consent_events','audit_logs') LOOP
 timing:=CASE WHEN (t.tgtype & 2)>0 THEN 'BEFORE' ELSE 'AFTER' END;
 EXECUTE format('DROP TRIGGER %I ON %I',t.tgname,t.relname);
 remaining:=concat_ws(' OR ',CASE WHEN (t.tgtype & 4)>0 THEN 'INSERT' END,CASE WHEN (t.tgtype & 8)>0 THEN 'DELETE' END);
 IF remaining<>'' THEN EXECUTE format('CREATE TRIGGER %I %s %s ON %I FOR EACH ROW EXECUTE FUNCTION %I()',t.tgname,timing,remaining,t.relname,t.proname); END IF;
 EXECUTE format('CREATE TRIGGER %I %s UPDATE ON %I FOR EACH ROW WHEN (NOT sky_privacy_row_allowed(%L,to_jsonb(OLD),to_jsonb(NEW))) EXECUTE FUNCTION %I()','privacy_update_'||t.tgname,timing,t.relname,t.relname,t.proname);
 END LOOP;
END $$;
