#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
python3 "$root/gaussian_cutoff_boundary_r50.py"
