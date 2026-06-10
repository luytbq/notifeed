#!/usr/bin/env bash
set -e

if [ ! -f config.yaml ]; then
  cp config.yaml.example config.yaml
  echo "Created config.yaml from example — edit it then re-run."
  exit 1
fi

PORT=$(grep '^port:' config.yaml | awk '{print $2}')
PORT=${PORT:-8080}

go run -tags fts5 ./cmd/server/ &
BACKEND_PID=$!

cd frontend && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

echo ""
echo "Backend : http://localhost:$PORT"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop."
echo ""

wait
