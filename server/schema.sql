CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK(amount BETWEEN 10000 AND 10000000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','credited','review','expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  credited_at INTEGER
);
CREATE INDEX IF NOT EXISTS deposits_user ON deposits(user_id, created_at);
CREATE TABLE IF NOT EXISTS bank_events (
  transaction_id TEXT PRIMARY KEY,
  reference TEXT UNIQUE,
  deposit_id TEXT REFERENCES deposits(id),
  amount INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  deposit_id TEXT NOT NULL UNIQUE REFERENCES deposits(id),
  transaction_id TEXT NOT NULL UNIQUE REFERENCES bank_events(transaction_id),
  amount INTEGER NOT NULL CHECK(amount > 0),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_note TEXT,
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL CHECK(total >= 0),
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  has_log_items INTEGER NOT NULL DEFAULT 0,
  discord_account TEXT,
  discord_password TEXT,
  backup_codes TEXT,
  server_invite TEXT,
  decor_image TEXT,
  claim_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','cancelled')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS site_announcements (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS product_prices (
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price BETWEEN 0 AND 1000000000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(product_id, variant_id)
);
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('campaign','coupon')),
  code TEXT UNIQUE,
  rules_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_pricing (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  coupon_id TEXT REFERENCES promotions(id),
  snapshot_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_pricing_coupon ON order_pricing(coupon_id);

CREATE TABLE IF NOT EXISTS custom_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  badge TEXT,
  description TEXT,
  image TEXT,
  features_json TEXT,
  detail TEXT,
  service INTEGER NOT NULL DEFAULT 0,
  partner_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_variants (
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price BETWEEN 0 AND 1000000000),
  delivery_type TEXT NOT NULL DEFAULT 'gift',
  note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(product_id, id)
);

CREATE TABLE IF NOT EXISTS catalog_item_status (
  item_key TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_settings (
  id TEXT PRIMARY KEY,
  bank_code TEXT NOT NULL DEFAULT '',
  bank_gateway TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  webhook_secret TEXT NOT NULL DEFAULT '',
  auto_credit INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_guides (
  id TEXT PRIMARY KEY,
  partner_email TEXT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'guide',
  cover_image TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  image_urls_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_item_overrides (
  item_key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS partners_email ON partners(email);

CREATE TABLE IF NOT EXISTS admin_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'partner',
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_tokens_expiry ON admin_tokens(expires_at);
CREATE TABLE IF NOT EXISTS product_inventory (
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 99,
  sold_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(product_id, variant_id)
);

