const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db;

function getDb() {
  if (db) return db;

  const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "db.sqlite");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('forecast','report')),
      filepath TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      parsed_data TEXT,
      sheets_found TEXT,
      warnings TEXT,
      status TEXT DEFAULT 'parsed' CHECK(status IN ('parsed','error')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
