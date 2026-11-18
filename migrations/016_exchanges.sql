CREATE TABLE exchange_cases(
 id TEXT PRIMARY KEY,return_id TEXT NOT NULL UNIQUE REFERENCES returns(id),
 replacement_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),user_id TEXT NOT NULL REFERENCES users(id),
 original_value INTEGER NOT NULL CHECK(original_value>=0),replacement_total INTEGER NOT NULL CHECK(replacement_total>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE exchange_cases ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable_exchange_case BEFORE UPDATE OR DELETE ON exchange_cases FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
