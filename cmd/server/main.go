package main

import (
	"io/fs"
	"log"
	"net/http"

	"notifeed/internal/api"
	"notifeed/internal/config"
	"notifeed/internal/db"
	"notifeed/internal/hub"
	notifeedweb "notifeed/web"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	database, err := db.Open(cfg.DBFile)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	h := hub.New()
	go h.Run()

	webFS, err := fs.Sub(notifeedweb.FS, "dist")
	if err != nil {
		log.Fatalf("web fs: %v", err)
	}

	router := api.NewRouter(cfg, database, h, webFS)

	log.Printf("listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
