CREATE FUNCTION sky_guard_document_sequence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document sequences are retained'; END IF;
 IF TG_OP='INSERT' AND NEW.counter<>1 THEN RAISE EXCEPTION 'Document sequences start at one'; END IF;
 IF TG_OP='UPDATE' AND ((NEW.period,NEW.kind) IS DISTINCT FROM (OLD.period,OLD.kind) OR NEW.counter<>OLD.counter+1) THEN RAISE EXCEPTION 'Document sequence must advance exactly once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_document_sequence BEFORE INSERT OR UPDATE OR DELETE ON document_sequences FOR EACH ROW EXECUTE FUNCTION sky_guard_document_sequence();
CREATE FUNCTION sky_guard_document_issue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase orders; original invoice_documents; credit refunds;
BEGIN
 SELECT * INTO purchase FROM orders WHERE id=NEW.order_id FOR UPDATE;
 IF NOT FOUND OR NEW.snapshot->>'order_reference'<>NEW.order_id OR (NEW.snapshot->>'total')::integer<>NEW.total OR length(NEW.number)>16 THEN RAISE EXCEPTION 'Document must match its immutable order'; END IF;
 IF NEW.kind='invoice' THEN
   IF NEW.total<>purchase.total OR purchase.status NOT IN ('paid','confirmed','processing','shipped','delivered') OR purchase.payment_state NOT IN ('captured','due','collected','remitted') THEN RAISE EXCEPTION 'Invoice requires accepted payment terms and exact total'; END IF;
 ELSE
   SELECT * INTO original FROM invoice_documents WHERE id=NEW.invoice_id AND kind='invoice' AND order_id=NEW.order_id;
   SELECT * INTO credit FROM refunds WHERE id=NEW.refund_id AND order_id=NEW.order_id;
   IF original.id IS NULL OR credit.id IS NULL OR credit.status<>'processed' OR NEW.total<>credit.amount OR NEW.total+COALESCE((SELECT sum(total) FROM invoice_documents WHERE invoice_id=original.id),0)>original.total THEN RAISE EXCEPTION 'Credit note requires the original invoice and verified bounded refund'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_document_issue BEFORE INSERT ON invoice_documents FOR EACH ROW EXECUTE FUNCTION sky_guard_document_issue();
CREATE FUNCTION sky_guard_exchange() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request returns; replacement orders;
BEGIN
 SELECT * INTO request FROM returns WHERE id=NEW.return_id FOR UPDATE;
 SELECT * INTO replacement FROM orders WHERE id=NEW.replacement_order_id FOR UPDATE;
 IF request.id IS NULL OR replacement.id IS NULL OR request.user_id<>NEW.user_id OR replacement.user_id<>NEW.user_id OR request.resolution<>'exchange' OR request.status<>'inspected' OR request.order_id=replacement.id OR replacement.created_at<request.created_at OR replacement.status IN ('cancelled','expired','refunded') OR NEW.replacement_total<>replacement.total OR NEW.original_value<>(SELECT COALESCE(sum(refund_cap),0) FROM return_items WHERE return_id=request.id) THEN RAISE EXCEPTION 'Exchange must match its inspected return and owned replacement order'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_exchange_link BEFORE INSERT ON exchange_cases FOR EACH ROW EXECUTE FUNCTION sky_guard_exchange();

CREATE FUNCTION sky_privacy_job_owner(payload JSONB) RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT o.user_id FROM orders o WHERE o.id IN (
 SELECT b.order_id FROM shipment_bookings b WHERE b.id=payload->>'booking_id' OR b.awb=payload#>>'{event,awb}' OR b.sr_shipment_id::text=payload#>>'{event,shipment_id}'
 UNION ALL SELECT f.order_id FROM refunds f WHERE f.id=payload->>'refund_id' OR f.payment_id=payload#>>'{evidence,payment_id}') LIMIT 1;
$$;
CREATE FUNCTION sky_privacy_job_allowed(prior JSONB,updated JSONB) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(prior->>'status' IN ('succeeded','dead') AND prior-ARRAY['payload','last_error']=updated-ARRAY['payload','last_error'] AND EXISTS(SELECT 1 FROM privacy_requests WHERE id=NULLIF(current_setting('sky.privacy_request',true),'') AND status='processing' AND reviewed_by IS NOT NULL AND retain_until<=now() AND user_id=sky_privacy_job_owner(prior->'payload')),false);
$$;
DROP TRIGGER protect_commerce_job ON commerce_jobs;
CREATE TRIGGER protect_commerce_job BEFORE DELETE ON commerce_jobs FOR EACH ROW EXECUTE FUNCTION sky_protect_job();
CREATE TRIGGER privacy_update_protect_commerce_job BEFORE UPDATE ON commerce_jobs FOR EACH ROW WHEN(NOT sky_privacy_job_allowed(to_jsonb(OLD),to_jsonb(NEW))) EXECUTE FUNCTION sky_protect_job();
