.PHONY: build frontend run dev

frontend:
	cd frontend && npm run build

build: frontend
	GOTOOLCHAIN=local go build -tags fts5 -o notifeed-server ./cmd/server/

run: build
	./notifeed-server

dev:
	cd frontend && npm run dev
