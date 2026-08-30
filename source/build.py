#!/usr/bin/env python3
"""Bakes one markdown file into a self contained HTML document.

    open-package build <content.md> [-o <out.html>]

The shell (layout, style, runtime) is fixed and lives in `source/`. The only thing that
changes per document is the input markdown, so every document comes out with the same
page around it.

Optional frontmatter on the input:

    ---
    title: Native signing flow
    kicker: TossBank iOS
    subtitle: 2026-08-28 draft
    slug: native-sign-flow
    ---
"""

import argparse
import base64
import html
import json
import pathlib
import re
import sys

# Resolved from this file's own location, so the same assets are picked up wherever the
# package sits and wherever the call came from.
HERE = pathlib.Path(__file__).resolve().parent


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def read_vendor(name: str) -> str:
    """vendor is not kept in the repository, so a missing file gets the next command
    rather than a stack trace."""
    p = HERE / "vendor" / name
    if not p.exists():
        raise SystemExit(f"source/vendor/{name} is missing. run 'open-package setup' first.")
    return read(p)


def parse_frontmatter(src: str) -> dict:
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?", src, re.S)
    if not m:
        return {}
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        k, _, v = line.partition(":")
        if not _:
            continue
        meta[k.strip()] = v.strip().strip("'\"")
    return meta


def slugify(s: str) -> str:
    # `\w` is already Unicode aware, so scripts other than ASCII survive this.
    s = re.sub(r"[^\w\- ]+", "", s.strip().lower())
    s = re.sub(r"\s+", "-", s).strip("-")
    return s or "analysis"


def inline_js(text: str) -> str:
    """Keeps an inline <script> from ending early."""
    return text.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def build(md_path: pathlib.Path, out_path: pathlib.Path) -> pathlib.Path:
    src = read(md_path)
    meta = parse_frontmatter(src)

    body = re.sub(r"^---\r?\n.*?\r?\n---\r?\n?", "", src, count=1, flags=re.S)
    first_h1 = re.search(r"^#\s+(.+)$", body, re.M)

    title = meta.get("title") or (first_h1.group(1).strip() if first_h1 else md_path.stem)
    kicker = meta.get("kicker", "Analysis")
    subtitle = meta.get("subtitle", "")
    slug = meta.get("slug") or slugify(title)

    shell = read(HERE / "template.html")
    # Frontmatter is user input. HTML slots are escaped and script slots go through
    # inline_js. Without it a title as ordinary as `Optional<Token>` cuts the header off,
    # and a `</script` in there kills the DOC_META assignment, which takes every
    # slug keyed store down with it.
    repl = {
        "TITLE": html.escape(title),
        "KICKER": html.escape(kicker),
        "SUBTITLE": html.escape(subtitle),
        "STYLE": read(HERE / "style.css"),
        "CONTENT_B64": base64.b64encode(src.encode("utf-8")).decode("ascii"),
        "META_JSON": inline_js(
            json.dumps(
                {"title": title, "slug": slug, "kicker": kicker, "subtitle": subtitle},
                ensure_ascii=False,
            )
        ),
        "VENDOR_MARKED": inline_js(read_vendor("marked.min.js")),
        "VENDOR_MERMAID": inline_js(read_vendor("mermaid.min.js")),
        "APP": inline_js(read(HERE / "app.js")),
    }
    # One pass. Substituting in sequence would let a `{{...}}` inside an already inserted
    # value be caught by a later round.
    out = re.sub(r"\{\{(\w+)\}\}", lambda m: repl.get(m.group(1), m.group(0)), shell)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out, encoding="utf-8")
    return out_path


def main() -> int:
    ap = argparse.ArgumentParser(description="markdown to analysis-doc HTML")
    ap.add_argument("markdown", type=pathlib.Path)
    ap.add_argument("-o", "--out", type=pathlib.Path, default=None)
    args = ap.parse_args()

    if not args.markdown.exists():
        print(f"no such input: {args.markdown}", file=sys.stderr)
        return 1

    out = args.out or args.markdown.with_suffix(".html")
    built = build(args.markdown, out)
    size = built.stat().st_size / 1024 / 1024
    print(f"{built}  ({size:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
