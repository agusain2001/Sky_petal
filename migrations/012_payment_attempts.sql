-- Durable intent commits BEFORE a provider request. A lost response is never
-- permission to create another provider order for the same checkout.
CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  receipt TEXT NOT NULL UNIQUE, amount INTEGER NOT NULL CHECK(amount>0),
  currency TEXT NOT NULL CHECK(currency='INR'), provider_order_id TEXT UNIQUE,
  state TEXT NOT NULL CHECK(state IN ('creating','ready','unknown','authorized','failed','captured','expired','manual_review')),
  checks INTEGER NOT NULL DEFAULT 0 CHECK(checks>=0),
  lease_token TEXT, lease_until TIMESTAMPTZ,
  last_error TEXT, next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempt_due_idx ON payment_attempts(next_check_at,state);
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION sky_protect_payment_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment attempts are retained'; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND payment_method='prepaid' AND total=NEW.amount)
      OR NEW.receipt<>NEW.order_id THEN RAISE EXCEPTION 'Payment attempt must match its checkout'; END IF;
  ELSE
    IF (NEW.id,NEW.order_id,NEW.receipt,NEW.amount,NEW.currency,NEW.created_at)
      IS DISTINCT FROM (OLD.id,OLD.order_id,OLD.receipt,OLD.amount,OLD.currency,OLD.created_at)
      OR (OLD.provider_order_id IS NOT NULL AND NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id)
      THEN RAISE EXCEPTION 'Payment attempt identity is immutable'; END IF;
    IF OLD.state='captured' AND NEW.state<>'captured' THEN RAISE EXCEPTION 'Captured payment cannot regress'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_payment_attempt BEFORE INSERT OR UPDATE OR DELETE ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION sky_protect_payment_attempt();
CREATE TABLE payment_observations (
  id TEXT PRIMARY KEY, provider_order_id TEXT NOT NULL, payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('created','authorized','failed','captured')),
  source TEXT NOT NULL CHECK(source IN ('webhook','poll','callback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_observations_order_idx ON payment_observations(provider_order_id,created_at);
ALTER TABLE payment_observations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_payment_observations BEFORE UPDATE OR DELETE ON payment_observations
  FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
ALTER TABLE payment_webhook_inbox ADD COLUMN lease_token TEXT;
ALTER TABLE payment_webhook_inbox DROP CONSTRAINT payment_webhook_inbox_source_check;
ALTER TABLE payment_webhook_inbox ADD CONSTRAINT payment_webhook_inbox_source_check CHECK(source IN ('webhook','callback','poll'));
