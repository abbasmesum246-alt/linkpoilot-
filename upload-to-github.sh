#!/usr/bin/env bash
# Push LinkPilot to YOUR GitHub repository.
# Usage:
#   ./upload-to-github.sh https://github.com/YOUR_USERNAME/YOUR_REPO.git
# (install dependencies first if you want the prebuilt UI committed: npm install && npm run build)
set -e
cd "$(dirname "$0")"

REMOTE="${1:?Usage: ./upload-to-github.sh <repo-url>}"
BRANCH="$(git branch --show-current 2>/dev/null || echo main)"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi

echo "[linkpilot] pushing to $REMOTE (branch: $BRANCH)"
git push -u origin "$BRANCH"
echo "[linkpilot] done ✓"
