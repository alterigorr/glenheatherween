#!/bin/sh
# Publishes the redesign-2026 branch's page as glenheatherween.com/preview/ (sample houses only,
# hidden from search engines), so people can review a new look without touching the live site.
# Run on main:  git checkout main && tools/make-preview.sh && git add preview && git commit ...
set -e
cd "$(dirname "$0")/.."
mkdir -p preview
git show redesign-2026:scene.js > preview/scene.js
git show redesign-2026:index.html | python3 -c '
import sys, re
s = sys.stdin.read()
s = s.replace("<meta charset=\"UTF-8\">", "<meta charset=\"UTF-8\">\n<base href=\"/\">\n<meta name=\"robots\" content=\"noindex, nofollow\">\n<script>if (!new URLSearchParams(location.search).has(\"demo\")) history.replaceState(null, \"\", location.pathname + \"?demo\");</script>", 1)
s = re.sub(r"src=\"scene\.js(\?[^\"]*)?\"", "src=\"/preview/scene.js?v=" + __import__("time").strftime("%Y%m%d%H%M") + "\"", s)
s = s.replace("DEMO: these are sample houses, and nothing you enter is saved", "PREVIEW of the new look: sample houses, and nothing you enter is saved")
sys.stdout.write(s)
' > preview/index.html
echo "Wrote preview/"
