const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(
  process.env.DB_PATH || path.join(__dirname, "ajaia.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    content TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS document_shares (
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission TEXT NOT NULL DEFAULT 'viewer'
      CHECK(permission IN ('viewer', 'editor')),
    PRIMARY KEY (document_id, user_id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
      ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Add version column to existing databases if missing.
const columns = db.prepare(
  "PRAGMA table_info(documents)"
).all();

const hasVersion = columns.some(
  (column) => column.name === "version"
);

if (!hasVersion) {
  db.exec(`
    ALTER TABLE documents
    ADD COLUMN version INTEGER NOT NULL DEFAULT 1
  `);
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email)
  VALUES (?, ?, ?)
`);

insertUser.run(1, "Demo User", "demo@example.com");
insertUser.run(2, "Alex", "alex@example.com");
insertUser.run(3, "Taylor", "taylor@example.com");

module.exports = db;
