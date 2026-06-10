.PHONY: build frontend run dev

BASE_PATH ?= /notifeed

frontend:
	cd frontend && npm run build -- --base $(BASE_PATH)

build: frontend
	GOTOOLCHAIN=local go build -o notifeed-server ./cmd/server/

run: build
	./notifeed-server

dev:
	cd frontend && npm run dev
