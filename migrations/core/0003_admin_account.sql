-- Admin password set from the dashboard ("Change password").
-- Stored as PBKDF2-SHA256 of HMAC(PASSWORD_PEPPER, password) with a random salt.
-- The pepper is a Worker secret, so this row alone can't be used to guess the password.
-- secret_fingerprint ties the row to the current ADMIN_PASSWORD secret: changing that
-- secret in the Cloudflare dashboard makes this row ignored (the forgotten-password reset).
CREATE TABLE admin_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER NOT NULL CHECK (iterations >= 10000),
  secret_fingerprint TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
