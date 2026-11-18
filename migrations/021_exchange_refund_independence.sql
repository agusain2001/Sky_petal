-- Original refunds and replacement checkout are separate financial operations.
-- A completed original refund must not prevent linking the replacement later.
CREATE OR REPLACE FUNCTION sky_guard_exchange() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request returns; replacement orders;
BEGIN
 SELECT * INTO request FROM returns WHERE id=NEW.return_id FOR UPDATE;
 SELECT * INTO replacement FROM orders WHERE id=NEW.replacement_order_id FOR UPDATE;
 IF request.id IS NULL OR replacement.id IS NULL OR request.user_id<>NEW.user_id OR replacement.user_id<>NEW.user_id OR request.resolution<>'exchange' OR request.status NOT IN ('inspected','completed') OR request.order_id=replacement.id OR replacement.created_at<request.created_at OR replacement.status IN ('cancelled','expired','refunded') OR NEW.replacement_total<>replacement.total OR NEW.original_value<>(SELECT COALESCE(sum(refund_cap),0) FROM return_items WHERE return_id=request.id) THEN RAISE EXCEPTION 'Exchange must match its inspected return and owned replacement order'; END IF;
 RETURN NEW;
END $$;
