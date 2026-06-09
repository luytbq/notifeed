.PHONY: build frontend run dev

APP_BASE_PATH ?= /

frontend:
	cd frontend && APP_BASE_PATH=$(APP_BASE_PATH) npm run build

build: frontend
	GOTOOLCHAIN=local go build -tags fts5 -o notifeed-server ./cmd/server/

run: build
	./notifeed-server

dev:
	cd frontend && npm run dev
