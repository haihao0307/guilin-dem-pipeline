#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
python3 "$root/gaussian_float_target_r49.py"
