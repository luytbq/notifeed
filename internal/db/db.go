package db

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

func Open(dbFile string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbFile+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  level       TEXT NOT NULL,
  channel     TEXT NOT NULL,
  origin      TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_source     ON notifications(source);

CREATE VIRTUAL TABLE IF NOT EXISTS notifications_fts USING fts5(
  id UNINDEXED,
  title,
  message,
  origin,
  content='notifications',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS notifications_ai AFTER INSERT ON notifications BEGIN
  INSERT INTO notifications_fts(rowid, id, title, message, origin)
  VALUES (new.rowid, new.id, new.title, new.message, new.origin);
END;

CREATE TRIGGER IF NOT EXISTS notifications_ad AFTER DELETE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, id, title, message, origin)
  VALUES ('delete', old.rowid, old.id, old.title, old.message, old.origin);
END;

CREATE TRIGGER IF NOT EXISTS notifications_au AFTER UPDATE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, id, title, message, origin)
  VALUES ('delete', old.rowid, old.id, old.title, old.message, old.origin);
  INSERT INTO notifications_fts(rowid, id, title, message, origin)
  VALUES (new.rowid, new.id, new.title, new.message, new.origin);
END;
`)
	return err
}
