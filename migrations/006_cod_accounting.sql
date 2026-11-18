ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('customer','owner','administrator','catalog_editor','fulfillment','support','finance','marketing'));
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending_payment','paid','confirmed','processing','shipped','delivered','cancelled','expired','refunded'));
ALTER TABLE orders DROP CONSTRAINT orders_payment_state_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_state_check CHECK(payment_state IN ('pending','captured','expired','refunded','unknown','due','collected','remitted'));
CREATE TABLE cod_ledger(
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL CHECK(kind IN ('collection','remittance')),
  amount INTEGER NOT NULL CHECK(amount>0), fees INTEGER NOT NULL DEFAULT 0 CHECK(fees>=0 AND fees<=amount),
  reference TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
  evidence TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id,kind,reference), CHECK(kind='remittance' OR fees=0)
);
CREATE INDEX cod_ledger_order_idx ON cod_ledger(order_id,kind);
ALTER TABLE cod_ledger ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_cod_ledger BEFORE UPDATE OR DELETE ON cod_ledger FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
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
  IF (NEW.order_state,NEW.fulfillment_state,NEW.refund_state,NEW.delivered_at)
    IS DISTINCT FROM (OLD.order_state,OLD.fulfillment_state,OLD.refund_state,OLD.delivered_at) THEN RAISE EXCEPTION 'Lifecycle fields must follow a verified order transition'; END IF;
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
      OR (OLD.status='confirmed' AND NEW.status='cancelled')
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
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_state IS DISTINCT FROM OLD.payment_state THEN
    INSERT INTO order_status_events(id,order_id,order_state,payment_state,fulfillment_state,refund_state,actor_id,source,reason)
    VALUES(md5(random()::text||clock_timestamp()::text),NEW.id,NEW.order_state,NEW.payment_state,NEW.fulfillment_state,NEW.refund_state,
      NULLIF(current_setting('sky.actor_id',true),''),COALESCE(NULLIF(current_setting('sky.event_source',true),''),'system'),NULLIF(current_setting('sky.event_reason',true),''));
  END IF;RETURN NEW;
END $$;
