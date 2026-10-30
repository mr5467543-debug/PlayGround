#!/usr/bin/env bash
# Build the static design dossier and serve it in the foreground.
# All source and build output live inside PROJECT_DIR; OPENCODE_WEB_DIR only
# receives worker metadata.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1 && PORT <= 65535 )) || {
  echo "PORT must be an integer between 1 and 65535 (got: $PORT)" >&2
  exit 1
}
export PORT

OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
DIST_DIR="$PROJECT_DIR/dist"
DEPLOY_FILE="$OPENCODE_WEB_DIR/deployment-output.json"

timed() {
  /usr/bin/time -p "$@"
}

echo "== Echoes of the 100th Floor =="
echo "Project: $PROJECT_DIR"
echo "Port:    $PORT"

timed mkdir -p "$OPENCODE_WEB_DIR" "$DIST_DIR"

# No runtime dependencies are required for this static build. Install first if
# a package project is added later.
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    timed npm ci --no-audit --no-fund
  else
    timed npm install --no-audit --no-fund
  fi
fi

timed node "$PROJECT_DIR/tools/build-site.mjs"

[[ -f "$DIST_DIR/index.html" ]] || {
  echo "Build did not produce dist/index.html" >&2
  exit 1
}

# Publish the controller's deployment metadata only after the build succeeds.
timed node -e '
const fs = require("node:fs");
const [file, project, directory] = process.argv.slice(1);
fs.mkdirSync(require("node:path").dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ project, directory }, null, 2) + "\n");
' "$DEPLOY_FILE" "$PROJECT_DIR" "$DIST_DIR"

echo "Deployment output: $DEPLOY_FILE"
timed cat "$DEPLOY_FILE"

echo "Serving $DIST_DIR on 0.0.0.0:$PORT (foreground)"
timed node "$PROJECT_DIR/tools/serve.mjs" "$DIST_DIR"
