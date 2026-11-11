-- Extra admins, added and removed by the main admin on the Account page.
-- The main admin (ADMIN_EMAILS in wrangler.jsonc) is not stored here and can't be removed.
-- The Worker also creates this table on first use (worker/lib/auth.ts ensureAdminTable),
-- so applying this file again changes nothing.
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY CHECK (length(email) BETWEEN 3 AND 254),
  added_by TEXT NOT NULL,
  added_at INTEGER NOT NULL
);
