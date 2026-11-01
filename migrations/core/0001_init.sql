-- Tarot by Satakshi: first schema.
-- Times are Unix milliseconds (UTC). Money is in paise. Dates are YYYY-MM-DD in IST.

-- Readings shown on the site and offered in the booking form.
CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND length(slug) BETWEEN 2 AND 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  category TEXT NOT NULL CHECK (category IN ('tarot', 'astrology')),
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
  updated_at INTEGER NOT NULL
);

-- Small key/value settings: booking window, notice, slot length.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Weekly opening hours in minutes from midnight IST. weekday: 0 = Sunday.
CREATE TABLE availability_rules (
  weekday INTEGER PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  open_min INTEGER NOT NULL CHECK (open_min BETWEEN 0 AND 1440),
  close_min INTEGER NOT NULL CHECK (close_min BETWEEN 0 AND 1440)
);

-- One-off changes: a day off, or different hours on one date.
CREATE TABLE availability_overrides (
  date TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  closed INTEGER NOT NULL DEFAULT 1 CHECK (closed IN (0, 1)),
  open_min INTEGER,
  close_min INTEGER,
  note TEXT
);

-- A booking starts as a 15-minute hold and becomes confirmed after payment.
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services (id),
  service_snapshot TEXT NOT NULL,
  session_format TEXT NOT NULL CHECK (session_format IN ('call', 'text')),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'confirmed', 'cancelled', 'expired')),
  hold_expires_at INTEGER,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  answers_json TEXT NOT NULL DEFAULT '{}',
  amount_paise INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX bookings_start ON bookings (start_at);
CREATE INDEX bookings_status ON bookings (status, hold_expires_at);

-- One row per 15-minute block a booking covers. The primary key makes double
-- booking impossible, even when two clients submit at the same moment.
CREATE TABLE booking_slot_units (
  unit_start INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE
);
CREATE INDEX slot_units_booking ON booking_slot_units (booking_id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  gateway TEXT NOT NULL,
  gateway_order_id TEXT NOT NULL UNIQUE,
  gateway_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX payments_booking ON payments (booking_id);

-- Each gateway event is processed once.
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  gateway TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Contact form messages.
CREATE TABLE enquiries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at INTEGER NOT NULL
);
CREATE INDEX enquiries_created ON enquiries (created_at);

CREATE TABLE email_log (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

-- Per-visitor request counts. The key holds a salted hash of the IP, never the IP.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expires ON rate_limits (expires_at);

-- Images uploaded from the admin, stored in R2 under a random key.
CREATE TABLE media (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- Confirmed hours: Monday to Saturday, 11 am to 9 pm IST.
INSERT INTO availability_rules (weekday, enabled, open_min, close_min) VALUES
  (0, 0, 660, 1260),
  (1, 1, 660, 1260),
  (2, 1, 660, 1260),
  (3, 1, 660, 1260),
  (4, 1, 660, 1260),
  (5, 1, 660, 1260),
  (6, 1, 660, 1260);

-- Sample values until Satakshi confirms them (they match the site's preview).
INSERT INTO settings (key, value) VALUES
  ('slot_minutes', '60'),
  ('min_notice_minutes', '60'),
  ('window_days', '30'),
  ('hold_minutes', '15');

-- SAMPLE services, the same list the site shows. Replace from the admin.
INSERT INTO services (slug, name, category, summary, icon, card, formats, is_sample, sort_order, created_at, updated_at) VALUES
  ('tarot-reading', 'Tarot Reading', 'tarot', 'Guidance on the question on your mind.', 'cards', 'priestess', 'call,text', 1, 1, 1793548800000, 1793548800000),
  ('love-and-relationships', 'Love & Relationships', 'tarot', 'A reading on love, partners and connection.', 'heart', 'two-cups', 'call,text', 1, 2, 1793548800000, 1793548800000),
  ('career-and-money', 'Career & Money', 'tarot', 'A reading on work, career and money.', 'sun', 'ace-pentacles', 'call,text', 1, 3, 1793548800000, 1793548800000),
  ('astrology-reading', 'Astrology Reading', 'astrology', 'Guidance from your birth chart.', 'wheel', 'wheel', 'call,text', 1, 4, 1793548800000, 1793548800000),
  ('general-guidance', 'General Guidance', 'tarot', 'An open reading on where you are now.', 'star', 'hermit', 'call,text', 1, 5, 1793548800000, 1793548800000);
