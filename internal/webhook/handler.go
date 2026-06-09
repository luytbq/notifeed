package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"notifeed/internal/config"
	"notifeed/internal/db"
	"notifeed/internal/hub"
)

type payload struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Level     string `json:"level"`
	Channel   string `json:"channel"`
	CreatedAt string `json:"created_at"`
	Source    string `json:"source"`
}

func Handler(cfg *config.Config, database *sql.DB, h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		source := chi.URLParam(r, "source")
		client, ok := cfg.FindClient(source)
		if !ok {
			http.Error(w, "unknown source", http.StatusNotFound)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read body", http.StatusBadRequest)
			return
		}

		sig := r.Header.Get("X-PNS-Signature")
		if !verifyHMAC([]byte(client.Secret), body, sig) {
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		var p payload
		if err := json.Unmarshal(body, &p); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		n := db.Notification{
			ID:        p.ID,
			Source:    source,
			Title:     p.Title,
			Message:   p.Message,
			Level:     p.Level,
			Channel:   p.Channel,
			Origin:    p.Source,
			CreatedAt: p.CreatedAt,
		}

		if err := db.InsertNotification(database, n); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		h.Broadcast(hub.Event{Type: "notification", Data: n})
		w.WriteHeader(http.StatusOK)
	}
}

func verifyHMAC(secret, body []byte, header string) bool {
	expected := strings.TrimPrefix(header, "sha256=")
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	actual := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(actual), []byte(expected))
}
