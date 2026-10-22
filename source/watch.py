#!/usr/bin/env python3
"""Bakes a document again every time it or a file it names changes, and serves it so the
open page reloads itself.

    open-package watch <content.md> [--port 8730]

The page is served from 127.0.0.1 only. The reload is a small script added to the page as it
is served, so the baked HTML stays exactly what `build` makes. The shell's own sources are
watched too, so a change to the shell shows at once.
"""

import argparse
import http.server
import pathlib
import sys
import tempfile
import threading
import time

import build

HERE = pathlib.Path(__file__).resolve().parent

RELOAD = """<script>
(function () {
  var key = 'analysis-doc:watch:scroll', main = document.getElementById('main');
  try { var y = sessionStorage.getItem(key); if (y && main) setTimeout(function () { main.scrollTop = +y; }, 300); } catch (e) { }
  var seen = null;
  setInterval(function () {
    fetch('/version', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (v) {
      if (seen === null) seen = v;
      else if (v !== seen) {
        try { if (main) sessionStorage.setItem(key, main.scrollTop); } catch (e) { }
        location.reload();
      }
    }).catch(function () { });
  }, 700);
})();
</script>"""


class State:
    version = 0
    page = b""


def watched(md: pathlib.Path) -> dict:
    files = [md, *HERE.glob("*.js"), *HERE.glob("*.css"), *HERE.glob("*.html"), *HERE.glob("*.py")]
    try:
        text = md.read_text(encoding="utf-8")
        files += [(md.parent / p).resolve() for p in build.ASSET_RE.findall(text)]
    except OSError:
        pass
    return {f: f.stat().st_mtime for f in files if f.is_file()}


def bake(md: pathlib.Path, out: pathlib.Path) -> None:
    try:
        built, note = build.build(md, out)
    except SystemExit as e:
        print(f"{time.strftime('%H:%M:%S')}  not baked: {e}", file=sys.stderr)
        return
    page = built.read_text(encoding="utf-8")
    cut = page.rfind("</body>")
    State.page = (page[:cut] + RELOAD + page[cut:]).encode("utf-8")
    State.version += 1
    print(f"{time.strftime("%H:%M:%S")}  baked ({note})", flush=True)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/version"):
            body, kind = str(State.version).encode(), "text/plain"
        else:
            body, kind = State.page, "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def main() -> int:
    ap = argparse.ArgumentParser(description="bake a document on every change and serve it")
    ap.add_argument("markdown", type=pathlib.Path)
    ap.add_argument("--port", type=int, default=8730)
    args = ap.parse_args()
    md = args.markdown.resolve()
    if not md.exists():
        print(f"no such input: {md}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as work:
        out = pathlib.Path(work) / (md.stem + ".html")
        bake(md, out)
        server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        print(f"http://127.0.0.1:{args.port}/  (ctrl-c to stop)", flush=True)
        seen = watched(md)
        try:
            while True:
                time.sleep(0.4)
                now = watched(md)
                if now != seen:
                    seen = now
                    bake(md, out)
        except KeyboardInterrupt:
            server.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
