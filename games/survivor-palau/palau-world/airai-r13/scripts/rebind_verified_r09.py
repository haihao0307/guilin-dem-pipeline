#!/usr/bin/env python3
"""Recreate missing R09 GeoTIFF aliases from R02 using the frozen R09 S-57 datum report.

This script does not invent or re-read raw ENC metadata. It requires the canonical
R09 report to show one resolved datum for the candidate-constraint cell, verifies
the joined sounding vector, copies numeric arrays bit-for-bit, and writes only
provenance tags.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()
    results = args.results.resolve()
    grids = results / "grids"
    vectors = results / "vectors"

    report_path = results / "ENC_SOUNDING_DATUM_R09.json"
    joined_path = vectors / "SOUNDG_DATUM_JOINED_R09.geojson"
    if not report_path.exists() or not joined_path.exists():
        raise SystemExit("verified R09 report or joined soundings missing")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("candidateConstraintDatumStatus") != "UNIFORM_RESOLVED":
        raise SystemExit("R09 candidate datum is not uniformly resolved")

    code = report.get("candidateConstraintDatumCode")
    name = report.get("candidateConstraintDatumName")
    cells = (report.get("coreSourceCells") or {}).get("candidateConstraintCells") or []
    if code != 24 or name != "local datum" or cells != ["US4TB3P0"]:
        raise SystemExit(
            f"unexpected frozen R09 identity: code={code!r} name={name!r} cells={cells!r}"
        )

    soundings = gpd.read_file(joined_path)
    soundings = soundings.set_crs(4326) if soundings.crs is None else soundings.to_crs(4326)
    core = soundings.cx[134.535:134.605, 7.315:7.385]
    resolved = int(core.get("sdat_code").notna().sum()) if "sdat_code" in core else 0
    code_counts = (
        {
            str(int(k)): int(v)
            for k, v in core.get("sdat_code").dropna().astype(int).value_counts().items()
        }
        if "sdat_code" in core
        else {}
    )
    if len(core) != 392 or resolved != 392 or code_counts != {"24": 392}:
        raise SystemExit(
            f"joined sounding identity mismatch: core={len(core)} "
            f"resolved={resolved} codes={code_counts}"
        )

    mapping = {
        "candidate_depth_chart_datum_m_r02.tif": "candidate_depth_chart_datum_m_r09.tif",
        "candidate_uncertainty_m_r02.tif": "candidate_uncertainty_m_r09.tif",
        "nearest_evidence_distance_m_r02.tif": "nearest_evidence_distance_m_r09.tif",
        "candidate_source_quality_weight_r02.tif": "candidate_source_quality_weight_r09.tif",
    }
    products = {}
    for src_name, dst_name in mapping.items():
        src = grids / src_name
        dst = grids / dst_name
        if not src.exists():
            raise SystemExit(f"missing R02 source {src}")
        shutil.copy2(src, dst)
        with rasterio.open(src) as source_ds, rasterio.open(dst, "r+") as output_ds:
            source_array = source_ds.read(1)
            output_array = output_ds.read(1)
            if not np.array_equal(source_array, output_array, equal_nan=True):
                raise SystemExit(f"numeric array changed during R09 copy: {src_name}")
            output_ds.update_tags(
                WORLD_STATUS="CANDIDATE_NOT_SURVEY_TRUTH",
                SOUNDING_DATUM_CODE=str(code),
                SOUNDING_DATUM_NAME=name,
                SOUNDING_DATUM_SOURCE=(
                    "Frozen canonical R09 S-57 DSPM SDAT report; M_SDAT override count 0"
                ),
                DATUM_NUMERIC_TRANSFORM="NONE",
                MSL_EQUIVALENCE="NOT_ASSERTED",
                CORE_SOURCE_CELLS=",".join(cells),
                R13_RECONSTRUCTION=(
                    "Recreated from R02 numeric array because original R09 TIFF binary "
                    "was absent from the R11 archive"
                ),
            )
        products[dst_name] = {
            "source": src_name,
            "sourceSha256": sha256(src),
            "outputSha256": sha256(dst),
            "numericArrayChanged": False,
        }

    receipt = {
        "schema": "kaopu.palau.r13-r09-grid-reconstruction/1.0",
        "datum": {
            "code": code,
            "name": name,
            "sourceCells": cells,
            "mslEquivalence": "NOT_ASSERTED",
        },
        "joinedSoundings": {
            "coreCount": len(core),
            "resolvedCount": resolved,
            "datumCodeCounts": code_counts,
            "sha256": sha256(joined_path),
        },
        "products": products,
        "status": "R09_PROVENANCE_RESTORED_NUMERIC_VALUES_UNCHANGED",
        "visualAcceptance": False,
        "productionReady": False,
    }
    output_path = results / "R09_GRID_RECONSTRUCTION_R13.json"
    output_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
