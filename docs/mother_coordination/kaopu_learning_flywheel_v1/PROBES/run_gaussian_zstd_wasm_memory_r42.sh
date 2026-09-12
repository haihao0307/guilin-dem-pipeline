#!/usr/bin/env bash
set -euo pipefail

: "${THREE_R186_ROOT:?Set THREE_R186_ROOT to mrdoob/three.js commit 148ef33ecb6d2502ff796d4554abd1549c95d519}"

probe_dir="$(cd "$(dirname "$0")" && pwd)"
out_dir="${1:-$probe_dir/.gaussian-zstd-r42-out}"
mkdir -p "$out_dir"

g++ -std=c++17 -O2 -I "$probe_dir/gaussian_spz_r34_support" "$probe_dir/gaussian_zstd_stream_fixture_r42.cc" -Wl,-l:libzstd.so.1 -o "$out_dir/gaussian_zstd_stream_fixture_r42"
"$out_dir/gaussian_zstd_stream_fixture_r42" "$out_dir/small-varied.zst" 1048576 varied >/dev/null
"$out_dir/gaussian_zstd_stream_fixture_r42" "$out_dir/large-zero.zst" 25165824 zero >/dev/null
"$out_dir/gaussian_zstd_stream_fixture_r42" "$out_dir/large-varied.zst" 25165824 varied >/dev/null

THREE_R186_ROOT="$THREE_R186_ROOT" node "$probe_dir/gaussian_zstd_wasm_memory_r42.mjs" "$out_dir"
