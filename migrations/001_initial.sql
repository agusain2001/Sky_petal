
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT,role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','owner','administrator','catalog_editor','fulfillment','support')),created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,title TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,slug TEXT UNIQUE NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL REFERENCES categories(id),material TEXT NOT NULL,care TEXT NOT NULL,image TEXT NOT NULL,images JSONB NOT NULL DEFAULT '[]',featured BOOLEAN DEFAULT false,is_new BOOLEAN DEFAULT true,published BOOLEAN DEFAULT true,sales INTEGER DEFAULT 0,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS product_variants(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,sku TEXT NOT NULL UNIQUE,color TEXT NOT NULL,color_hex TEXT NOT NULL,size TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),compare_price INTEGER,stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),reserved INTEGER DEFAULT 0 CHECK(reserved>=0),UNIQUE(product_id,color,size));
CREATE TABLE IF NOT EXISTS product_collections(product_id TEXT REFERENCES products(id) ON DELETE CASCADE,collection_id TEXT REFERENCES collections(id),PRIMARY KEY(product_id,collection_id));
CREATE TABLE IF NOT EXISTS product_media(id TEXT PRIMARY KEY,product_id TEXT REFERENCES products(id) ON DELETE CASCADE,url TEXT NOT NULL,alt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS size_charts(id TEXT PRIMARY KEY,category_id TEXT REFERENCES categories(id),content JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS addresses(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,content JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS carts(id TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS cart_items(cart_id TEXT REFERENCES carts(id) ON DELETE CASCADE,variant_id TEXT REFERENCES product_variants(id),quantity INTEGER NOT NULL CHECK(quantity>0 AND quantity<=20),PRIMARY KEY(cart_id,variant_id));
CREATE TABLE IF NOT EXISTS wishlists(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,product_id TEXT REFERENCES products(id) ON DELETE CASCADE,PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY,percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 50),active BOOLEAN DEFAULT true);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded')),subtotal INTEGER NOT NULL,shipping INTEGER NOT NULL,discount INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL CHECK(total>0),address JSONB NOT NULL,provider_id TEXT UNIQUE,payment_id TEXT UNIQUE,idempotency_key TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),expires_at TIMESTAMPTZ DEFAULT now()+interval '15 minutes',UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS order_items(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),variant_id TEXT NOT NULL REFERENCES product_variants(id),title TEXT NOT NULL,color TEXT NOT NULL,size TEXT NOT NULL,quantity INTEGER NOT NULL,price INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),provider TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,content JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS shipments(id TEXT PRIMARY KEY,order_id TEXT UNIQUE REFERENCES orders(id),carrier TEXT,tracking TEXT,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,variant_id TEXT REFERENCES product_variants(id),change INTEGER NOT NULL,reason TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),product_id TEXT REFERENCES products(id),order_id TEXT REFERENCES orders(id),rating INTEGER CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(user_id,product_id));
CREATE TABLE IF NOT EXISTS returns(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),order_id TEXT REFERENCES orders(id),reason TEXT NOT NULL,status TEXT DEFAULT 'requested',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY,order_id TEXT REFERENCES orders(id),provider_id TEXT UNIQUE,amount INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT DEFAULT 'open');
CREATE TABLE IF NOT EXISTS cms_content(key TEXT PRIMARY KEY,content JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY,value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS newsletter(email TEXT PRIMARY KEY,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS privacy_requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT CHECK(kind IN ('export','delete')),created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id),action TEXT NOT NULL,target_id TEXT,details JSONB,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS product_category_idx ON products(category,published);
CREATE INDEX IF NOT EXISTS variant_product_idx ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS orders_expiry_idx ON orders(status,expires_at);


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
