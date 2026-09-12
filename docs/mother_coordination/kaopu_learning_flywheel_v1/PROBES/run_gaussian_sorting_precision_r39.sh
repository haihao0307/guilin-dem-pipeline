#!/usr/bin/env bash
set -euo pipefail

: "${THREE_R186_ROOT:?Set THREE_R186_ROOT to mrdoob/three.js commit 148ef33ecb6d2502ff796d4554abd1549c95d519}"

probe_dir="$(cd "$(dirname "$0")" && pwd)"
THREE_R186_ROOT="$THREE_R186_ROOT" node "$probe_dir/gaussian_sorting_precision_r39.mjs"
