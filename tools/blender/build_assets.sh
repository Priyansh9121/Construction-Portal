#!/usr/bin/env bash
#
# Build every authored asset, end to end, reproducibly.
#
#   BLENDER  ->  GLB  ->  gltf-transform  ->  frontend/public/world/assets/
#
# One command, no manual export settings, no clicking. Re-running it from a
# clean checkout must produce the same assets, which is the whole reason the
# modelling lives in scripts rather than in .blend files.
#
# Usage:
#   tools/blender/build_assets.sh            build and optimise
#   tools/blender/build_assets.sh --raw      build only, skip optimisation
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
ASSETS="$ROOT/frontend/public/world/assets"
OPTIMISE=1
[[ "${1:-}" == "--raw" ]] && OPTIMISE=0

if [[ ! -x "$BLENDER" ]]; then
  echo "Blender not found at $BLENDER. Set BLENDER=/path/to/blender." >&2
  exit 1
fi

echo "Blender: $("$BLENDER" --version | head -1)"
echo

# --- Author -----------------------------------------------------------------
for script in cabin hoist light_tower worker; do
  "$BLENDER" -b -P "$ROOT/tools/blender/asset_$script.py" 2>&1 \
    | grep -E '^OK|^AssertionError|Error:' || {
      echo "FAILED: asset_$script.py" >&2; exit 1; }
done

# The SITE itself, exported from the winning concept scene in production
# layers. Same geometry source as the concept renders -- the production world
# is not a second, hand-maintained copy of it.
"$BLENDER" -b -P "$ROOT/tools/blender/concept_c.py" -- --export 2>&1 \
  | grep -E '^OK|^AssertionError|Error:' || {
    echo "FAILED: concept_c.py --export" >&2; exit 1; }

# --- Optimise ---------------------------------------------------------------
#
# The narrow `meshopt` command, NOT `optimize`.
#
# `optimize` runs a whole pipeline -- instancing, material palettes, flatten,
# join, weld, simplify -- and reached 82 kB against this command's 101 kB. The
# extra 19 kB is not worth restructuring the scene graph these assets are
# placed through, and `simplify` in particular would eat exactly the bevels
# and silhouettes the assets exist to provide.
#
# There are also no image textures to compress: every material here is PBR
# factors only, and the world's surface detail comes from the procedural
# triplanar library instead. Running a KTX2 step over an asset with no images
# would report success and do nothing.
#
# Meshopt needs a decoder at runtime; three ships one, and the loader wires it
# up. If that ever stops being true, build with --raw and the GLBs still load.
#
# NOTE: meshopt quantises positions to normalized integers. Anything that
# transforms these geometries must widen them to float FIRST -- see
# dequantize() in frontend/src/world/assets.js, which exists because writing
# transformed floats back into an Int16 buffer silently flattened the cabins
# while every measurable number stayed correct.
if [[ $OPTIMISE -eq 1 ]]; then
  echo
  command -v npx >/dev/null || { echo "npx not found; use --raw" >&2; exit 1; }
  total_before=0
  total_after=0
  for a in cabin hoist light-tower worker \
           login-site-architecture login-site-neighbours \
           login-site-scaffold login-site-street; do
    before=$(stat -f%z "$ASSETS/$a.glb")
    npx --yes @gltf-transform/cli meshopt \
      "$ASSETS/$a.glb" "$ASSETS/$a.glb" --level medium >/dev/null 2>&1
    after=$(stat -f%z "$ASSETS/$a.glb")
    total_before=$((total_before + before))
    total_after=$((total_after + after))
    printf '  %-12s %7d -> %7d bytes  (%d%%)\n' \
      "$a" "$before" "$after" $((100 - after * 100 / before))
  done
  printf '  %-12s %7d -> %7d bytes  (%d%%)\n' \
    "TOTAL" "$total_before" "$total_after" \
    $((100 - total_after * 100 / total_before))
fi

echo
echo "assets in $ASSETS"
