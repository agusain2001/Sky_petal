-- Additive: keep all legacy address content and historical order snapshots.
ALTER TABLE addresses ADD COLUMN label TEXT NOT NULL DEFAULT 'Home';
ALTER TABLE addresses ADD COLUMN kind TEXT NOT NULL DEFAULT 'both'
  CHECK(kind IN ('shipping','billing','both'));
ALTER TABLE addresses ADD COLUMN default_shipping BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE addresses ADD COLUMN default_billing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE addresses ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE addresses ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
WITH first_address AS (
  SELECT id, row_number() OVER(PARTITION BY user_id ORDER BY id) AS position
  FROM addresses WHERE user_id IS NOT NULL
)
UPDATE addresses SET default_shipping=true,default_billing=true
WHERE id IN (SELECT id FROM first_address WHERE position=1);
ALTER TABLE addresses ADD CONSTRAINT address_default_kind CHECK(
  (NOT default_shipping OR kind IN ('shipping','both')) AND
  (NOT default_billing OR kind IN ('billing','both'))
);
CREATE UNIQUE INDEX address_default_shipping_idx ON addresses(user_id) WHERE default_shipping;
CREATE UNIQUE INDEX address_default_billing_idx ON addresses(user_id) WHERE default_billing;
CREATE INDEX addresses_user_idx ON addresses(user_id,created_at,id);
