/* SQLite via Node's built-in driver (node:sqlite) — zero native deps.
   All data (db file + uploads) lives under DATA_DIR so a PaaS persistent
   volume can be mounted there and survive redeploys. */
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "slv.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
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
    code        TEXT NOT NULL DEFAULT '',   -- e.g. #SV-001
    name_en     TEXT NOT NULL DEFAULT '',
    name_uk     TEXT NOT NULL DEFAULT '',
    role_en     TEXT NOT NULL DEFAULT '',
    role_uk     TEXT NOT NULL DEFAULT '',
    location_en TEXT NOT NULL DEFAULT '',
    location_uk TEXT NOT NULL DEFAULT '',
    bio_en      TEXT NOT NULL DEFAULT '',
    bio_uk      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'online',
    skills      TEXT NOT NULL DEFAULT '[]', -- JSON [{label_en,label_uk,level}]
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
`);

module.exports = { db, DATA_DIR, UPLOAD_DIR };
