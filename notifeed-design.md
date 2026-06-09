# NotiFeed — Design Document

## Overview

NotiFeed là một web app nhận notification từ webhook sources (chủ yếu từ PNS), lưu vào SQLite, và hiển thị realtime feed cho người dùng. Single-user, password login.

## Architecture

```
PNS (WebhookChannel)
  └── POST /webhook/pns  ──→  NotiFeed API (Go)
                                  ├── verify HMAC
                                  ├── write → SQLite
                                  └── broadcast → SSE hub
                                                    └── React frontend
```

## Tech Stack

- **Backend**: Go
- **Frontend**: React (SPA)
- **Database**: SQLite
- **Realtime**: SSE (Server-Sent Events)
- **Auth**: password login, cookie session

---

## Configuration

File `callers.json` tại root:

```json
[
  { "name": "pns", "secret": "hmac-secret-here" },
  { "name": "other-source", "secret": "another-secret" }
]
```

File `.env`:

```
PORT=8080
PASSWORD=your-login-password
SESSION_SECRET=random-secret-for-signing-cookies
CALLERS_FILE=callers.json
DB_FILE=notifeed.db
```

---

## Data Model

### Table: `notifications`

```sql
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,       -- UUID từ source
  source      TEXT NOT NULL,          -- caller name (e.g. "pns")
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  level       TEXT NOT NULL,          -- info | warning | error | critical
  channel     TEXT NOT NULL,          -- channel name trong PNS payload
  origin      TEXT,                   -- "source" field từ PNS (script name, etc.)
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,          -- ISO8601, từ payload
  received_at TEXT NOT NULL           -- ISO8601, thời điểm notifeed nhận
);

CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX idx_notifications_source     ON notifications(source);
```

Full-text search dùng SQLite FTS5:

```sql
CREATE VIRTUAL TABLE notifications_fts USING fts5(
  id UNINDEXED,
  title,
  message,
  origin,
  content='notifications',
  content_rowid='rowid'
);
```

---

## API

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Login bằng password |
| POST | `/api/logout` | Logout, clear session |

**POST /api/login**
```json
{ "password": "..." }
```
Response: set `Set-Cookie: session=...` (signed, httpOnly)

Tất cả `/api/*` và `/webhook/*` routes đều require session cookie, **ngoại trừ** `/webhook/:source` (dùng HMAC thay thế).

---

### Webhook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/:source` | Nhận notification từ caller |

**Headers:**
- `Content-Type: application/json`
- `X-PNS-Signature: sha256=<hmac-hex>`

**Body** (NotificationPayload từ PNS):
```json
{
  "id": "uuid",
  "title": "...",
  "message": "...",
  "level": "error",
  "channel": "webhook:notifeed",
  "api_key": "...",
  "created_at": "2026-06-09T10:00:00Z",
  "source": "backup-script"
}
```

**HMAC verification:**
```
signature = HMAC-SHA256(secret, request_body_bytes)
compare X-PNS-Signature header value với "sha256=" + hex(signature)
```

Response `200 OK` nếu thành công, `401` nếu signature sai, `404` nếu source không tồn tại.

---

### Notifications

Tất cả require session cookie.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Xóa một notification |
| DELETE | `/api/notifications` | Xóa nhiều (by filter) |
| GET | `/api/notifications/search` | Tìm kiếm full-text |

**GET /api/notifications**

Query params:
- `limit` (default: 50)
- `before` — cursor pagination, ISO8601 timestamp
- `is_read` — `0` hoặc `1` (optional filter)
- `source` — filter theo caller name
- `level` — filter theo level

Response:
```json
{
  "items": [...],
  "next_cursor": "2026-06-08T23:00:00Z"
}
```

**GET /api/notifications/search**

Query params:
- `q` — search query (FTS5)
- `limit` (default: 50)

---

### Realtime

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream` | SSE stream |

**SSE event format:**
```
event: notification
data: {"id":"...","title":"...","message":"...","level":"error","source":"pns","origin":"backup-script","created_at":"...","is_read":false}
```

Khi có notification mới, SSE hub broadcast tới tất cả connected clients. Frontend dùng `EventSource` API.

---

## SSE Hub (Go)

```
Hub {
  clients: map[chan Event]struct{}
  register chan chan Event
  unregister chan chan Event
  broadcast chan Event
}
```

- Mỗi SSE connection tạo một `chan Event`, đăng ký với Hub
- Webhook handler sau khi ghi SQLite thành công → gửi event vào `hub.broadcast`
- Hub fan-out tới tất cả registered clients

---

## Auth Flow

- Chỉ có một password, lưu trong `.env` (hoặc hashed trong config)
- Login thành công → tạo signed session cookie (dùng `gorilla/sessions` hoặc tự implement với HMAC)
- Session timeout: 30 ngày (configurable)
- Middleware kiểm tra cookie trên tất cả protected routes

---

## Directory Structure (đề xuất)

```
notifeed/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── api/
│   │   ├── handler.go       # REST handlers
│   │   ├── middleware.go    # auth middleware
│   │   ├── router.go
│   │   └── sse.go           # SSE hub + handler
│   ├── config/
│   │   └── config.go
│   ├── db/
│   │   ├── db.go            # SQLite init, migrations
│   │   └── queries.go       # CRUD operations
│   └── webhook/
│       └── handler.go       # /webhook/:source, HMAC verify
├── web/                     # React frontend (built output served by Go)
│   └── dist/
├── frontend/                # React source
│   ├── src/
│   └── package.json
├── callers.json.example
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

Go server serve React build (`web/dist`) dưới route `/` — single binary deployment.

---

## PNS Side — WebhookChannel

Cần implement trong PNS repo:

**`internal/channels/webhook.go`**
- Struct `WebhookChannel` implement `Channel` interface
- Config: `{Name, URL, Secret}`
- `Send()`: marshal `NotificationPayload` → compute HMAC-SHA256 → POST với header `X-PNS-Signature: sha256=<hex>`

**`webhooks.json`** (ở root PNS):
```json
[
  {
    "name": "notifeed",
    "url": "http://localhost:8080/webhook/pns",
    "secret": "shared-hmac-secret"
  }
]
```

**`cmd/server/main.go`**: load `webhooks.json`, tạo một `WebhookChannel` per entry, register vào registry với name `webhook:<name>`.

Channel name để dùng trong request: `"channel": ["webhook:notifeed"]`
