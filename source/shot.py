#!/usr/bin/env python3
"""Draws a document's figures as PNG files, to look at a figure without opening the page,
and to set a drawing next to the design it was drawn from.

    open-package shot <content.md> [-o <dir>] [--theme light|dark|both] [--figure <name>]
    open-package shot <content.md> --figure <name> --compare <capture.png>

The figures are drawn by the document itself in a headless Chrome (`?shot=1`, see app.js),
so a PNG here is the same as the figure toolbar's PNG. Chrome is looked for in $CHROME, the
usual macOS locations, and on PATH.

--compare draws the one figure's drawing alone, in light, and lays it out three ways beside
the capture: the drawing, the capture at the same width, and the capture over the drawing at
half opacity.
"""

import argparse
import base64
import html
import json
import os
import pathlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile

import build

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"]


def chrome() -> str:
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    for n in CHROME_NAMES:
        found = shutil.which(n)
        if found:
            return found
    raise SystemExit("no Chrome found. install it or set CHROME to its executable.")


def headless(*args: str) -> str:
    out = subprocess.run(
        [chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--no-default-browser-check", "--allow-file-access-from-files", *args],
        capture_output=True, text=True, timeout=180,
    )
    return out.stdout


def shoot(page: pathlib.Path, themes: list[str], figure: str | None, part: str) -> list[dict]:
    query = {"shot": "1", "themes": ",".join(themes)}
    if figure:
        query["figure"] = figure
    if part:
        query["part"] = part
    url = page.as_uri() + "?" + "&".join(f"{k}={_quote(v)}" for k, v in query.items())
    dom = headless("--window-size=1440,1000", "--virtual-time-budget=60000", "--dump-dom", url)
    # The element is appended last. The shell's own script mentions its name earlier in the page.
    found = re.findall(r'<pre id="adoc-shots">(\{.*?)</pre>', dom, re.S)
    if not found:
        raise SystemExit("the page did not hand back its figures. is this an analysis-doc document?")
    result = json.loads(html.unescape(found[-1]))
    if result.get("error"):
        raise SystemExit(result["error"])
    return result["shots"]


def _quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


def png_bytes(data_url: str) -> bytes:
    return base64.b64decode(data_url.split(",", 1)[1])


def image_size(data: bytes) -> tuple[int, int]:
    """Width and height of a PNG or JPEG, read from its header."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data):
            marker, length = data[i + 1], struct.unpack(">H", data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            i += 2 + length
    raise SystemExit("the capture is not a PNG or JPEG.")


def compare(drawing: bytes, capture_path: pathlib.Path, out: pathlib.Path) -> None:
    capture = capture_path.read_bytes()
    dw, dh = image_size(drawing)
    cw, ch = image_size(capture)
    # The drawing PNG is at twice its CSS size. Everything is laid out at that CSS width.
    w = dw // 2
    h = max(dh // 2, round(ch * w / cw))
    mime = "image/jpeg" if capture[:2] == b"\xff\xd8" else "image/png"
    d_url = "data:image/png;base64," + base64.b64encode(drawing).decode()
    c_url = f"data:{mime};base64," + base64.b64encode(capture).decode()
    gap, label = 24, 28
    page = f"""<!doctype html><meta charset="utf-8"><style>
      body {{ margin: 0; background: #f0eee9; font: 600 12px/1 ui-monospace, Menlo, monospace; color: #6b6b66; }}
      .row {{ display: flex; gap: {gap}px; padding: {gap}px; }}
      .col {{ width: {w}px; }} .col p {{ margin: 0 0 12px; height: {label - 12}px; }}
      .col img {{ width: {w}px; display: block; }} .stack {{ position: relative; }}
      .stack img + img {{ position: absolute; left: 0; top: 0; opacity: .5; }}
    </style><div class="row">
      <div class="col"><p>DRAWING</p><img src="{d_url}"></div>
      <div class="col"><p>CAPTURE</p><img src="{c_url}"></div>
      <div class="col"><p>CAPTURE OVER DRAWING, 50%</p><div class="stack"><img src="{d_url}"><img src="{c_url}"></div></div>
    </div>"""
    with tempfile.TemporaryDirectory() as work:
        html_path = pathlib.Path(work) / "compare.html"
        html_path.write_text(page, encoding="utf-8")
        size = f"{w * 3 + gap * 4},{h + label + gap * 2}"
        headless("--force-device-scale-factor=2", f"--window-size={size}", f"--screenshot={out}", html_path.as_uri())
    if not out.exists():
        raise SystemExit("Chrome did not write the comparison.")


def main() -> int:
    ap = argparse.ArgumentParser(description="draw a document's figures as PNG files")
    ap.add_argument("markdown", type=pathlib.Path)
    ap.add_argument("-o", "--out", type=pathlib.Path, help="directory for the PNG files (default: <name>-shots next to the input)")
    ap.add_argument("--theme", choices=["light", "dark", "both"], default="both")
    ap.add_argument("--figure", help="only the figure with this caption, or this number in document order")
    ap.add_argument("--part", choices=["figure", "screen"], default="figure", help="screen: the drawing alone, without notes")
    ap.add_argument("--compare", type=pathlib.Path, metavar="CAPTURE", help="a design capture to set beside the figure's drawing")
    args = ap.parse_args()

    md = args.markdown.resolve()
    if not md.exists():
        print(f"no such input: {md}", file=sys.stderr)
        return 1
    if args.compare and not args.figure:
        print("--compare needs --figure: the one figure to set beside the capture", file=sys.stderr)
        return 1
    out_dir = (args.out or md.with_name(md.stem + "-shots")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as work:
        page = pathlib.Path(work) / (md.stem + ".html")
        build.build(md, page)
        if args.compare:
            shots = shoot(page, ["light"], args.figure, "screen")
            if not shots or not shots[0]["png"]:
                print("the figure could not be drawn", file=sys.stderr)
                return 1
            target = out_dir / f"{shots[0]['name']}-compare.png"
            compare(png_bytes(shots[0]["png"]), args.compare.resolve(), target)
            print(target)
            return 0
        themes = ["light", "dark"] if args.theme == "both" else [args.theme]
        shots = shoot(page, themes, args.figure, "screen" if args.part == "screen" else "")

    failed = 0
    for s in shots:
        if not s["png"]:
            print(f"could not draw {s['name']} ({s['theme']})", file=sys.stderr)
            failed += 1
            continue
        target = out_dir / f"{s['name']}-{s['theme']}.png"
        target.write_bytes(png_bytes(s["png"]))
        print(target)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
