#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
R13_ROOT="$(cd "$HERE/.." && pwd)"
PALAU_WORLD="$(cd "$R13_ROOT/.." && pwd)"
R04="$PALAU_WORLD/airai-r04"
RESULTS="$R04/results-r01"
SCRIPTS="$R04/scripts"

# R02: rebuild 25 m depth, uncertainty, nearest-evidence and relative-quality grids.
python "$SCRIPTS/postprocess_enc_quality_r02.py" --results "$RESULTS"

# R08: add Allen/OSM semantic companion evidence without changing depth.
python "$SCRIPTS/postprocess_reef_zones_r08.py" --results "$RESULTS"

# R09: the raw NOAA ENC ZIPs are not in the handoff branch. Recreate only the
# missing GeoTIFF aliases from R02 after validating the frozen canonical R09
# report and joined soundings. No numeric datum conversion is allowed.
python "$HERE/rebind_verified_r09.py" --results "$RESULTS"

# R10/R11: uncertainty/provenance conditioning only; depth values remain unchanged.
python "$SCRIPTS/postprocess_evidence_conditioned_r10.py" --results "$RESULTS"
python "$SCRIPTS/postprocess_enc_depare_r11.py" --results "$RESULTS"

# Build browser payload from the preferred R11 package. The output is a generated
# source artifact and must retain CANDIDATE_NOT_SURVEY_TRUTH status.
python "$HERE/build_runtime_evidence_r13.py" --root "$R13_ROOT" --results "$RESULTS"

printf 'R13 evidence pipeline completed.\n'
