#!/usr/bin/env bash
set -euo pipefail
probe_dir="$(cd "$(dirname "$0")" && pwd)"
out_dir="${1:-$probe_dir/.gaussian-quaternion-r43-out}"
mkdir -p "$out_dir"
g++ -std=c++17 -O0 "$probe_dir/gaussian_quaternion_quantization_r43.cc" -o "$out_dir/probe-o0"
g++ -std=c++17 -O2 "$probe_dir/gaussian_quaternion_quantization_r43.cc" -o "$out_dir/probe-o2"
"$out_dir/probe-o0" > "$out_dir/result-o0.json"
"$out_dir/probe-o2" > "$out_dir/result-o2.json"
cmp "$out_dir/result-o0.json" "$out_dir/result-o2.json"
cat "$out_dir/result-o2.json"
