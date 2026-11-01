-- Production schema for bookings, payments and admin sign-in.
-- The booking tables were empty when this ran, so they are rebuilt with the final
-- statuses. Logs and image data move to their own databases (LOGS, MEDIA_1..4).

DROP TABLE IF EXISTS booking_slot_units;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS email_log;
DROP TABLE IF EXISTS media;

-- Plans can be archived (hidden, kept for old bookings) or deleted when unused.
ALTER TABLE services ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1));
CREATE INDEX services_listing ON services (active, archived, sort_order);

-- held       slot reserved while the client pays (hold_expires_at)
-- confirmed  paid; the session will happen
-- completed  session done (set by the admin)
-- cancelled  cancelled by the admin (refund recorded separately)
-- expired    hold ran out without payment
-- refunded   paid, then refunded (for example a late payment for a taken slot)
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services (id),
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
CREATE INDEX bookings_start ON bookings (start_at, status);
CREATE INDEX bookings_hold ON bookings (status, hold_expires_at);
CREATE INDEX bookings_created ON bookings (created_at);

-- One row per 15-minute block. The primary key makes double booking impossible.
CREATE TABLE booking_slot_units (
  unit_start INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE
);
CREATE INDEX slot_units_booking ON booking_slot_units (booking_id);

-- One Razorpay order per booking. Amounts in paise, always taken from D1.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings (id),
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
CREATE INDEX payments_status ON payments (status, created_at);

-- Admin sessions. Only a SHA-256 of the cookie token is stored.
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_expires ON admin_sessions (expires_at);

-- Index of uploaded images. The bytes live in one of the MEDIA_n databases.
CREATE TABLE media (
  key TEXT PRIMARY KEY,
  shard INTEGER NOT NULL CHECK (shard BETWEEN 1 AND 4),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size > 0),
  alt TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX media_shard ON media (shard);

INSERT INTO settings (key, value) VALUES ('totp_last_step', '0') ON CONFLICT (key) DO NOTHING;
