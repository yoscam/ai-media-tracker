import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  creator TEXT,
  poster_url TEXT,
  overview TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  rating INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  total INTEGER,
  notes TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS entries_external
  ON entries(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS entries_type_status ON entries(type, status);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_key TEXT NOT NULL,
  year INTEGER,
  creator TEXT,
  poster_url TEXT,
  overview TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'ai',
  external_id TEXT,
  total INTEGER,
  reason TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  origin TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS recommendations_key ON recommendations(type, title_key);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const globalForDb = globalThis as unknown as { __mediaDb?: Database.Database };

export function db(): Database.Database {
  if (globalForDb.__mediaDb) return globalForDb.__mediaDb;
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
  fs.mkdirSync(dir, { recursive: true });
  const conn = new Database(path.join(dir, "media.db"));
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  globalForDb.__mediaDb = conn;
  return conn;
}

export function getKv(key: string): string | null {
  const row = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setKv(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
