#!/usr/bin/env bash
# Capture desktop and mobile screenshots of the running app.
# Exit 75 for transient navigation/browser failures, 1 for script or render defects.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact URL to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project.}"

timed() {
  /usr/bin/time -p "$@"
}

echo "Capturing $CAPTURE_URL"
echo "Output:    $CAPTURE_DIR"

timed mkdir -p "$CAPTURE_DIR"
timed node "$PROJECT_DIR/tools/capture.mjs"
