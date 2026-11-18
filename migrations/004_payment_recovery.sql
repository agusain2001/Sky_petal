ALTER TABLE orders ADD COLUMN request_fingerprint TEXT;
CREATE FUNCTION sky_immutable_checkout_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint THEN
    RAISE EXCEPTION 'Checkout request fingerprint is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_checkout_request BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION sky_immutable_checkout_request();

-- Only sanitized, signature/provider-verified capture details enter this inbox.
CREATE TABLE payment_webhook_inbox(
  id TEXT PRIMARY KEY, provider_order_id TEXT NOT NULL, payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('webhook','callback')),
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','processing','processed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
  lease_until TIMESTAMPTZ, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ
);
CREATE INDEX payment_inbox_retry_idx ON payment_webhook_inbox(status,next_attempt_at,lease_until);
ALTER TABLE payment_webhook_inbox ENABLE ROW LEVEL SECURITY;
-- No browser grants/policies. Owner/administrator reads/retries go through server authorization.
CREATE FUNCTION sky_protect_payment_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment inbox records are retained'; END IF;
  IF (NEW.id,NEW.provider_order_id,NEW.payment_id,NEW.amount,NEW.currency,NEW.source,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.provider_order_id,OLD.payment_id,OLD.amount,OLD.currency,OLD.source,OLD.created_at) THEN
    RAISE EXCEPTION 'Payment inbox evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_payment_inbox BEFORE UPDATE OR DELETE ON payment_webhook_inbox FOR EACH ROW EXECUTE FUNCTION sky_protect_payment_inbox();
