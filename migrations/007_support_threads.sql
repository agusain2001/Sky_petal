ALTER TABLE support_tickets ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE support_tickets ADD COLUMN topic TEXT NOT NULL DEFAULT 'other' CHECK(topic IN ('order','fit','return','defect','privacy','grievance','other'));
ALTER TABLE support_tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'standard' CHECK(priority IN ('standard','high'));
ALTER TABLE support_tickets ADD COLUMN assigned_to TEXT REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN idempotency_key TEXT;
ALTER TABLE support_tickets ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE support_tickets ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX support_request_key_idx ON support_tickets(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX support_customer_idx ON support_tickets(user_id,updated_at);
CREATE INDEX support_queue_idx ON support_tickets(status,priority,updated_at);
CREATE TABLE ticket_messages(
  id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES support_tickets(id), actor_id TEXT REFERENCES users(id),
  body TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('public','internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ticket_messages(id,ticket_id,actor_id,body,visibility,created_at)
  SELECT 'initial:'||id,id,user_id,body,'public',created_at FROM support_tickets;
CREATE INDEX ticket_messages_thread_idx ON ticket_messages(ticket_id,created_at,id);
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_support_tickets ON support_tickets FOR SELECT USING(user_id=sky_uid());
CREATE POLICY own_support_messages ON ticket_messages FOR SELECT USING(visibility='public' AND EXISTS(SELECT 1 FROM support_tickets WHERE id=ticket_id AND user_id=sky_uid()));
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON support_tickets,ticket_messages TO authenticated; END IF; END $$;
CREATE TRIGGER immutable_ticket_messages BEFORE UPDATE OR DELETE ON ticket_messages FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE FUNCTION sky_protect_support_ticket() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Support history is retained'; END IF;
  IF (NEW.id,NEW.user_id,NEW.subject,NEW.body,NEW.order_id,NEW.topic,NEW.idempotency_key,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.subject,OLD.body,OLD.order_id,OLD.topic,OLD.idempotency_key,OLD.created_at) THEN RAISE EXCEPTION 'Support request history is immutable'; END IF;
  IF NEW.status NOT IN ('open','waiting_customer','waiting_team','resolved') THEN RAISE EXCEPTION 'Invalid support status'; END IF;
  NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER protect_support_ticket BEFORE UPDATE OR DELETE ON support_tickets FOR EACH ROW EXECUTE FUNCTION sky_protect_support_ticket();
