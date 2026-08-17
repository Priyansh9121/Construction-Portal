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
#   tools/blender/build_assets.sh --skip-gate  build, but do not enforce bytes
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
ASSETS="$ROOT/frontend/public/world/assets"
OPTIMISE=1
GATE=1
for arg in "$@"; do
  case "$arg" in
    --raw)        OPTIMISE=0 ;;
    --skip-gate)  GATE=0 ;;
  esac
done

# --raw skips compression, so the gate would be measuring the uncompressed
# figures against limits set for the shipped ones. Failing there would say
# nothing about what users receive.
[[ $OPTIMISE -eq 0 ]] && GATE=0

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
  # login-site-people was absent from this list until 2026-08-17, so a clean
  # build compressed every layer except that one. The shipped people.glb does
  # carry EXT_meshopt_compression, from some earlier invocation -- which is
  # exactly why the gap survived: the artifact looked right.
  for a in cabin hoist light-tower worker \
           login-site-architecture login-site-neighbours \
           login-site-people login-site-scaffold login-site-street; do
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

# --- Byte gate --------------------------------------------------------------
#
# Deliberately NOT in validate(). That function asserts CORRECTNESS -- 2 mm off
# the ground plane is a defect, and a defect is not a matter of degree. A size
# limit is a BUDGET: it is a choice about what the product can afford to send
# over a field worker's connection, it changes when that choice changes, and
# mixing the two would mean a budget revision showing up as a correctness
# regression.
#
# It runs HERE, at the end, rather than after the Blender export, because the
# meshopt step above sits between the two and the only number that matters is
# the one that lands in $ASSETS. Blender writes 5.77 MB; what ships is 2.01 MB.
# Gating the Blender figure would fail on bytes no user ever receives.
#
# Numbers, agreed 2026-08-17 and measured rather than guessed:
#
#   per layer, hard fail       2.0 MB   largest shipped layer is 0.78 MB
#   whole set, hard fail       2.5 MB   shipped set measures 2.01 MB (-66%)
#   whole set, warn            1.2 MB   the aspiration, currently 2.01 MB
#
# 2.5 MB is ~24% headroom over the measured 2.01 MB: loose enough that a
# legitimate addition does not trip it, tight enough that a doubling does. It
# is deliberately NOT set at the 1.2 MB aspiration -- a hard limit the build
# cannot currently meet is a limit that gets bypassed within a week, and then
# there is no gate at all.
#
# The warn fires today, on purpose. The set is roughly twice the ~0.99 MB it
# ought to be, and a budget line that only appears once it is already breached
# is a budget nobody was keeping. A warn does not fail the build.
#
# --skip-gate bypasses it.
LAYER_LIMIT=$((2 * 1024 * 1024))
SET_LIMIT=$(( (5 * 1024 * 1024) / 2 ))   # 2.5 MB, post-compression
SET_WARN=$((1228800))

if [[ $GATE -eq 1 ]]; then
  echo
  echo "byte gate"
  gate_total=0
  gate_failed=0
  for f in "$ASSETS"/login-site-*.glb; do
    [[ -e "$f" ]] || continue
    sz=$(stat -f%z "$f")
    gate_total=$((gate_total + sz))
    if (( sz > LAYER_LIMIT )); then
      printf '  FAIL  %-32s %8d bytes  (limit %d)\n' \
        "$(basename "$f")" "$sz" "$LAYER_LIMIT"
      gate_failed=1
    else
      printf '  ok    %-32s %8d bytes\n' "$(basename "$f")" "$sz"
    fi
  done

  printf '  ----  %-32s %8d bytes\n' "TOTAL" "$gate_total"

  if (( gate_total > SET_LIMIT )); then
    printf '  FAIL  whole set %d bytes exceeds %d\n' "$gate_total" "$SET_LIMIT"
    gate_failed=1
  elif (( gate_total > SET_WARN )); then
    printf '  WARN  whole set %d bytes is over the %d target (not a failure)\n' \
      "$gate_total" "$SET_WARN"
  fi

  if (( gate_failed == 1 )); then
    echo "byte gate FAILED -- something got bigger. Do not ship this." >&2
    exit 1
  fi
  echo "  byte gate passed"
fi

echo
echo "assets in $ASSETS"
