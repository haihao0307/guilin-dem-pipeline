#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
node "$HERE/emit-shader-inputs.mjs"
node "$HERE/qa/emit-probes.mjs"
node --test "$HERE"/qa/*.test.mjs
COMPILER="$HERE/../kowloon-train88-r01/compiler"
(cd "$COMPILER" && cargo build --release --locked)
for pair in 'step stepRays' 'glass transmitGlass' 'normal recordGeometry' 'matter recordMatter' 'geometry-probe geometryProbe' 'material-probe materialProbe'; do
  read -r stage entry <<< "$pair"
  "$COMPILER/target/release/kaopu-station-shader-bridge" "$HERE/generated/$stage.wgsl" "$HERE/generated/$stage.frag" "$entry"
done
