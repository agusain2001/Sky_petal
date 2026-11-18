ALTER TABLE orders ADD COLUMN order_state TEXT NOT NULL DEFAULT 'pending_payment'
  CHECK(order_state IN ('pending_payment','confirmed','completed','cancelled','expired','closed'));
ALTER TABLE orders ADD COLUMN payment_state TEXT NOT NULL DEFAULT 'pending'
  CHECK(payment_state IN ('pending','captured','expired','refunded','unknown'));
ALTER TABLE orders ADD COLUMN fulfillment_state TEXT NOT NULL DEFAULT 'unfulfilled'
  CHECK(fulfillment_state IN ('unfulfilled','processing','shipped','delivered','cancelled'));
ALTER TABLE orders ADD COLUMN refund_state TEXT NOT NULL DEFAULT 'none'
  CHECK(refund_state IN ('none','refunded'));
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN billing_address JSONB;
ALTER TABLE order_items ADD COLUMN sku TEXT;
UPDATE orders SET
  order_state=CASE WHEN status='pending_payment' THEN 'pending_payment' WHEN status IN ('paid','processing','shipped') THEN 'confirmed' WHEN status='delivered' THEN 'completed' WHEN status='refunded' THEN 'closed' ELSE status END,
  payment_state=CASE WHEN status IN ('paid','processing','shipped','delivered') THEN 'captured' WHEN status='refunded' THEN 'refunded' WHEN status='expired' THEN 'expired' WHEN status='cancelled' THEN 'unknown' ELSE 'pending' END,
  fulfillment_state=CASE WHEN status IN ('processing','shipped','delivered') THEN status WHEN status IN ('cancelled','expired') THEN 'cancelled' ELSE 'unfulfilled' END,
  refund_state=CASE WHEN status='refunded' THEN 'refunded' ELSE 'none' END;
-- Do not invent delivery timestamps, billing addresses or historic SKU codes for legacy orders.
CREATE TABLE order_status_events(
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  order_state TEXT NOT NULL, payment_state TEXT NOT NULL, fulfillment_state TEXT NOT NULL,
  refund_state TEXT NOT NULL, actor_id TEXT REFERENCES users(id), source TEXT NOT NULL,
  reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO order_status_events(id,order_id,order_state,payment_state,fulfillment_state,refund_state,source,reason)
  SELECT 'legacy:'||id,id,order_state,payment_state,fulfillment_state,refund_state,'migration','Imported state; original transition time unavailable' FROM orders;
CREATE INDEX order_events_order_idx ON order_status_events(order_id,created_at,id);
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_order_events ON order_status_events FOR SELECT USING(
  EXISTS(SELECT 1 FROM orders WHERE id=order_id AND user_id=sky_uid())
);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    GRANT SELECT ON order_status_events TO authenticated;
  END IF;
END $$;

CREATE FUNCTION sky_protect_order() RETURNS trigger LANGUAGE plpgsql AS $$
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
    OR (OLD.payment_id IS NOT NULL AND NEW.payment_id IS DISTINCT FROM OLD.payment_id) THEN
    RAISE EXCEPTION 'Payment references are immutable';
  END IF;
  IF (NEW.order_state,NEW.payment_state,NEW.fulfillment_state,NEW.refund_state,NEW.delivered_at)
    IS DISTINCT FROM (OLD.order_state,OLD.payment_state,OLD.fulfillment_state,OLD.refund_state,OLD.delivered_at) THEN
    RAISE EXCEPTION 'Lifecycle fields must follow a verified order transition';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status='pending_payment' AND NEW.status IN ('paid','expired','cancelled'))
      OR (OLD.status='paid' AND NEW.status='processing')
      OR (OLD.status='processing' AND NEW.status='shipped')
      OR (OLD.status='shipped' AND NEW.status='delivered')) THEN
      RAISE EXCEPTION 'Invalid order state transition';
    END IF;
    IF NEW.status='paid' THEN
      IF NOT EXISTS(SELECT 1 FROM payments WHERE id=NEW.payment_id AND order_id=NEW.id AND amount=NEW.total AND provider='razorpay' AND status='captured') THEN
        RAISE EXCEPTION 'Captured payment evidence is required';
      END IF;
      NEW.order_state='confirmed'; NEW.payment_state='captured';
    ELSIF NEW.status='expired' THEN
      NEW.order_state='expired'; NEW.payment_state='expired'; NEW.fulfillment_state='cancelled';
    ELSIF NEW.status='cancelled' THEN
      NEW.order_state='cancelled'; NEW.fulfillment_state='cancelled';
    ELSE
      IF NEW.payment_state<>'captured' THEN RAISE EXCEPTION 'Payment must be captured before fulfillment'; END IF;
      NEW.fulfillment_state=NEW.status;
      IF NEW.status='delivered' THEN NEW.order_state='completed'; NEW.delivered_at=now(); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_order BEFORE INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION sky_protect_order();

CREATE FUNCTION sky_record_order_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_events(id,order_id,order_state,payment_state,fulfillment_state,refund_state,actor_id,source,reason)
    VALUES(md5(random()::text||clock_timestamp()::text),NEW.id,NEW.order_state,NEW.payment_state,NEW.fulfillment_state,NEW.refund_state,
      NULLIF(current_setting('sky.actor_id',true),''),COALESCE(NULLIF(current_setting('sky.event_source',true),''),'system'),NULLIF(current_setting('sky.event_reason',true),''));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_order_event AFTER INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION sky_record_order_event();

CREATE FUNCTION sky_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are append-only'; END $$;
CREATE TRIGGER immutable_order_items BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_order_events BEFORE UPDATE OR DELETE ON order_status_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_payments BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_payment_events BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_inventory_movements BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
