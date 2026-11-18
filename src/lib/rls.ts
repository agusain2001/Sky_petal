export const rls = `
CREATE OR REPLACE FUNCTION sky_uid() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub',true),''),NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub');
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','sessions','categories','collections','products','product_variants','product_collections','product_media','size_charts','addresses','carts','cart_items','wishlists','coupons','orders','order_items','payments','payment_events','shipments','inventory_movements','reviews','returns','refunds','support_tickets','cms_content','site_settings','newsletter','privacy_requests','audit_logs','rate_limits'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
DROP POLICY IF EXISTS catalog_read ON products;
CREATE POLICY catalog_read ON products FOR SELECT USING(published=true);
DROP POLICY IF EXISTS variant_read ON product_variants;
CREATE POLICY variant_read ON product_variants FOR SELECT USING(EXISTS(SELECT 1 FROM products WHERE id=product_id AND published=true));
DROP POLICY IF EXISTS category_read ON categories;
CREATE POLICY category_read ON categories FOR SELECT USING(true);
DROP POLICY IF EXISTS collection_read ON collections;
CREATE POLICY collection_read ON collections FOR SELECT USING(true);
DROP POLICY IF EXISTS own_profile ON users;
CREATE POLICY own_profile ON users FOR SELECT USING(id=sky_uid());
DROP POLICY IF EXISTS own_addresses ON addresses;
CREATE POLICY own_addresses ON addresses FOR SELECT USING(user_id=sky_uid());
DROP POLICY IF EXISTS own_orders ON orders;
CREATE POLICY own_orders ON orders FOR SELECT USING(user_id=sky_uid());
DROP POLICY IF EXISTS own_order_items ON order_items;
CREATE POLICY own_order_items ON order_items FOR SELECT USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id AND user_id=sky_uid()));
DROP POLICY IF EXISTS own_wishlist ON wishlists;
CREATE POLICY own_wishlist ON wishlists FOR SELECT USING(user_id=sky_uid());
DROP POLICY IF EXISTS public_reviews ON reviews;
CREATE POLICY public_reviews ON reviews FOR SELECT USING(true);
DROP POLICY IF EXISTS own_shipments ON shipments;
CREATE POLICY own_shipments ON shipments FOR SELECT USING(EXISTS(SELECT 1 FROM orders WHERE id=order_id AND user_id=sky_uid()));
DROP POLICY IF EXISTS own_returns ON returns;
CREATE POLICY own_returns ON returns FOR SELECT USING(user_id=sky_uid());
-- Browser roles receive no mutation privileges. All writes use authenticated,
-- authorized server endpoints, and the server database credential stays secret.
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('GRANT USAGE ON SCHEMA public TO %I',role_name);
   EXECUTE format('GRANT SELECT ON products,product_variants,categories,collections,reviews TO %I',role_name);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  GRANT SELECT(id,email,name,role,created_at) ON users TO authenticated;
  GRANT SELECT ON addresses,orders,order_items,wishlists,shipments,returns TO authenticated;
 END IF;
END $$;
`;
