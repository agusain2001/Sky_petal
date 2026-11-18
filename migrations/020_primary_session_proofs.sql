CREATE TABLE session_primary_proofs(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,provider TEXT NOT NULL CHECK(provider IN ('local','supabase')),verified_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE session_primary_proofs ENABLE ROW LEVEL SECURITY;
