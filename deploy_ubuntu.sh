#!/bin/bash
#
# Deploy NotiFeed to Ubuntu Server
#

set -e

# Configuration
SERVER_HOST="root@luytbq.site"
REMOTE_DIR="/opt/notifeed"
LOG_DIR="/var/log/notifeed"
SERVICE_NAME="notifeed"

# Build frontend (APP_BASE_PATH để assets/API calls dùng đúng prefix)
echo "Building frontend..."
cd frontend
APP_BASE_PATH=/notifeed npm run build
cd ..

# Build Linux binary
echo "Building Linux binary..."
GOOS=linux GOARCH=amd64 GOTOOLCHAIN=local go build -tags fts5 -ldflags="-s -w" -o notifeed-server ./cmd/server/

# Deploy
echo "Deploying to $SERVER_HOST..."
ssh $SERVER_HOST "sudo systemctl stop $SERVICE_NAME 2>/dev/null || true"
ssh $SERVER_HOST "sudo mkdir -p $REMOTE_DIR $LOG_DIR && sudo chown www-data:www-data $LOG_DIR"
scp notifeed-server $SERVER_HOST:$REMOTE_DIR/
scp notifeed.service $SERVER_HOST:/tmp/
scp notifeed.logrotate $SERVER_HOST:/tmp/
ssh $SERVER_HOST "sudo mv /tmp/notifeed.service /etc/systemd/system/"
ssh $SERVER_HOST "sudo mv /tmp/notifeed.logrotate /etc/logrotate.d/notifeed"
ssh $SERVER_HOST "sudo chown -R www-data:www-data $REMOTE_DIR"

# Upload config nếu chưa tồn tại trên server
if ! ssh $SERVER_HOST "test -f $REMOTE_DIR/config.yaml"; then
    echo "config.yaml not found on server — uploading config.yaml.example as template..."
    scp config.yaml.example $SERVER_HOST:$REMOTE_DIR/config.yaml
    echo "  !! Nhớ chỉnh config.yaml trên server trước khi start service !!"
fi

# Install and start service
echo "Starting service..."
ssh $SERVER_HOST "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE_NAME && sudo systemctl restart $SERVICE_NAME"

# Cleanup
rm -f notifeed-server

echo ""
echo "Done!"
echo "  Status : ssh $SERVER_HOST 'sudo systemctl status $SERVICE_NAME'"
echo "  Logs   : ssh $SERVER_HOST 'tail -f $LOG_DIR/notifeed.log'"
echo "  Config : ssh $SERVER_HOST 'sudo nano $REMOTE_DIR/config.yaml'"
