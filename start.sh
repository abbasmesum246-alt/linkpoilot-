#!/usr/bin/env bash
# LinkPilot — one-command start
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "[linkpilot] installing dependencies…"
  npm install --no-audit --no-fund
fi

if [ ! -f public/app.js ] || [ src/main.jsx -nt public/app.js ]; then
  echo "[linkpilot] building frontend…"
  npm run build
fi

echo "[linkpilot] starting on http://localhost:3000"
exec node server.js
