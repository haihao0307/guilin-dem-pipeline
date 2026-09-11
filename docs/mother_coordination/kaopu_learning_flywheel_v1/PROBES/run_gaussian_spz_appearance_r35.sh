#!/usr/bin/env bash
set -euo pipefail

: "${SPZ_ROOT:?Set SPZ_ROOT to nianticlabs/spz commit affd0ecea7fbb4c265ee119475af7ee5b2997482}"
: "${THREE_R186_ROOT:?Set THREE_R186_ROOT to mrdoob/three.js commit 148ef33ecb6d2502ff796d4554abd1549c95d519}"

probe_dir="$(cd "$(dirname "$0")" && pwd)"
out_dir="${1:-$probe_dir/.gaussian-spz-r35-out}"
mkdir -p "$out_dir"

g++ -std=c++17 -O2 \
  -I "$probe_dir/gaussian_spz_r34_support" \
  -I "$SPZ_ROOT/src/cc" \
  "$probe_dir/gaussian_spz_appearance_r35.cc" \
  "$SPZ_ROOT/src/cc/load-spz.cc" \
  "$SPZ_ROOT/src/cc/splat-c-types.cc" \
  "$SPZ_ROOT/src/cc/splat-types.cc" \
  -lz -Wl,-l:libzstd.so.1 \
  -o "$out_dir/gaussian_spz_appearance_r35"

"$out_dir/gaussian_spz_appearance_r35" "$out_dir/appearance.spz" \
  | tee "$out_dir/packer-full.log" | tail -1 > "$out_dir/packer.json"

THREE_R186_ROOT="$THREE_R186_ROOT" node \
  "$probe_dir/gaussian_spz_appearance_r35.mjs" \
  "$out_dir/appearance.spz" "$out_dir/packer.json" \
  | tee "$out_dir/result.json"
