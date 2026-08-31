#!/usr/bin/env bash
# Bakes documents and inspects the results.
#
#   open-package verify
#
# Writing down what success looks like leaves a person to read it and decide every time.
# The judgement goes here instead.
set -euo pipefail

cd "$(dirname "$0")/.."

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

out="$work/example.html"
python3 source/build.py document/EXAMPLE.md -o "$out" >/dev/null

bytes=$(wc -c <"$out" | tr -d ' ')

# 1) mermaid is in there. EXAMPLE.md draws flowcharts and a sequence diagram, and the
#    modules for those come to several hundred kilobytes.
if [ "$bytes" -lt 400000 ]; then
  echo "failed: output is only ${bytes} B. mermaid was not inlined." >&2
  exit 1
fi

# 2) Only the diagram types the document draws. Every type together is several megabytes,
#    so a result that large means the document was baked with the whole of mermaid.
if [ "$bytes" -gt 2000000 ]; then
  echo "failed: output is ${bytes} B. the whole of mermaid went in, not the modules EXAMPLE.md needs." >&2
  exit 1
fi

# 3) No external requests. One left behind and the page renders differently offline.
if grep -Eqo '(src|href)="https?://' "$out"; then
  echo "failed: tags pointing at external resources are still there. this is not self contained." >&2
  grep -Eo '(src|href)="https?://[^"]*"' "$out" | sort -u | head >&2
  exit 1
fi

# 4) Placeholders. One left means the shell was only half assembled.
if grep -qE '\{\{[A-Z_]+\}\}' "$out"; then
  echo "failed: unsubstituted placeholders are still there." >&2
  grep -oE '\{\{[A-Z_]+\}\}' "$out" | sort -u >&2
  exit 1
fi

# 5) A document with no diagram carries no mermaid at all. This is what makes such a
#    document a fifth of the size, so it is worth holding to.
plain="$work/plain.md"
printf '# Plain\n\nProse only.\n' >"$plain"
python3 source/build.py "$plain" -o "$work/plain.html" >/dev/null
plain_bytes=$(wc -c <"$work/plain.html" | tr -d ' ')
if [ "$plain_bytes" -gt 300000 ]; then
  echo "failed: a document with no diagram came to ${plain_bytes} B. mermaid went in anyway." >&2
  exit 1
fi

# 6) A diagram type the build does not recognise falls back to the whole of mermaid rather
#    than to a document that cannot draw it. The bundle is 3.4MB, and the modules for every
#    type put together are 4.8MB, so the size says which of the two went in.
future="$work/future.md"
printf '# Future\n\n```mermaid\nfutureDiagram\n  a --> b\n```\n' >"$future"
python3 source/build.py "$future" -o "$work/future.html" >/dev/null
future_bytes=$(wc -c <"$work/future.html" | tr -d ' ')
if [ "$future_bytes" -lt 3000000 ]; then
  echo "failed: an unrecognised diagram type came to ${future_bytes} B. it was left out instead of falling back." >&2
  exit 1
fi
if [ "$future_bytes" -gt 4000000 ]; then
  echo "failed: the fallback came to ${future_bytes} B. the modules were assembled instead of using the bundle." >&2
  exit 1
fi

mb=$(echo "$bytes" | awk '{printf "%.1f", $1/1048576}')
plain_kb=$((plain_bytes / 1024))
echo "ok  EXAMPLE.md -> ${mb}MB, no diagram -> ${plain_kb}KB, no external requests, no placeholders"
