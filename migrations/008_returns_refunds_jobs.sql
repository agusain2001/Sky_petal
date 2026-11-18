ALTER TABLE products ADD COLUMN return_window_days INTEGER CHECK(return_window_days BETWEEN 0 AND 365);
ALTER TABLE products ADD COLUMN sealed_return_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE returns ADD COLUMN request_key TEXT;
ALTER TABLE returns ADD COLUMN reason_code TEXT NOT NULL DEFAULT 'other';
ALTER TABLE returns ADD COLUMN resolution TEXT NOT NULL DEFAULT 'refund' CHECK(resolution IN ('refund','exchange'));
ALTER TABLE returns ADD COLUMN review_note TEXT;
ALTER TABLE returns ADD COLUMN receipt_reference TEXT;
ALTER TABLE returns ADD COLUMN policy_snapshot JSONB;
CREATE UNIQUE INDEX return_request_key_idx ON returns(user_id,request_key) WHERE request_key IS NOT NULL;
CREATE TABLE return_items(
  id TEXT PRIMARY KEY, return_id TEXT NOT NULL REFERENCES returns(id),order_item_id TEXT NOT NULL REFERENCES order_items(id),
  quantity INTEGER NOT NULL CHECK(quantity>0),refund_cap INTEGER NOT NULL CHECK(refund_cap>=0),
  UNIQUE(return_id,order_item_id)
);
CREATE TABLE return_inspections(
  id TEXT PRIMARY KEY,return_item_id TEXT NOT NULL UNIQUE REFERENCES return_items(id),
  disposition TEXT NOT NULL CHECK(disposition IN ('restock','quarantine','dispose')),
  condition_note TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE return_events(id TEXT PRIMARY KEY,return_id TEXT NOT NULL REFERENCES returns(id),status TEXT NOT NULL,actor_id TEXT REFERENCES users(id),message TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX return_items_order_idx ON return_items(order_item_id);
CREATE INDEX return_events_request_idx ON return_events(return_id,created_at,id);
ALTER TABLE refunds ADD COLUMN return_id TEXT REFERENCES returns(id);
ALTER TABLE refunds ADD COLUMN payment_id TEXT REFERENCES payments(id);
ALTER TABLE refunds ADD COLUMN method TEXT NOT NULL DEFAULT 'razorpay' CHECK(method IN ('razorpay','manual_cod'));
ALTER TABLE refunds ADD COLUMN reason TEXT;
ALTER TABLE refunds ADD COLUMN request_key TEXT UNIQUE;
ALTER TABLE refunds ADD COLUMN requested_by TEXT REFERENCES users(id);
ALTER TABLE refunds ADD COLUMN approved_by TEXT REFERENCES users(id);
ALTER TABLE refunds ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE refunds ADD COLUMN evidence_ref TEXT;
ALTER TABLE refunds ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE refunds ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX refunds_order_state_idx ON refunds(order_id,status);
CREATE TABLE refund_events(id TEXT PRIMARY KEY,refund_id TEXT NOT NULL REFERENCES refunds(id),status TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,payment_id TEXT,provider_id TEXT,source TEXT NOT NULL,evidence_ref TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX refund_events_refund_idx ON refund_events(refund_id,created_at,id);
CREATE UNIQUE INDEX manual_refund_reference_idx ON refund_events(evidence_ref) WHERE source='manual_cod_verified';
CREATE TABLE commerce_jobs(
  id TEXT PRIMARY KEY,kind TEXT NOT NULL,dedup_key TEXT NOT NULL UNIQUE,payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','failed','succeeded','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,lease_token TEXT,lease_until TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX commerce_jobs_due_idx ON commerce_jobs(status,next_run_at,lease_until);
CREATE TABLE account_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),event_key TEXT NOT NULL UNIQUE,order_id TEXT REFERENCES orders(id),title TEXT NOT NULL,message TEXT NOT NULL,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX account_notifications_user_idx ON account_notifications(user_id,created_at);
ALTER TABLE orders DROP CONSTRAINT orders_refund_state_check;
ALTER TABLE orders ADD CONSTRAINT orders_refund_state_check CHECK(refund_state IN ('none','pending','partially_refunded','refunded'));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['return_items','return_inspections','return_events','refund_events','commerce_jobs','account_notifications'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);END LOOP;END $$;
CREATE POLICY own_return_items ON return_items FOR SELECT USING(EXISTS(SELECT 1 FROM returns WHERE id=return_id AND user_id=sky_uid()));
CREATE POLICY own_return_events ON return_events FOR SELECT USING(EXISTS(SELECT 1 FROM returns WHERE id=return_id AND user_id=sky_uid()));
CREATE POLICY own_refunds ON refunds FOR SELECT USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id AND user_id=sky_uid()));
CREATE POLICY own_notifications ON account_notifications FOR SELECT USING(user_id=sky_uid());
CREATE TRIGGER immutable_return_items BEFORE UPDATE OR DELETE ON return_items FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_return_inspections BEFORE UPDATE OR DELETE ON return_inspections FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_return_events BEFORE UPDATE OR DELETE ON return_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_refund_events BEFORE UPDATE OR DELETE ON refund_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE FUNCTION sky_protect_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Refund history is retained'; END IF;
  IF (NEW.id,NEW.order_id,NEW.amount,NEW.return_id,NEW.payment_id,NEW.method,NEW.reason,NEW.request_key,NEW.requested_by,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.order_id,OLD.amount,OLD.return_id,OLD.payment_id,OLD.method,OLD.reason,OLD.request_key,OLD.requested_by,OLD.created_at) THEN RAISE EXCEPTION 'Refund request history is immutable'; END IF;
  IF OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN RAISE EXCEPTION 'Refund provider identity is immutable'; END IF;
  IF OLD.approved_by IS NOT NULL AND NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN RAISE EXCEPTION 'Refund approval is immutable'; END IF;
  IF OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN RAISE EXCEPTION 'Refund approval time is immutable'; END IF;
  IF OLD.status='processed' AND NEW.status<>'processed' THEN RAISE EXCEPTION 'Processed refund cannot move backwards'; END IF;
  IF NEW.status='processed' AND NOT EXISTS(SELECT 1 FROM refund_events WHERE refund_id=NEW.id AND status='processed' AND amount=NEW.amount AND currency='INR' AND (NEW.method='manual_cod' OR payment_id=NEW.payment_id)) THEN RAISE EXCEPTION 'Verified refund completion evidence is required'; END IF;
  NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER protect_refund BEFORE UPDATE OR DELETE ON refunds FOR EACH ROW EXECUTE FUNCTION sky_protect_refund();
CREATE FUNCTION sky_protect_return() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Return history is retained'; END IF;
  IF (NEW.id,NEW.user_id,NEW.order_id,NEW.reason,NEW.request_key,NEW.reason_code,NEW.resolution,NEW.policy_snapshot,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.order_id,OLD.reason,OLD.request_key,OLD.reason_code,OLD.resolution,OLD.policy_snapshot,OLD.created_at) THEN RAISE EXCEPTION 'Return request snapshot is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_return BEFORE UPDATE OR DELETE ON returns FOR EACH ROW EXECUTE FUNCTION sky_protect_return();
CREATE FUNCTION sky_protect_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Job history is retained'; END IF;
  IF (NEW.id,NEW.kind,NEW.dedup_key,NEW.payload,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.kind,OLD.dedup_key,OLD.payload,OLD.created_at) THEN RAISE EXCEPTION 'Job identity and payload are immutable'; END IF;
  NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER protect_commerce_job BEFORE UPDATE OR DELETE ON commerce_jobs FOR EACH ROW EXECUTE FUNCTION sky_protect_job();

CREATE OR REPLACE FUNCTION sky_protect_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order history is immutable'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'pending_payment' OR NEW.order_state<>'pending_payment' OR NEW.payment_state<>'pending' OR NEW.fulfillment_state<>'unfulfilled' OR NEW.refund_state<>'none' OR NEW.delivered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Orders must begin pending payment';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id,NEW.user_id,NEW.subtotal,NEW.shipping,NEW.discount,NEW.total,NEW.address,NEW.billing_address,NEW.idempotency_key,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.subtotal,OLD.shipping,OLD.discount,OLD.total,OLD.address,OLD.billing_address,OLD.idempotency_key,OLD.created_at) THEN
    RAISE EXCEPTION 'Order accounting and address snapshots are immutable';
  END IF;
  IF (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
    OR (OLD.payment_id IS NOT NULL AND NEW.payment_id IS DISTINCT FROM OLD.payment_id) THEN RAISE EXCEPTION 'Payment references are immutable'; END IF;
  IF (NEW.order_state,NEW.fulfillment_state,NEW.delivered_at)
    IS DISTINCT FROM (OLD.order_state,OLD.fulfillment_state,OLD.delivered_at) THEN RAISE EXCEPTION 'Lifecycle fields must follow a verified order transition'; END IF;
  IF NEW.refund_state IS DISTINCT FROM OLD.refund_state THEN
    IF NEW.refund_state IS DISTINCT FROM (SELECT CASE WHEN COALESCE(sum(amount) FILTER(WHERE status='processed'),0)=NEW.total THEN 'refunded' WHEN COALESCE(sum(amount) FILTER(WHERE status='processed'),0)>0 THEN 'partially_refunded' WHEN count(*) FILTER(WHERE status IN ('requested','approved','processing','pending'))>0 THEN 'pending' ELSE 'none' END FROM refunds WHERE order_id=NEW.id) THEN RAISE EXCEPTION 'Refund state requires ledger evidence'; END IF;
  END IF;
  IF NEW.payment_state IS DISTINCT FROM OLD.payment_state THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR OLD.payment_method<>'cod' OR OLD.fulfillment_state<>'delivered' THEN RAISE EXCEPTION 'Lifecycle fields must follow a verified order transition'; END IF;
    IF NEW.payment_state='collected' AND OLD.payment_state='due' THEN
      IF (SELECT COALESCE(sum(amount),0) FROM cod_ledger WHERE order_id=NEW.id AND kind='collection')<>NEW.total THEN RAISE EXCEPTION 'Full COD collection evidence is required'; END IF;
    ELSIF NEW.payment_state='remitted' AND OLD.payment_state='collected' THEN
      IF (SELECT COALESCE(sum(amount),0) FROM cod_ledger WHERE order_id=NEW.id AND kind='remittance')<>NEW.total THEN RAISE EXCEPTION 'Full COD remittance evidence is required'; END IF;
    ELSE RAISE EXCEPTION 'Invalid COD payment transition'; END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='pending_payment' AND NEW.status IN ('paid','confirmed','expired','cancelled'))
      OR (OLD.status IN ('paid','confirmed') AND NEW.status='processing')
      OR (OLD.status IN ('paid','confirmed') AND NEW.status='cancelled')
      OR (OLD.status='processing' AND NEW.status='shipped')
      OR (OLD.status='shipped' AND NEW.status='delivered')) THEN RAISE EXCEPTION 'Invalid order state transition'; END IF;
    IF NEW.status='paid' THEN
      IF NEW.payment_method<>'prepaid' OR NOT EXISTS(SELECT 1 FROM payments WHERE id=NEW.payment_id AND order_id=NEW.id AND amount=NEW.total AND provider='razorpay' AND status='captured') THEN RAISE EXCEPTION 'Captured payment evidence is required'; END IF;
      NEW.order_state='confirmed'; NEW.payment_state='captured';
    ELSIF NEW.status='confirmed' THEN
      IF NEW.payment_method<>'cod' OR NOT EXISTS(SELECT 1 FROM checkout_quotes WHERE id=NEW.quote_id AND payment_method='cod') THEN RAISE EXCEPTION 'An eligible COD quote is required'; END IF;
      NEW.order_state='confirmed'; NEW.payment_state='due';
    ELSIF NEW.status='expired' THEN
      NEW.order_state='expired'; NEW.payment_state='expired'; NEW.fulfillment_state='cancelled';
    ELSIF NEW.status='cancelled' THEN
      NEW.order_state='cancelled'; NEW.fulfillment_state='cancelled';
    ELSE
      IF NOT ((NEW.payment_method='prepaid' AND NEW.payment_state='captured') OR (NEW.payment_method='cod' AND NEW.payment_state IN ('due','collected','remitted'))) THEN RAISE EXCEPTION 'Order payment eligibility must be verified before fulfillment'; END IF;
      NEW.fulfillment_state=NEW.status;
      IF NEW.status='delivered' THEN NEW.order_state='completed'; NEW.delivered_at=now(); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION sky_record_order_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_state IS DISTINCT FROM OLD.payment_state OR NEW.refund_state IS DISTINCT FROM OLD.refund_state THEN
    INSERT INTO order_status_events(id,order_id,order_state,payment_state,fulfillment_state,refund_state,actor_id,source,reason)
    VALUES(md5(random()::text||clock_timestamp()::text),NEW.id,NEW.order_state,NEW.payment_state,NEW.fulfillment_state,NEW.refund_state,
      NULLIF(current_setting('sky.actor_id',true),''),COALESCE(NULLIF(current_setting('sky.event_source',true),''),'system'),NULLIF(current_setting('sky.event_reason',true),''));
  END IF;RETURN NEW;
END $$;
