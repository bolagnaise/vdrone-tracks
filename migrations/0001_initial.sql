CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  scene_id INTEGER NOT NULL,
  scene_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  type INTEGER NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  remote_path TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_name ON tracks(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_scene ON tracks(scene_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_type ON tracks(type);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  inactive_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
