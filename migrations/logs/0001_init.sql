-- LOGS database: records that grow over time, kept apart from bookings so the main
-- database stays small and fast. No card or UPI details are ever stored.

CREATE TABLE email_log (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  last_error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX email_log_created ON email_log (created_at);

-- Every admin change: who, what, when.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log (at);

-- Gateway events as processed: ids and outcome only, never the full payload.
-- event_id is unique, so a repeated webhook is recognised and skipped.
CREATE TABLE payment_events (
  event_id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  event TEXT NOT NULL,
  order_id TEXT,
  payment_id TEXT,
  outcome TEXT NOT NULL
);
CREATE INDEX payment_events_at ON payment_events (at);

-- Admin sign-in attempts, for lockout after repeated failures.
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1))
);
CREATE INDEX login_attempts_at ON login_attempts (at, ok);
