#!/usr/bin/env python3
"""Bakes the catalog of ui-* classes and icons (document/CATALOG.md) in a preset.

    open-package catalog <out.html> [--ui-theme default|ios|material|toss]
"""

import argparse
import pathlib
import re
import sys
import tempfile

import build

HERE = pathlib.Path(__file__).resolve().parent
CATALOG = HERE.parent / "document" / "CATALOG.md"
PRESETS = ["default", "ios", "material", "toss"]


def main() -> int:
    ap = argparse.ArgumentParser(description="bake the ui class catalog")
    ap.add_argument("out", type=pathlib.Path)
    ap.add_argument("--ui-theme", choices=PRESETS, default="default")
    args = ap.parse_args()

    src = CATALOG.read_text(encoding="utf-8")
    src = re.sub(r"^---\n", f"---\nui-theme: {args.ui_theme}\n", src, count=1)
    with tempfile.TemporaryDirectory() as work:
        md = pathlib.Path(work) / "CATALOG.md"
        md.write_text(src, encoding="utf-8")
        out, _ = build.build(md, args.out.resolve())
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
