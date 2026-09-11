#!/usr/bin/env bash
set -euo pipefail

: "${SPZ_ROOT:?Set SPZ_ROOT to nianticlabs/spz commit affd0ecea7fbb4c265ee119475af7ee5b2997482}"
: "${THREE_R186_ROOT:?Set THREE_R186_ROOT to mrdoob/three.js commit 148ef33ecb6d2502ff796d4554abd1549c95d519}"

probe_dir="$(cd "$(dirname "$0")" && pwd)"
out_dir="${1:-$probe_dir/.gaussian-spz-r34-out}"
mkdir -p "$out_dir"

g++ -std=c++17 -O2 \
  -I "$probe_dir/gaussian_spz_r34_support" \
  -I "$SPZ_ROOT/src/cc" \
  "$probe_dir/gaussian_spz_three_interop_r34.cc" \
  "$SPZ_ROOT/src/cc/load-spz.cc" \
  "$SPZ_ROOT/src/cc/splat-c-types.cc" \
  "$SPZ_ROOT/src/cc/splat-types.cc" \
  -lz -Wl,-l:libzstd.so.1 \
  -o "$out_dir/gaussian_spz_three_interop_r34"

"$out_dir/gaussian_spz_three_interop_r34" \
  "$out_dir/fixture.spz" "$out_dir/negative.spz" \
  | tee "$out_dir/niantic-full.log" | tail -1 > "$out_dir/niantic.json"

THREE_R186_ROOT="$THREE_R186_ROOT" node \
  "$probe_dir/gaussian_spz_three_interop_r34.mjs" \
  "$out_dir/fixture.spz" "$out_dir/niantic.json" "$out_dir/negative.spz" \
  | tee "$out_dir/result.json"
