CREATE TABLE tax_classes(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, hsn TEXT NOT NULL,
  rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
  valid_from TIMESTAMPTZ NOT NULL, valid_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  CHECK(valid_until IS NULL OR valid_until>valid_from)
);
ALTER TABLE products ADD COLUMN tax_class_id TEXT REFERENCES tax_classes(id);
ALTER TABLE product_variants ADD COLUMN weight_grams INTEGER CHECK(weight_grams>0 AND weight_grams<=100000);
CREATE TABLE checkout_quotes(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), cart_id TEXT NOT NULL REFERENCES carts(id),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('prepaid','cod')),
  request_fingerprint TEXT NOT NULL, config_fingerprint TEXT NOT NULL,
  content JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX checkout_quotes_owner_idx ON checkout_quotes(user_id,created_at);
ALTER TABLE orders ADD COLUMN quote_id TEXT UNIQUE REFERENCES checkout_quotes(id);
ALTER TABLE orders ADD COLUMN tax_snapshot JSONB;
ALTER TABLE orders ADD COLUMN shipping_snapshot JSONB;
ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'prepaid' CHECK(payment_method IN ('prepaid','cod'));
ALTER TABLE orders ADD COLUMN cod_fee INTEGER NOT NULL DEFAULT 0 CHECK(cod_fee>=0);
ALTER TABLE order_items ADD COLUMN pricing_snapshot JSONB;
ALTER TABLE checkout_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_checkout_quotes BEFORE UPDATE OR DELETE ON checkout_quotes FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE FUNCTION sky_protect_order_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.quote_id,NEW.tax_snapshot,NEW.shipping_snapshot,NEW.payment_method,NEW.cod_fee)
    IS DISTINCT FROM (OLD.quote_id,OLD.tax_snapshot,OLD.shipping_snapshot,OLD.payment_method,OLD.cod_fee) THEN
    RAISE EXCEPTION 'Order quote and accounting snapshots are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_order_quote BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION sky_protect_order_quote();
