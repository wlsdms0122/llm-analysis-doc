#!/usr/bin/env bash
# Fetches the vendor assets. They are 3.2MB of minified bundles, so the repository holds
# this script instead of the files.
#
#   open-package setup
#
# Versions are pinned and checked against sha256. A mismatch fails and leaves nothing
# behind. The shell inlines both files whole, so different bytes would change every
# document baked afterwards without saying so.
set -euo pipefail

# Resolved from this file's own location, so the assets land in the same place whatever
# directory the call came from.
cd "$(dirname "$0")"
mkdir -p vendor && cd vendor

# name|version|url path|sha256
ASSETS=(
  "marked.min.js|12.0.2|marked@12.0.2/marked.min.js|15fabce5b65898b32b03f5ed25e9f891a729ad4c0d6d877110a7744aa847a894"
  "mermaid.min.js|10.9.1|mermaid@10.9.1/dist/mermaid.min.js|61b335a46df05a7ce1c98378f60e5f3e77a7fb608a1056997e8a649304a936d6"
)

# A corporate network may block the public registries outright. A mirror goes here.
BASES=(
  "${ADOC_VENDOR_BASE:-}"
  "https://cdn.jsdelivr.net/npm"
  "https://unpkg.com"
)

sha() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1 || sha256sum "$1" | cut -d' ' -f1; }

for a in "${ASSETS[@]}"; do
  IFS='|' read -r name ver path want <<<"$a"

  if [ -f "$name" ] && [ "$(sha "$name")" = "$want" ]; then
    echo "$name ($ver) already here, skipping"
    continue
  fi

  got=""
  for base in "${BASES[@]}"; do
    [ -z "$base" ] && continue
    tmp="$(mktemp)"
    if curl -fsSL --max-time 60 "$base/$path" -o "$tmp" && [ "$(sha "$tmp")" = "$want" ]; then
      mv "$tmp" "$name"; got="$base"; break
    fi
    rm -f "$tmp"
  done

  if [ -z "$got" ]; then
    echo "failed: $name ($ver). no source returned a file matching the hash." >&2
    echo "  if the network blocks them, pass a mirror as ADOC_VENDOR_BASE." >&2
    exit 1
  fi
  echo "$name ($ver) ← $got"
done

echo "vendor ready."
