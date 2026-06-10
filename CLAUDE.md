# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (both processes, auto-restart frontend on save)
./scripts/dev.sh

# Build production binary (embeds frontend)
make build                        # base path /notifeed (default)
make build BASE_PATH=/other-path

# Run backend only (requires frontend already built)
go run -tags fts5 ./cmd/server/

# Frontend only (Vite dev server at :5173)
cd frontend && npm run dev

# Send test notifications
go run ./tool/send_test/                        # single info
go run ./tool/send_test/ -level error -n 3      # 3 error alerts
go run ./tool/send_test/ -title "X" -msg "Y" -level warning
go run ./tool/send_test/ -bulk                  # 12 varied notifications

# Deploy
./scripts/deploy_ubuntu.sh user@host
```

**Important build constraint:** Go must be built with `-tags fts5` — the SQLite FTS5 extension is required for search. Omitting it causes a runtime failure.

The `CONFIG_FILE` env var overrides the default `config.yaml` path.

## Architecture

NotiFeed is a single-binary Go server with an embedded React SPA. The binary serves both the API and the frontend from the same port.

```
Webhook source
  └─ POST /webhook/:source
       ├─ verify HMAC (X-PNS-Signature: sha256=...)
       ├─ INSERT → SQLite (notifications + FTS5 virtual table)
       └─ Broadcast → hub.Hub → SSE → browser
```

### Backend (`internal/`)

- **`config/`** — Loads `config.yaml`. Clients are named webhook senders, each with their own HMAC secret.
- **`db/`** — All SQL lives here. `db.go` opens SQLite (WAL mode) and runs inline migrations. `queries.go` has all CRUD. Cursor pagination uses `created_at DESC` + `before=<ISO8601>` param. FTS5 search joins `notifications_fts` virtual table maintained by INSERT/DELETE/UPDATE triggers.
- **`hub/`** — In-memory SSE broker. Single goroutine owns the client map; slow clients get their events dropped (non-blocking send).
- **`webhook/`** — Verifies HMAC, maps payload fields to `db.Notification` (notably: `payload.Source` → `n.Origin`, URL param `source` → `n.Source`), then inserts and broadcasts.
- **`api/`** — chi router. Session auth uses an HMAC-signed cookie (`value.sig`, 30-day TTL). `AuthMiddleware` gates all `/api/*` except login/logout. `Stream` delegates to `hub.ServeSSE`.
- **`web/embed.go`** — `//go:embed dist` bundles the Vite build output. SPA fallback serves `index.html` for unknown paths.

### Frontend (`frontend/src/`)

- **`App.tsx`** — Bootstraps auth state by probing `/api/notifications?limit=1`. Three states: `loading`, `login`, `feed`.
- **`api.ts`** — All fetch calls. In dev, `BASE_URL` is `/` so paths become bare `/api/...`; in production build it becomes `/notifeed` and prepends to all paths.
- **`FeedPage.tsx`** — Main state owner: `items` (paginated list), `searchResults` (null when not searching), `filters`, `unreadCount`. SSE events prepend directly to `items`. Mark-read and delete update both `items` and `searchResults` in-place — no re-fetch — to avoid list reordering.
- **`NotificationItem.tsx`** — Renders one card. Level accent bar is a `w-1` div (not CSS border) to avoid `border-color` shorthand override issues with Tailwind.

### Webhook payload format

```json
{
  "id": "unique-id",
  "title": "...",
  "message": "...",
  "level": "info|warning|error|critical",
  "channel": "webhook:notifeed",
  "created_at": "2026-01-01T00:00:00Z",
  "source": "sender-name"
}
```

Signature header: `X-PNS-Signature: sha256=<hmac-hex>`

## Dev proxy

`frontend/vite.config.ts` proxies `/api` and `/webhook` to `http://localhost:10099`. If `config.yaml` uses a different port, update the proxy accordingly.
