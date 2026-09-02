#!/usr/bin/env bash
# Fetches the vendor assets.
#
#   open-package setup
#
# marked arrives as one minified file. mermaid arrives as the npm tarball, because the
# build picks single modules out of `dist/` rather than inlining one whole bundle.
#
# Both are pinned and checked against sha256. A mismatch fails and leaves nothing behind.
# The bytes fetched here end up inside every document baked afterwards, so different bytes
# would change those documents without saying so.
set -euo pipefail

# Resolved from this file's own location, so the assets land in the same place whatever
# directory the call came from.
cd "$(dirname "$0")"
mkdir -p vendor && cd vendor

MARKED_VERSION=12.0.2
MARKED_SHA=15fabce5b65898b32b03f5ed25e9f891a729ad4c0d6d877110a7744aa847a894

MERMAID_VERSION=11.17.2
MERMAID_SHA=6ad2f42c3fc26bbf9e45cbb6d11898972573ea52b33a5f4ff51952899f950ffd

# A corporate network may block the public registries outright. A mirror goes here.
CDN_BASES=(
  "${ADOC_VENDOR_BASE:-}"
  "https://cdn.jsdelivr.net/npm"
  "https://unpkg.com"
)
REGISTRY="${ADOC_VENDOR_REGISTRY:-https://registry.npmjs.org}"

sha() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1 || sha256sum "$1" | cut -d' ' -f1; }

# Downloads into a temporary file and only names it once the hash matches, so a partial or
# wrong body never becomes the asset.
fetch() {
  local want="$1" out="$2" tmp
  shift 2
  for url in "$@"; do
    [ -z "$url" ] && continue
    tmp="$(mktemp)"
    if curl -fsSL --max-time 120 "$url" -o "$tmp" && [ "$(sha "$tmp")" = "$want" ]; then
      mv "$tmp" "$out"
      echo "$url"
      return 0
    fi
    rm -f "$tmp"
  done
  return 1
}

# ---------------------------------------------------------------- marked

if [ -f marked.min.js ] && [ "$(sha marked.min.js)" = "$MARKED_SHA" ]; then
  echo "marked.min.js ($MARKED_VERSION) already here, skipping"
else
  urls=()
  for base in "${CDN_BASES[@]}"; do
    [ -n "$base" ] && urls+=("$base/marked@$MARKED_VERSION/marked.min.js")
  done
  if got=$(fetch "$MARKED_SHA" marked.min.js "${urls[@]}"); then
    echo "marked.min.js ($MARKED_VERSION) <- $got"
  else
    echo "failed: marked $MARKED_VERSION. no source returned a file matching the hash." >&2
    echo "  if the network blocks them, pass a mirror as ADOC_VENDOR_BASE." >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------- mermaid

# The stamp holds the hash of the tarball the current directory was extracted from, so a
# version bump here re-extracts instead of leaving the old modules in place.
if [ -f mermaid/.tarball-sha256 ] && [ "$(cat mermaid/.tarball-sha256)" = "$MERMAID_SHA" ]; then
  echo "mermaid ($MERMAID_VERSION) already here, skipping"
else
  tgz="$(mktemp)"
  trap 'rm -f "$tgz"' EXIT
  if got=$(fetch "$MERMAID_SHA" "$tgz" "$REGISTRY/mermaid/-/mermaid-$MERMAID_VERSION.tgz"); then
    rm -rf mermaid && mkdir mermaid
    # The published tarball puts everything under `package/`. Three of the builds in there
    # draw the same diagrams, so only the minified ESM one and the UMD bundle are kept: the
    # entry module, the chunks it imports, and `mermaid.min.js` for the fallback.
    tar xzf "$tgz" -C mermaid --strip-components=2 \
      package/dist/mermaid.esm.min.mjs \
      package/dist/mermaid.min.js \
      package/dist/chunks/mermaid.esm.min
    # Source maps are half the weight of what was just extracted and nothing reads them.
    find mermaid -name '*.map' -delete
    echo "$MERMAID_SHA" > mermaid/.tarball-sha256
    echo "mermaid ($MERMAID_VERSION) <- $got  ($(find mermaid -name '*.mjs' | wc -l | tr -d ' ') modules)"
  else
    echo "failed: mermaid $MERMAID_VERSION. the registry returned nothing matching the hash." >&2
    echo "  if the network blocks it, pass a mirror as ADOC_VENDOR_REGISTRY." >&2
    exit 1
  fi
fi

echo "vendor ready."
