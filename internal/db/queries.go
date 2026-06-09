package db

import (
	"database/sql"
	"strings"
	"time"
)

type Notification struct {
	ID         string `json:"id"`
	Source     string `json:"source"`
	Title      string `json:"title"`
	Message    string `json:"message"`
	Level      string `json:"level"`
	Channel    string `json:"channel"`
	Origin     string `json:"origin,omitempty"`
	IsRead     bool   `json:"is_read"`
	CreatedAt  string `json:"created_at"`
	ReceivedAt string `json:"received_at"`
}

type ListFilter struct {
	Limit  int
	Before string // ISO8601 cursor
	IsRead *bool
	Source string
	Level  string
}

type DeleteFilter struct {
	IsRead *bool
	Source string
	Level  string
}

func InsertNotification(db *sql.DB, n Notification) error {
	n.ReceivedAt = time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(`
INSERT OR IGNORE INTO notifications (id, source, title, message, level, channel, origin, is_read, created_at, received_at)
VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
		n.ID, n.Source, n.Title, n.Message, n.Level, n.Channel, n.Origin, n.CreatedAt, n.ReceivedAt,
	)
	return err
}

func ListNotifications(db *sql.DB, f ListFilter) ([]Notification, string) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	args := []any{}
	wheres := []string{}

	if f.Before != "" {
		wheres = append(wheres, "created_at < ?")
		args = append(args, f.Before)
	}
	if f.IsRead != nil {
		wheres = append(wheres, "is_read = ?")
		if *f.IsRead {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}
	if f.Source != "" {
		wheres = append(wheres, "source = ?")
		args = append(args, f.Source)
	}
	if f.Level != "" {
		wheres = append(wheres, "level = ?")
		args = append(args, f.Level)
	}

	where := ""
	if len(wheres) > 0 {
		where = "WHERE " + strings.Join(wheres, " AND ")
	}

	args = append(args, f.Limit+1)
	rows, err := db.Query(`
SELECT id, source, title, message, level, channel, COALESCE(origin,''), is_read, created_at, received_at
FROM notifications `+where+` ORDER BY created_at DESC LIMIT ?`, args...)
	if err != nil {
		return nil, ""
	}
	defer rows.Close()

	var items []Notification
	for rows.Next() {
		var n Notification
		var isRead int
		rows.Scan(&n.ID, &n.Source, &n.Title, &n.Message, &n.Level, &n.Channel, &n.Origin, &isRead, &n.CreatedAt, &n.ReceivedAt)
		n.IsRead = isRead == 1
		items = append(items, n)
	}

	nextCursor := ""
	if len(items) > f.Limit {
		nextCursor = items[f.Limit].CreatedAt
		items = items[:f.Limit]
	}

	return items, nextCursor
}

func MarkRead(db *sql.DB, id string) error {
	_, err := db.Exec(`UPDATE notifications SET is_read=1 WHERE id=?`, id)
	return err
}

func MarkAllRead(db *sql.DB) error {
	_, err := db.Exec(`UPDATE notifications SET is_read=1 WHERE is_read=0`)
	return err
}

func DeleteOne(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM notifications WHERE id=?`, id)
	return err
}

func DeleteMany(db *sql.DB, f DeleteFilter) error {
	wheres := []string{}
	args := []any{}

	if f.IsRead != nil {
		wheres = append(wheres, "is_read = ?")
		if *f.IsRead {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}
	if f.Source != "" {
		wheres = append(wheres, "source = ?")
		args = append(args, f.Source)
	}
	if f.Level != "" {
		wheres = append(wheres, "level = ?")
		args = append(args, f.Level)
	}

	where := ""
	if len(wheres) > 0 {
		where = "WHERE " + strings.Join(wheres, " AND ")
	}

	_, err := db.Exec(`DELETE FROM notifications `+where, args...)
	return err
}

func Search(db *sql.DB, q string, limit int) ([]Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := db.Query(`
SELECT n.id, n.source, n.title, n.message, n.level, n.channel, COALESCE(n.origin,''), n.is_read, n.created_at, n.received_at
FROM notifications n
JOIN notifications_fts f ON n.rowid = f.rowid
WHERE notifications_fts MATCH ?
ORDER BY n.created_at DESC LIMIT ?`, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Notification
	for rows.Next() {
		var n Notification
		var isRead int
		rows.Scan(&n.ID, &n.Source, &n.Title, &n.Message, &n.Level, &n.Channel, &n.Origin, &isRead, &n.CreatedAt, &n.ReceivedAt)
		n.IsRead = isRead == 1
		items = append(items, n)
	}
	return items, nil
}

func UnreadCount(db *sql.DB) (int, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE is_read=0`).Scan(&count)
	return count, err
}
