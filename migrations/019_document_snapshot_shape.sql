CREATE FUNCTION sky_require_document_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
 OR NOT(NEW.snapshot ?& ARRAY['issuer','buyer','order_reference','total','tax','lines'])
 OR NEW.snapshot->>'order_reference' IS DISTINCT FROM NEW.order_id
 OR (NEW.snapshot->>'total')::integer IS DISTINCT FROM NEW.total
 OR jsonb_typeof(NEW.snapshot->'issuer') IS DISTINCT FROM 'object'
 OR jsonb_typeof(NEW.snapshot->'buyer') IS DISTINCT FROM 'object'
 OR jsonb_typeof(NEW.snapshot->'tax') IS DISTINCT FROM 'object'
 OR jsonb_typeof(NEW.snapshot->'lines') IS DISTINCT FROM 'array'
 OR COALESCE(length(NEW.snapshot#>>'{issuer,approval_reference}'),0)<2
 THEN RAISE EXCEPTION 'Complete immutable document snapshot is required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER require_document_snapshot BEFORE INSERT ON invoice_documents FOR EACH ROW EXECUTE FUNCTION sky_require_document_snapshot();
