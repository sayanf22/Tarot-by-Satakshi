-- 1. Admin sign-in by emailed one-time code (Resend). The password + authenticator
--    sign-in is removed, with its table and setting.
-- 2. Deleting a plan removes it completely. Past bookings keep their own copy of the
--    plan (service_snapshot), so service_id becomes optional and is cleared on delete.
-- 3. Images are stored once: a content hash stops the same picture being saved twice.
-- Rebuilding bookings needs its child tables rebuilt too (dropping a parent with
-- foreign keys on would cascade), so the new child tables point at bookings_new,
-- which SQLite renames to bookings in their definitions. Production had no bookings.

DROP TABLE IF EXISTS admin_account;
DELETE FROM settings WHERE key = 'totp_last_step';
DELETE FROM admin_sessions;

CREATE TABLE admin_login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX admin_login_codes_email ON admin_login_codes (email, created_at);

CREATE TABLE bookings_new (
  id TEXT PRIMARY KEY,
  service_id INTEGER REFERENCES services (id) ON DELETE SET NULL,
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
INSERT INTO bookings_new SELECT * FROM bookings;

CREATE TABLE booking_slot_units_new (
  unit_start INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings_new (id) ON DELETE CASCADE
);
INSERT INTO booking_slot_units_new SELECT * FROM booking_slot_units;

CREATE TABLE payments_new (
  id INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings_new (id),
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
INSERT INTO payments_new SELECT * FROM payments;

DROP TABLE booking_slot_units;
DROP TABLE payments;
DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;
ALTER TABLE booking_slot_units_new RENAME TO booking_slot_units;
ALTER TABLE payments_new RENAME TO payments;

CREATE INDEX bookings_start ON bookings (start_at, status);
CREATE INDEX bookings_hold ON bookings (status, hold_expires_at);
CREATE INDEX bookings_created ON bookings (created_at);
CREATE INDEX bookings_service ON bookings (service_id);
CREATE INDEX slot_units_booking ON booking_slot_units (booking_id);
CREATE INDEX payments_status ON payments (status, created_at);

-- Images: shard 1-8, and the SHA-256 of the bytes so a repeat upload reuses the first copy.
CREATE TABLE media_new (
  key TEXT PRIMARY KEY,
  shard INTEGER NOT NULL CHECK (shard BETWEEN 1 AND 8),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size > 0),
  content_hash TEXT NOT NULL UNIQUE,
  alt TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
DROP TABLE media;
ALTER TABLE media_new RENAME TO media;
CREATE INDEX media_shard ON media (shard, size);
CREATE INDEX services_image ON services (image_key);
