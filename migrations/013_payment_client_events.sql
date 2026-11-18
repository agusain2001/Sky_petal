-- Browser reports are useful for recovery but are NEVER payment evidence.
CREATE TABLE payment_client_events (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('dismissed','failed','verification_pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_client_events_order_idx ON payment_client_events(order_id,created_at);
ALTER TABLE payment_client_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_payment_client_events BEFORE UPDATE OR DELETE ON payment_client_events
  FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
