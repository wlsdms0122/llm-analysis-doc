#!/usr/bin/env bash
# Bakes the example document and inspects the result.
#
#   open-package verify
#
# Writing down what success looks like leaves a person to read it and decide every time.
# The judgement goes here instead.
set -euo pipefail

cd "$(dirname "$0")/.."

out=$(mktemp -t analysis-doc-verify.XXXXXX).html
trap 'rm -f "$out"' EXIT

python3 source/build.py document/EXAMPLE.md -o "$out" >/dev/null

bytes=$(wc -c <"$out" | tr -d ' ')
mb=$((bytes / 1048576))

# 1) Size. Inlined vendor puts this over 3MB. Anything smaller means only the shell was baked.
if [ "$bytes" -lt 3000000 ]; then
  echo "failed: output is only ${bytes} B. vendor was not inlined." >&2
  exit 1
fi

# 2) No external requests. One left behind and the page renders differently offline.
if grep -Eqo '(src|href)="https?://' "$out"; then
  echo "failed: tags pointing at external resources are still there. this is not self contained." >&2
  grep -Eo '(src|href)="https?://[^"]*"' "$out" | sort -u | head >&2
  exit 1
fi

# 3) Placeholders. One left means the shell was only half assembled.
if grep -qE '\{\{[A-Z_]+\}\}' "$out"; then
  echo "failed: unsubstituted placeholders are still there." >&2
  grep -oE '\{\{[A-Z_]+\}\}' "$out" | sort -u >&2
  exit 1
fi

echo "ok  EXAMPLE.md -> ${mb}MB single HTML, no external requests, no placeholders"
