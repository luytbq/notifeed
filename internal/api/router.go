package api

import (
	"database/sql"
	"io"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"notifeed/internal/config"
	"notifeed/internal/hub"
	"notifeed/internal/webhook"
)

func NewRouter(cfg *config.Config, database *sql.DB, h *hub.Hub, webFS fs.FS) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)

	handler := NewHandler(cfg, database, h)

	// Webhook (HMAC auth, no session)
	r.Post("/webhook/{source}", webhook.Handler(cfg, database, h))

	// Auth
	r.Post("/api/login", handler.Login)
	r.Post("/api/logout", handler.Logout)

	// Protected API
	r.Group(func(r chi.Router) {
		r.Use(AuthMiddleware(cfg.SessionSecret))

		r.Get("/api/notifications", handler.ListNotifications)
		r.Get("/api/notifications/search", handler.Search)
		r.Patch("/api/notifications/read-all", handler.MarkAllRead)
		r.Patch("/api/notifications/{id}/read", handler.MarkRead)
		r.Delete("/api/notifications/{id}", handler.DeleteOne)
		r.Delete("/api/notifications", handler.DeleteMany)
		r.Get("/api/stream", handler.Stream)
	})

	// SPA static files
	if webFS != nil {
		r.Handle("/*", spaHandler(webFS))
	}

	return r
}

type readSeekerFile interface {
	fs.File
	io.ReadSeeker
}

func spaHandler(webFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(webFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if len(path) > 0 && path[0] == '/' {
			path = path[1:]
		}
		if path == "" {
			path = "index.html"
		}
		f, err := webFS.Open(path)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		// Serve index.html for SPA client-side routing
		index, err := webFS.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer index.Close()
		stat, _ := index.Stat()
		if rs, ok := index.(readSeekerFile); ok {
			http.ServeContent(w, r, "index.html", stat.ModTime(), rs)
		}
	})
}
