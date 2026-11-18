CREATE TABLE shipment_bookings(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),request_snapshot JSONB NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),
 stage TEXT NOT NULL DEFAULT 'queued',sr_order_id BIGINT UNIQUE,sr_shipment_id BIGINT UNIQUE,courier_id INTEGER NOT NULL,
 awb TEXT UNIQUE,carrier TEXT,label_url TEXT,manifest_url TEXT,pickup_reference TEXT,
 delivery_state TEXT NOT NULL DEFAULT 'awaiting_dispatch',last_event_at TIMESTAMPTZ,last_error TEXT,lease_token TEXT,lease_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE shipment_tracking_events(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES shipment_bookings(id),order_id TEXT NOT NULL REFERENCES orders(id),status_code INTEGER NOT NULL,label TEXT NOT NULL,occurred_at TIMESTAMPTZ NOT NULL,scans JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX shipment_tracking_order_idx ON shipment_tracking_events(order_id,occurred_at,id);
ALTER TABLE shipment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_shipment_events ON shipment_tracking_events FOR SELECT USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id AND user_id=sky_uid()));
CREATE TRIGGER immutable_shipment_tracking BEFORE UPDATE OR DELETE ON shipment_tracking_events FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE FUNCTION sky_protect_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipment booking history is retained'; END IF;
 IF (NEW.id,NEW.order_id,NEW.request_snapshot,NEW.actor_id,NEW.courier_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.order_id,OLD.request_snapshot,OLD.actor_id,OLD.courier_id,OLD.created_at) THEN RAISE EXCEPTION 'Shipment booking snapshot is immutable'; END IF;
 IF (OLD.sr_order_id IS NOT NULL AND NEW.sr_order_id IS DISTINCT FROM OLD.sr_order_id) OR (OLD.sr_shipment_id IS NOT NULL AND NEW.sr_shipment_id IS DISTINCT FROM OLD.sr_shipment_id) OR (OLD.awb IS NOT NULL AND NEW.awb IS DISTINCT FROM OLD.awb) THEN RAISE EXCEPTION 'Provider shipment identity is immutable'; END IF;
 NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER protect_booking BEFORE UPDATE OR DELETE ON shipment_bookings FOR EACH ROW EXECUTE FUNCTION sky_protect_booking();

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
      IF NEW.status='delivered' THEN NEW.order_state='completed'; NEW.delivered_at=CASE WHEN current_setting('sky.event_source',true)='courier' THEN COALESCE(NULLIF(current_setting('sky.delivered_at',true),'')::timestamptz,now()) ELSE now() END; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
