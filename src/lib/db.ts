import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Product, Variant } from "./types";
import { Pool } from "pg";
import { rls } from "./rls";
import { applyMigrations } from "./migrations";

const schema = `
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
`;
const seedProducts = [
  [
    "the-petal-bralette",
    "The Petal Bralette",
    "bras",
    "French-inspired floral lace",
    "/images/bralette.webp",
    189000,
    true,
    true,
  ],
  [
    "silk-slow-mornings",
    "Slow Mornings Silk Set",
    "sleepwear",
    "Silk satin",
    "/images/sleepwear.webp",
    449000,
    true,
    true,
  ],
  [
    "midnight-bloom",
    "Midnight Bloom Set",
    "lingerie",
    "Floral stretch lace",
    "/images/set.webp",
    329000,
    true,
    false,
  ],
  [
    "the-everyday-soft",
    "The Everyday Soft Bra",
    "bras",
    "Organic cotton blend",
    "/images/cotton-bra.webp",
    159000,
    true,
    false,
  ],
  [
    "rose-ritual",
    "The Rose Ritual",
    "wellness",
    "Botanical body oil",
    "/images/wellness.webp",
    129000,
    true,
    true,
  ],
  [
    "second-skin-brief",
    "Second Skin High-Rise Brief",
    "panties",
    "Modal cotton blend",
    "/images/brief.webp",
    79000,
    false,
    true,
  ],
  [
    "sunday-lounge",
    "The Sunday Lounge Set",
    "loungewear",
    "Soft modal satin",
    "/images/lounge.webp",
    349000,
    false,
    true,
  ],
  [
    "satin-whisper",
    "Satin Whisper Camisole",
    "sleepwear",
    "Silk satin",
    "/images/camisole.webp",
    229000,
    false,
    false,
  ],
  [
    "sculpt-softly",
    "Sculpt Softly Bodysuit",
    "bodysuits",
    "Seamless stretch modal",
    "/images/bodysuit.webp",
    279000,
    false,
    true,
  ],
  [
    "soft-support",
    "Soft Support Sculpt Brief",
    "shapewear",
    "Seamless stretch cotton",
    "/images/shapewear.webp",
    149000,
    false,
    false,
  ],
  [
    "silk-eye-pillow",
    "Silk Rest Eye Pillow",
    "accessories",
    "Silk satin",
    "/images/eye-pillow.webp",
    99000,
    false,
    true,
  ],
] as const;
async function initialize() {
  let db: PGlite;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      ssl:
        process.env.DATABASE_SSL === "require"
          ? { rejectUnauthorized: true }
          : undefined,
    });
    const wrap = (client: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    }) => ({
      query: client.query.bind(client),
      exec: (sql: string) => client.query(sql),
    });
    const adapter = {
      ...wrap(pool),
      transaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(wrap(client));
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    } as unknown as PGlite;
    db = adapter;
  } else {
    const dir =
      process.env.DATABASE_DIR || path.join(process.cwd(), "data", "sky-petal");
    await mkdir(dir, { recursive: true });
    db = new PGlite(dir);
    await db.waitReady;
  }
  if (
    process.env.DATABASE_URL &&
    process.env.NODE_ENV === "production" &&
    process.env.DATABASE_AUTO_MIGRATE !== "true"
  )
    return db;
  await db.exec(schema);
  const count = await db.query<{ count: string }>(
    "SELECT count(*) FROM products",
  );
  if (Number(count.rows[0].count) === 0)
    await db.transaction(async (tx) => {
      for (const [id, title] of [
        ["bras", "Bras & bralettes"],
        ["lingerie", "Lingerie sets"],
        ["sleepwear", "Sleepwear"],
        ["panties", "Panties"],
        ["loungewear", "Loungewear"],
        ["bodysuits", "Bodysuits"],
        ["shapewear", "Shapewear"],
        ["accessories", "Accessories"],
        ["wellness", "Self-care & wellness"],
      ])
        await tx.query(
          "INSERT INTO categories VALUES($1,$2) ON CONFLICT DO NOTHING",
          [id, title],
        );
      for (const [
        slug,
        title,
        category,
        material,
        image,
        price,
        featured,
        isNew,
      ] of seedProducts) {
        const id = randomUUID();
        await tx.query(
          "INSERT INTO products(id,slug,title,description,category,material,care,image,images,featured,is_new) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            id,
            slug,
            title,
            "A little softness, just for you. Thoughtfully designed with delicate details and an easy, comfortable fit. Made to feel as beautiful as it looks.",
            category,
            material,
            "Hand wash gently in cool water. Dry flat in shade. Do not bleach or tumble dry.",
            image,
            JSON.stringify([image, "/images/hero.webp"]),
            featured,
            isNew,
          ],
        );
        const colors =
          category === "wellness"
            ? [["Rose", "rosy"]]
            : [
                ["Petal Rose", "#c99897"],
                ["Champagne", "#ded0b6"],
                ["Midnight Plum", "#492f40"],
              ];
        for (const [color, hex] of colors)
          for (const [i, size] of (category === "wellness"
            ? ["100 ml"]
            : ["XS", "S", "M", "L", "XL", "XXL"]
          ).entries())
            await tx.query(
              "INSERT INTO product_variants(id,product_id,sku,color,color_hex,size,price,compare_price,stock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
              [
                randomUUID(),
                id,
                `${slug}-${color.split(" ")[0]}-${size}`
                  .toUpperCase()
                  .replaceAll(" ", "-"),
                color,
                hex === "rosy" ? "#b58b83" : hex,
                size,
                price,
                slug === "the-petal-bralette" ? 229000 : null,
                i === 5 && color === "Midnight Plum" ? 0 : 12,
              ],
            );
      }
      await tx.query(
        "INSERT INTO coupons VALUES('SOFT10',10,true) ON CONFLICT DO NOTHING",
      );
      await tx.query(
        "INSERT INTO cms_content VALUES($1,$2) ON CONFLICT DO NOTHING",
        [
          "home",
          JSON.stringify({
            eyebrow: "A LITTLE LUXURY. EVERY DAY.",
            headline: "Softness is\nyour superpower.",
            description:
              "Intimates, loungewear & little rituals. Thoughtfully made for every version of you.",
            announcement:
              "A little something for you — 10% off your first order with SOFT10",
            story: "For the moments\nthat are just yours.",
            storyBody:
              "The slow mornings. The quiet confidence. The feeling of being completely yourself. We believe the things closest to your skin should bring you a little closer to you.",
          }),
        ],
      );
    });
  await db.exec(rls);
  return db;
}
const globalDB = globalThis as unknown as { skyPetalDB?: Promise<PGlite> };
// Module-local readiness re-runs after a development hot reload while retaining
// the one global PGlite connection. An existing server must not retain an old schema.
let moduleReady: Promise<PGlite> | undefined;
export function getDB() {
  return (moduleReady ??= (async () => {
    const db = await (globalDB.skyPetalDB ??= initialize());
    if (!(
      process.env.DATABASE_URL &&
      process.env.NODE_ENV === "production" &&
      process.env.DATABASE_AUTO_MIGRATE !== "true"
    ))
      await applyMigrations(db);
    return db;
  })());
}
export async function getProducts(includeArchived = false) {
  const db = await getDB();
  const p = await db.query<Omit<Product, "variants">>(
    `SELECT * FROM products ${includeArchived ? "" : "WHERE published=true"} ORDER BY created_at,id`,
  );
  const v = await db.query<Variant>(
    "SELECT * FROM product_variants ORDER BY color,size",
  );
  return p.rows.map((product) => ({
    ...product,
    variants: v.rows.filter((x) => x.product_id === product.id),
  }));
}
export { schema };
