#!/bin/sh
# Rebuilds flyer.pdf from the ?flyer page by hand. Normally the "Rebuild flyer" GitHub workflow
# does this automatically when the admin settings change.
# Needs Google Chrome and a local server: python3 -m http.server 8026 (from the repo root).
set -e
cd "$(dirname "$0")/.."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf=flyer.pdf "http://localhost:8026/index.html?flyer&pdf"
echo "Wrote flyer.pdf"
