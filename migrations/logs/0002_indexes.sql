-- Faster per-visitor lockout checks on sign-in.
CREATE INDEX login_attempts_ip ON login_attempts (ip_hash, at);
