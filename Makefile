.PHONY: build frontend run dev deploy

BASE_PATH ?= /notifeed

frontend:
	cd frontend && npm run build -- --base $(BASE_PATH)

build: frontend
	go build -ldflags="-s -w" -o notifeed-server ./cmd/server/

build-linux: frontend
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o notifeed-server ./cmd/server/

run: build
	./notifeed-server

dev:
	cd frontend && npm run dev

deploy:
	./scripts/deploy_ubuntu.sh $(HOST)
