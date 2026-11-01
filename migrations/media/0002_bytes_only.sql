-- Keep only the key and the bytes in each media shard. Type, size, hash and date
-- already live in the core database's `media` index, so storing them twice wasted space.
DROP TABLE media_blobs;
CREATE TABLE media_blobs (
  key TEXT PRIMARY KEY,
  data BLOB NOT NULL CHECK (length(data) BETWEEN 1 AND 1900000)
) WITHOUT ROWID;
