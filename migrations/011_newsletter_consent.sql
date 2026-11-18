-- Historical addresses have no consent evidence; suppress them by default.
ALTER TABLE newsletter ADD COLUMN status TEXT NOT NULL DEFAULT 'unsubscribed' CHECK(status IN ('subscribed','unsubscribed'));
ALTER TABLE newsletter ADD COLUMN consent_version TEXT;
ALTER TABLE newsletter ADD COLUMN consent_source TEXT;
ALTER TABLE newsletter ADD COLUMN consent_at TIMESTAMPTZ;
ALTER TABLE newsletter ADD COLUMN unsubscribe_hash TEXT UNIQUE;
ALTER TABLE newsletter ADD CONSTRAINT newsletter_active_consent CHECK(status<>'subscribed' OR
  (consent_version IS NOT NULL AND consent_source IS NOT NULL AND consent_at IS NOT NULL AND unsubscribe_hash IS NOT NULL));
CREATE TABLE newsletter_consent_events(
  id TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES newsletter(email),
  decision BOOLEAN NOT NULL, version TEXT NOT NULL, source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE newsletter_consent_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_newsletter_consent BEFORE UPDATE OR DELETE ON newsletter_consent_events
FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
-- Provider dispatchers must use this consent-filtered inventory, never the
-- legacy address table. No outbound marketing dispatcher is enabled here.
CREATE VIEW marketing_eligible_subscribers WITH (security_invoker=true) AS
SELECT email,consent_version,consent_source,consent_at FROM newsletter
WHERE status='subscribed' AND consent_version IS NOT NULL AND consent_at IS NOT NULL;
REVOKE ALL ON newsletter_consent_events,marketing_eligible_subscribers FROM PUBLIC;
