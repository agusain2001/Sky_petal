-- Additive: retain every existing refund and its original evidence, including
-- legacy rows. Corrections never alter the payout, amount or payment state.
CREATE FUNCTION sky_lock_completed_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='processed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Completed refund is immutable; append an independently approved evidence correction';
  END IF;
  IF OLD.evidence_ref IS NOT NULL AND NEW.evidence_ref IS DISTINCT FROM OLD.evidence_ref THEN
    RAISE EXCEPTION 'Refund evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lock_completed_refund BEFORE UPDATE ON refunds
FOR EACH ROW EXECUTE FUNCTION sky_lock_completed_refund();

CREATE TABLE refund_evidence_corrections(
  id TEXT PRIMARY KEY, refund_id TEXT NOT NULL REFERENCES refunds(id),
  request_key TEXT NOT NULL UNIQUE, original_ref TEXT NOT NULL,
  previous_ref TEXT NOT NULL, corrected_ref TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
  independent_proof TEXT NOT NULL CHECK(length(trim(independent_proof)) BETWEEN 10 AND 2000),
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(corrected_ref<>previous_ref), CHECK(length(trim(corrected_ref)) BETWEEN 6 AND 150)
);
CREATE TABLE refund_evidence_approvals(
  sequence BIGSERIAL PRIMARY KEY,
  correction_id TEXT NOT NULL UNIQUE REFERENCES refund_evidence_corrections(id),
  approved_by TEXT NOT NULL REFERENCES users(id),
  reconciliation_ref TEXT NOT NULL CHECK(length(trim(reconciliation_ref)) BETWEEN 6 AND 150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refund_evidence_corrections_refund_idx ON refund_evidence_corrections(refund_id);
ALTER TABLE refund_evidence_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_evidence_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON refund_evidence_corrections,refund_evidence_approvals FROM PUBLIC;
CREATE TRIGGER immutable_refund_corrections BEFORE UPDATE OR DELETE ON refund_evidence_corrections
FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();
CREATE TRIGGER immutable_refund_approvals BEFORE UPDATE OR DELETE ON refund_evidence_approvals
FOR EACH ROW EXECUTE FUNCTION sky_immutable_record();

CREATE FUNCTION sky_check_refund_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payout refunds%ROWTYPE;
BEGIN
  SELECT * INTO STRICT payout FROM refunds WHERE id=NEW.refund_id FOR UPDATE;
  IF payout.status<>'processed' OR payout.method<>'manual_cod' OR payout.evidence_ref IS NULL
    OR NEW.original_ref IS DISTINCT FROM payout.evidence_ref THEN
    RAISE EXCEPTION 'Completed COD payout with original evidence is required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.requested_by AND role IN ('owner','administrator','finance')) THEN
    RAISE EXCEPTION 'Finance permission is required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_refund_correction BEFORE INSERT ON refund_evidence_corrections
FOR EACH ROW EXECUTE FUNCTION sky_check_refund_correction();
CREATE FUNCTION sky_check_refund_correction_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE correction refund_evidence_corrections%ROWTYPE; current_ref TEXT;
BEGIN
  SELECT * INTO STRICT correction FROM refund_evidence_corrections WHERE id=NEW.correction_id;
  -- Serialize approvals on the same payout, including approvals via direct SQL.
  SELECT evidence_ref INTO STRICT current_ref FROM refunds WHERE id=correction.refund_id FOR UPDATE;
  IF NEW.approved_by=correction.requested_by OR NOT EXISTS(
    SELECT 1 FROM users WHERE id=NEW.approved_by AND role IN ('owner','administrator','finance')
  ) THEN RAISE EXCEPTION 'A second finance account must approve the correction'; END IF;
  SELECT COALESCE((SELECT c.corrected_ref FROM refund_evidence_corrections c
    JOIN refund_evidence_approvals a ON a.correction_id=c.id
    WHERE c.refund_id=correction.refund_id ORDER BY a.sequence DESC LIMIT 1),current_ref) INTO current_ref;
  IF correction.previous_ref IS DISTINCT FROM current_ref THEN
    RAISE EXCEPTION 'Correction is stale; request against the current reconciliation reference';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_refund_correction_approval BEFORE INSERT ON refund_evidence_approvals
FOR EACH ROW EXECUTE FUNCTION sky_check_refund_correction_approval();
