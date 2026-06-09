# NotiFeed

Web app nhận notification từ webhook sources, lưu vào SQLite, và hiển thị realtime feed. Single-user, password login.

```
Webhook source
  └── POST /webhook/:source  ──→  NotiFeed (Go)
                                      ├── verify HMAC
                                      ├── write → SQLite
                                      └── broadcast → SSE → React frontend
```

## Requirements

- Go 1.22+ (với cgo enabled, dùng để build sqlite3)
- Node.js 18+

## Setup

```bash
cp config.yaml.example config.yaml
# Chỉnh password, session_secret, và danh sách clients
```

**config.yaml:**
```yaml
port: 8080
password: your-password
session_secret: random-secret-string
db_file: notifeed.db

clients:
  - name: pns
    secret: hmac-secret-here
```

## Development

```bash
# Chạy backend (Go)
make run

# Chạy frontend với hot-reload (Vite dev server tại :5173, proxy về :8080)
make dev
```

## Build

```bash
make build
# → notifeed-server  (binary duy nhất, frontend đã embed bên trong)
```

Build với base path tùy chỉnh (mặc định `/notifeed`):
```bash
make build BASE_PATH=/other-path
```

## Deploy

```bash
# Chỉnh SERVER_HOST trong deploy_ubuntu.sh
./deploy_ubuntu.sh
```

Script sẽ build binary, scp lên server, cài systemd service và logrotate, rồi restart service.

**Nginx reverse proxy** (tham khảo `notifeed.nginx.conf`):
```nginx
location /notifeed/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Connection '';
    proxy_buffering off;   # cần thiết cho SSE
}
```

## Webhook API

Gửi notification vào NotiFeed:

```bash
SECRET="hmac-secret-here"
PAYLOAD='{"id":"uuid","title":"...","message":"...","level":"info","channel":"webhook:notifeed","created_at":"2026-06-09T10:00:00Z","source":"script-name"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST http://localhost:8080/webhook/pns \
  -H "Content-Type: application/json" \
  -H "X-PNS-Signature: sha256=$SIG" \
  -d "$PAYLOAD"
```

**Levels:** `info` | `warning` | `error` | `critical`

## REST API

Tất cả `/api/*` yêu cầu session cookie (login trước).

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/notifications` | Danh sách (filter + cursor pagination) |
| GET | `/api/notifications/search?q=` | Full-text search |
| PATCH | `/api/notifications/:id/read` | Đánh dấu đã đọc |
| PATCH | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc |
| DELETE | `/api/notifications/:id` | Xóa một notification |
| DELETE | `/api/notifications` | Xóa nhiều (theo filter) |
| GET | `/api/stream` | SSE stream realtime |

Query params cho `GET /api/notifications`: `limit`, `before` (cursor), `is_read`, `source`, `level`.
