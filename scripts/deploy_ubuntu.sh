#!/bin/bash
#
# Deploy NotiFeed to Ubuntu Server
# Usage: ./scripts/deploy_ubuntu.sh user@host
#

set -euo pipefail

cd "$(dirname "$0")/.."

SERVER_HOST="${1:?Usage: $0 user@host}"
REMOTE_DIR="/opt/notifeed"
LOG_DIR="/var/log/notifeed"
SERVICE_NAME="notifeed"

# Build
echo "==> Building frontend..."
cd frontend && npm run build -- --base /notifeed && cd ..

echo "==> Building Linux binary..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o notifeed-server ./cmd/server/

# Upload binary + service files
echo "==> Uploading files to $SERVER_HOST..."
scp -q notifeed-server "$SERVER_HOST:/tmp/notifeed-server"
scp -q notifeed.service notifeed.logrotate "$SERVER_HOST:/tmp/"

# Remote setup (single SSH session)
ssh "$SERVER_HOST" bash -s <<EOF
set -e

sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

sudo mkdir -p $REMOTE_DIR $LOG_DIR
sudo chown www-data:www-data $LOG_DIR

sudo mv /tmp/notifeed-server $REMOTE_DIR/notifeed-server
sudo chmod 755 $REMOTE_DIR/notifeed-server
sudo chown www-data:www-data $REMOTE_DIR/notifeed-server

sudo mv /tmp/notifeed.service /etc/systemd/system/
sudo mv /tmp/notifeed.logrotate /etc/logrotate.d/notifeed

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME
EOF

# Upload config if not present (after service starts to avoid chown race)
if ! ssh "$SERVER_HOST" "test -f $REMOTE_DIR/config.yaml"; then
    echo "==> config.yaml not found — uploading template..."
    scp -q config.yaml.example "$SERVER_HOST:$REMOTE_DIR/config.yaml"
    ssh "$SERVER_HOST" "sudo chown www-data:www-data $REMOTE_DIR/config.yaml"
    echo "    !! Edit $REMOTE_DIR/config.yaml on the server then restart the service !!"
fi

rm -f notifeed-server

echo ""
echo "Done!"
echo "  Status : ssh $SERVER_HOST 'sudo systemctl status $SERVICE_NAME'"
echo "  Logs   : ssh $SERVER_HOST 'sudo tail -f $LOG_DIR/notifeed.log'"
echo "  Config : ssh $SERVER_HOST 'sudo nano $REMOTE_DIR/config.yaml'"
