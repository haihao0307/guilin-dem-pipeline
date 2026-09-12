#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
node "$root/PROBES/gaussian_reference_compositor_r47.mjs" > "$root/PROBES/gaussian_reference_compositor_result_r47.json"
node "$root/ADAPTERS/gaussian_reference_compositor_gate_r47.mjs" < "$root/PROBES/gaussian_reference_compositor_result_r47.json"
