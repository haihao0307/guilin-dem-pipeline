#!/usr/bin/env bash
set -euo pipefail
probe_dir="$(cd "$(dirname "$0")" && pwd)"
out_dir="${1:-$probe_dir/.gaussian-position-r45-out}"
mkdir -p "$out_dir"
g++ -std=c++17 -O0 "$probe_dir/gaussian_position_projection_r45.cc" -o "$out_dir/probe-o0"
g++ -std=c++17 -O2 "$probe_dir/gaussian_position_projection_r45.cc" -o "$out_dir/probe-o2"
"$out_dir/probe-o0" > "$out_dir/result-o0.json"
"$out_dir/probe-o2" > "$out_dir/result-o2.json"
cmp "$out_dir/result-o0.json" "$out_dir/result-o2.json"
sed -n '1,240p' "$out_dir/result-o2.json"
