-- Categories: the client adds her own (Tarot, Astrology and any others) from the admin.
-- A category is referenced by its slug, which is never changed after it is created. Hiding a
-- category sets active = 0. A category can be deleted only when no plan uses it: the foreign key
-- on services.category enforces that in the database itself.
--
-- services.category used to be limited to 'tarot' and 'astrology' by a CHECK, which SQLite can only
-- change by rebuilding the table. D1 keeps foreign keys on, so the child tables go first and the new
-- tables are renamed into place (the same pattern as migration 0004). Existing rows are copied as they are.

-- 1. Categories, with the two the site already had. Astrology asks for birth details at booking.
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 2 AND 40),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 40),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  birth_details INTEGER NOT NULL DEFAULT 0 CHECK (birth_details IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO categories (slug, name, description, birth_details, active, sort_order, created_at, updated_at) VALUES
  ('tarot', 'Tarot', '', 0, 1, 1, 1793548800000, 1793548800000),
  ('astrology', 'Astrology', '', 1, 1, 2, 1793548800000, 1793548800000);

-- 2. Services with a foreign key to categories instead of the fixed CHECK.
CREATE TABLE services_new (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 2 AND 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  category TEXT NOT NULL REFERENCES categories (slug),
  summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 300),
  icon TEXT NOT NULL DEFAULT 'cards',
  card TEXT NOT NULL DEFAULT 'priestess',
  formats TEXT NOT NULL DEFAULT 'call,text',
  duration_min INTEGER CHECK (duration_min IS NULL OR duration_min BETWEEN 10 AND 240),
  price_paise INTEGER CHECK (price_paise IS NULL OR price_paise BETWEEN 100 AND 10000000),
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);
INSERT INTO services_new (id, slug, name, category, summary, icon, card, formats, duration_min, price_paise,
  is_sample, active, sort_order, image_key, created_at, updated_at, archived)
SELECT id, slug, name, category, summary, icon, card, formats, duration_min, price_paise,
  is_sample, active, sort_order, image_key, created_at, updated_at, archived
FROM services;

-- 3. Bookings, slot units and payments point at the new services table.
CREATE TABLE bookings_new2 (
  id TEXT PRIMARY KEY,
  service_id INTEGER REFERENCES services_new (id) ON DELETE SET NULL,
  service_snapshot TEXT NOT NULL,
  session_format TEXT NOT NULL CHECK (session_format IN ('call', 'text')),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL CHECK (end_at > start_at),
  status TEXT NOT NULL CHECK (status IN ('held', 'confirmed', 'completed', 'cancelled', 'expired', 'refunded')),
  hold_expires_at INTEGER,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  answers_json TEXT NOT NULL DEFAULT '{}',
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
  admin_note TEXT NOT NULL DEFAULT '',
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO bookings_new2 (id, service_id, service_snapshot, session_format, start_at, end_at, status,
  hold_expires_at, client_name, client_email, client_phone, topic, question, answers_json, amount_paise,
  admin_note, confirmed_at, created_at, updated_at)
SELECT id, service_id, service_snapshot, session_format, start_at, end_at, status,
  hold_expires_at, client_name, client_email, client_phone, topic, question, answers_json, amount_paise,
  admin_note, confirmed_at, created_at, updated_at
FROM bookings;

CREATE TABLE booking_slot_units_new2 (
  unit_start INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings_new2 (id) ON DELETE CASCADE
);
INSERT INTO booking_slot_units_new2 (unit_start, booking_id) SELECT unit_start, booking_id FROM booking_slot_units;

CREATE TABLE payments_new2 (
  id INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings_new2 (id),
  gateway TEXT NOT NULL CHECK (gateway IN ('razorpay')),
  gateway_order_id TEXT NOT NULL UNIQUE,
  gateway_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 100),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'failed', 'refund_pending', 'refunded')),
  method TEXT,
  refund_id TEXT,
  refunded_paise INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO payments_new2 (id, booking_id, gateway, gateway_order_id, gateway_payment_id, amount_paise, currency,
  status, method, refund_id, refunded_paise, created_at, updated_at)
SELECT id, booking_id, gateway, gateway_order_id, gateway_payment_id, amount_paise, currency,
  status, method, refund_id, refunded_paise, created_at, updated_at
FROM payments;

-- 4. Children first, then the old parents, then rename the new tables into place.
DROP TABLE booking_slot_units;
DROP TABLE payments;
DROP TABLE bookings;
DROP TABLE services;
ALTER TABLE services_new RENAME TO services;
ALTER TABLE bookings_new2 RENAME TO bookings;
ALTER TABLE booking_slot_units_new2 RENAME TO booking_slot_units;
ALTER TABLE payments_new2 RENAME TO payments;

-- 5. Indexes that the rebuilt tables had before.
CREATE INDEX services_image ON services (image_key);
CREATE INDEX services_listing ON services (active, archived, sort_order);
CREATE INDEX services_category ON services (category);
CREATE INDEX bookings_start ON bookings (start_at, status);
CREATE INDEX bookings_hold ON bookings (status, hold_expires_at);
CREATE INDEX bookings_created ON bookings (created_at);
CREATE INDEX bookings_service ON bookings (service_id);
CREATE INDEX slot_units_booking ON booking_slot_units (booking_id);
CREATE INDEX payments_status ON payments (status, created_at);
