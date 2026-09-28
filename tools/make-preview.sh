#!/bin/sh
# Publishes the redesign-2026 branch's page as glenheatherween.com/preview/ (sample houses only,
# hidden from search engines), so people can review a new look without touching the live site.
# Usage (on main, with the local server running on :8026 from a checkout of the branch for the PDF):
#   tools/make-preview.sh [path-to-preview-flyer.pdf]
set -e
cd "$(dirname "$0")/.."
mkdir -p preview
git show redesign-2026:scene.js > preview/scene.js
git show redesign-2026:demo.js > preview/demo.js
[ -n "$1" ] && cp "$1" preview/flyer.pdf
git show redesign-2026:index.html | python3 -c '
import sys, re, time
s = sys.stdin.read()
head = """<meta charset="UTF-8">
<base href="/">
<meta name="robots" content="noindex, nofollow">
<script>
  // The preview always runs on sample houses; keep any other options (like ?flyer).
  (function () {
    var q = new URLSearchParams(location.search);
    if (!q.has("demo")) { q.set("demo", ""); history.replaceState(null, "", location.pathname + "?" + q.toString().replace(/=(&|$)/g, "$1")); }
  })();
</script>"""
s = s.replace("<meta charset=\"UTF-8\">", head, 1)
s = re.sub(r"src=\"scene\.js(\?[^\"]*)?\"", "src=\"/preview/scene.js?v=" + time.strftime("%Y%m%d%H%M") + "\"", s)
s = s.replace("import(\x27./demo.js\x27)", "import(\x27/preview/demo.js\x27)")
s = s.replace("href=\"flyer.pdf\"", "href=\"/preview/flyer.pdf\"")
s = s.replace("href=\"?flyer\"", "href=\"/preview/?flyer\"").replace("href=\"?lists\"", "href=\"/preview/?lists\"")
s = s.replace("DEMO: these are sample houses, and nothing you enter is saved",
              "PREVIEW of the new look (sample houses, nothing is saved) · <a href=\"/preview/?flyer\">See the new flyer</a> · <a href=\"/preview/flyer.pdf\">PDF</a>")
sys.stdout.write(s)
' > preview/index.html
echo "Wrote preview/"
