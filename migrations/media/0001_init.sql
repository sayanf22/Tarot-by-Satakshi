-- MEDIA_n databases (4 × 500 MB on the free plan): image bytes only.
-- Images are resized in the admin before upload, so each fits one row (D1 allows 2 MB).
CREATE TABLE media_blobs (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 1900000),
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
