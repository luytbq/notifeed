package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"notifeed/internal/config"
	"notifeed/internal/db"
	"notifeed/internal/hub"
)

type Handler struct {
	cfg      *config.Config
	database *sql.DB
	hub      *hub.Hub
}

func NewHandler(cfg *config.Config, database *sql.DB, h *hub.Hub) *Handler {
	return &Handler{cfg: cfg, database: database, hub: h}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if body.Password != h.cfg.Password {
		http.Error(w, "invalid password", http.StatusUnauthorized)
		return
	}
	setSessionCookie(w, h.cfg.SessionSecret)
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	clearSessionCookie(w)
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))

	filter := db.ListFilter{
		Limit:  limit,
		Before: q.Get("before"),
		Source: q.Get("source"),
		Level:  q.Get("level"),
	}
	if isRead := q.Get("is_read"); isRead == "0" {
		v := false
		filter.IsRead = &v
	} else if isRead == "1" {
		v := true
		filter.IsRead = &v
	}

	items, nextCursor := db.ListNotifications(h.database, filter)
	if items == nil {
		items = []db.Notification{}
	}

	jsonOK(w, map[string]any{
		"items":       items,
		"next_cursor": nextCursor,
	})
}

func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := db.MarkRead(h.database, id); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	if err := db.MarkAllRead(h.database); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteOne(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := db.DeleteOne(h.database, id); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteMany(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := db.DeleteFilter{
		Source: q.Get("source"),
		Level:  q.Get("level"),
	}
	if isRead := q.Get("is_read"); isRead == "0" {
		v := false
		filter.IsRead = &v
	} else if isRead == "1" {
		v := true
		filter.IsRead = &v
	}

	if err := db.DeleteMany(h.database, filter); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonOK(w, map[string]any{"items": []db.Notification{}})
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := db.Search(h.database, q, limit)
	if err != nil {
		http.Error(w, "search error", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []db.Notification{}
	}
	jsonOK(w, map[string]any{"items": items})
}

func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	h.hub.ServeSSE(w, r)
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
