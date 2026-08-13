-- D1 schema. Mirrors the node:sqlite schema from server/db.js so the exported
-- Railway data imports without transformation. The `admins` table is gone:
-- Cloudflare Access authenticates the admin panel now.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS applications (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  budget     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id          TEXT PRIMARY KEY,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_builtin  INTEGER NOT NULL DEFAULT 0,
  code        TEXT NOT NULL DEFAULT '',
  name_en     TEXT NOT NULL DEFAULT '',
  name_uk     TEXT NOT NULL DEFAULT '',
  role_en     TEXT NOT NULL DEFAULT '',
  role_uk     TEXT NOT NULL DEFAULT '',
  location_en TEXT NOT NULL DEFAULT '',
  location_uk TEXT NOT NULL DEFAULT '',
  bio_en      TEXT NOT NULL DEFAULT '',
  bio_uk      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'online',
  skills      TEXT NOT NULL DEFAULT '[]',
  photo_url   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS projects (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  case_label TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  image_url  TEXT NOT NULL DEFAULT '',
  desc_en    TEXT NOT NULL DEFAULT '',
  desc_uk    TEXT NOT NULL DEFAULT ''
);

-- express-rate-limit lived in memory; on Workers each request may hit a cold
-- isolate, so the contact-form limit is stored instead.
CREATE TABLE IF NOT EXISTS rate_hits (
  bucket TEXT NOT NULL,
  ts     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits ON rate_hits (bucket, ts);
