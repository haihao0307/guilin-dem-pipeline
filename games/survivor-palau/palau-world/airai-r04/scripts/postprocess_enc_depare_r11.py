#!/usr/bin/env python3
"""R11: reconcile the R10 candidate grid against NOAA ENC DEPARE depth-area evidence.

This stage does not clamp or otherwise alter candidate depths. DEPARE DRVAL1/DRVAL2
are official charted depth-area evidence in the same S-57 sounding datum resolved by
R09. Where an interpolated candidate falls outside the charted area range, the
discrepancy is carried into uncertainty and a support-class companion grid.

The user's 60–70 m / <100 m working hypothesis is diagnostic only and is never used
to modify DEPARE ranges or candidate depths.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import rasterize

NODATA_FLOAT = -9999.0
OPEN_BOUND = -9998.0
NODATA_CLASS = 0
NUMERIC_TOLERANCE_M = 0.05

ZONE_NAMES = {
    1: "outside_allen_geomorphic_or_unclassified",
    2: "reef_flat_or_crest",
    3: "shallow_lagoon",
    4: "deep_lagoon",
    5: "reef_slope",
    6: "plateau",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def valid_mask(arr: np.ndarray, nodata) -> np.ndarray:
    m = np.isfinite(arr)
    if nodata is not None:
        m &= arr != nodata
    return m


def stats(values) -> dict:
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a):
        return {"count": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None}
    return {
        "count": int(len(a)),
        "min": float(np.min(a)),
        "p05": float(np.percentile(a, 5)),
        "median": float(np.median(a)),
        "p95": float(np.percentile(a, 95)),
        "max": float(np.max(a)),
    }


def find_col(gdf: gpd.GeoDataFrame, name: str) -> str | None:
    upper = {str(c).upper(): c for c in gdf.columns}
    return upper.get(name.upper())


def alignment(ds: rasterio.io.DatasetReader) -> tuple:
    return (ds.width, ds.height, str(ds.crs), tuple(ds.transform))


def write_float_like(reference: Path, out: Path, arr: np.ndarray, tags: dict) -> None:
    with rasterio.open(reference) as src:
        profile = src.profile.copy()
        nodata = src.nodata if src.nodata is not None else NODATA_FLOAT
    profile.update(dtype="float32", count=1, nodata=nodata, compress="deflate", tiled=True)
    with rasterio.open(out, "w", **profile) as dst:
        dst.write(arr.astype("float32"), 1)
        dst.update_tags(**tags)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()
    results = args.results.resolve()
    grids = results / "grids"
    vectors = results / "vectors"

    depth_path = grids / "candidate_depth_chart_datum_m_r10.tif"
    unc_path = grids / "candidate_uncertainty_evidence_conditioned_m_r10.tif"
    nearest_path = grids / "nearest_evidence_distance_m_r10.tif"
    quality_path = grids / "candidate_source_quality_weight_r10.tif"
    semantic_path = grids / "candidate_semantic_zone_r08.tif"
    depare_path = vectors / "DEPARE.geojson"
    datum_path = results / "ENC_SOUNDING_DATUM_R09.json"
    required = [depth_path, unc_path, nearest_path, quality_path, semantic_path, depare_path, datum_path]
    for p in required:
        if not p.exists():
            raise SystemExit(f"R11 required input missing: {p}")

    datum = json.loads(datum_path.read_text(encoding="utf-8"))
    source_cells = list((datum.get("coreSourceCells") or {}).get("candidateConstraintCells") or [])
    datum_code = datum.get("candidateConstraintDatumCode")
    datum_name = datum.get("candidateConstraintDatumName")
    if datum.get("candidateConstraintDatumStatus") != "UNIFORM_RESOLVED":
        raise SystemExit("R11 requires one resolved S-57 sounding datum across candidate constraints")

    with rasterio.open(depth_path) as ds:
        depth = ds.read(1).astype(float)
        depth_nodata = ds.nodata
        sig = alignment(ds)
        target_crs = ds.crs
        transform = ds.transform
        shape = (ds.height, ds.width)
        depth_profile = ds.profile.copy()
    with rasterio.open(unc_path) as ds:
        if alignment(ds) != sig:
            raise SystemExit("R11 alignment failure: uncertainty grid differs from R10 depth grid")
        uncertainty = ds.read(1).astype(float)
        unc_nodata = ds.nodata
    with rasterio.open(nearest_path) as ds:
        if alignment(ds) != sig:
            raise SystemExit("R11 alignment failure: nearest grid differs from R10 depth grid")
        nearest = ds.read(1).astype(float)
        nearest_nodata = ds.nodata
    with rasterio.open(quality_path) as ds:
        if alignment(ds) != sig:
            raise SystemExit("R11 alignment failure: quality grid differs from R10 depth grid")
        quality = ds.read(1).astype(float)
        quality_nodata = ds.nodata
    with rasterio.open(semantic_path) as ds:
        if alignment(ds) != sig:
            raise SystemExit("R11 alignment failure: semantic grid differs from R10 depth grid")
        semantic = ds.read(1).astype(np.uint8)

    valid = (
        valid_mask(depth, depth_nodata)
        & valid_mask(uncertainty, unc_nodata)
        & valid_mask(nearest, nearest_nodata)
        & valid_mask(quality, quality_nodata)
    )

    depare = gpd.read_file(depare_path)
    if depare.crs is None:
        depare = depare.set_crs(4326)
    lo_col = find_col(depare, "DRVAL1")
    hi_col = find_col(depare, "DRVAL2")
    cell_col = find_col(depare, "_enc_cell")
    if lo_col is None and hi_col is None:
        raise SystemExit("R11 DEPARE has neither DRVAL1 nor DRVAL2")

    if source_cells and cell_col is not None:
        depare = depare[depare[cell_col].astype(str).isin([str(x) for x in source_cells])].copy()
    depare = depare[depare.geometry.notna() & ~depare.geometry.is_empty].copy()
    depare = depare[depare.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    if depare.empty:
        raise SystemExit("R11 has no DEPARE polygons from candidate source cells")

    depare["_lo"] = pd.to_numeric(depare[lo_col], errors="coerce") if lo_col else np.nan
    depare["_hi"] = pd.to_numeric(depare[hi_col], errors="coerce") if hi_col else np.nan
    depare["_width"] = np.where(
        np.isfinite(depare["_lo"]) & np.isfinite(depare["_hi"]),
        np.maximum(0.0, depare["_hi"] - depare["_lo"]),
        1.0e12,
    )
    depare = depare.sort_values("_width", ascending=False, kind="stable").to_crs(target_crs)

    coverage_shapes = []
    lower_shapes = []
    upper_shapes = []
    for _, row in depare.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        coverage_shapes.append((geom, 1))
        lo = float(row["_lo"]) if np.isfinite(row["_lo"]) else OPEN_BOUND
        hi = float(row["_hi"]) if np.isfinite(row["_hi"]) else OPEN_BOUND
        lower_shapes.append((geom, lo))
        upper_shapes.append((geom, hi))

    coverage = rasterize(
        coverage_shapes, out_shape=shape, transform=transform, fill=0, dtype="uint8"
    ).astype(bool)
    lower = rasterize(
        lower_shapes, out_shape=shape, transform=transform, fill=NODATA_FLOAT, dtype="float32"
    ).astype(float)
    upper = rasterize(
        upper_shapes, out_shape=shape, transform=transform, fill=NODATA_FLOAT, dtype="float32"
    ).astype(float)

    has_lower = coverage & (lower != NODATA_FLOAT) & (lower != OPEN_BOUND) & np.isfinite(lower)
    has_upper = coverage & (upper != NODATA_FLOAT) & (upper != OPEN_BOUND) & np.isfinite(upper)

    low_residual = np.where(has_lower, np.maximum(lower - depth, 0.0), 0.0)
    high_residual = np.where(has_upper, np.maximum(depth - upper, 0.0), 0.0)
    residual = np.maximum(low_residual, high_residual)
    contradiction = valid & coverage & (residual > NUMERIC_TOLERANCE_M)
    below = contradiction & (low_residual >= high_residual) & (low_residual > NUMERIC_TOLERANCE_M)
    above = contradiction & ~below

    uncertainty_r11 = np.full(depth.shape, unc_nodata if unc_nodata is not None else NODATA_FLOAT, dtype=float)
    uncertainty_r11[valid] = np.sqrt(np.square(uncertainty[valid]) + np.square(residual[valid]))

    support = np.full(depth.shape, NODATA_CLASS, dtype=np.uint8)
    support[valid & ~coverage] = 1
    support[valid & coverage & ~contradiction] = 2
    support[below] = 3
    support[above] = 4

    depare_residual = np.full(depth.shape, NODATA_FLOAT, dtype=float)
    depare_residual[valid & coverage] = residual[valid & coverage]
    depare_lower = np.full(depth.shape, NODATA_FLOAT, dtype=float)
    depare_lower[coverage & has_lower] = lower[coverage & has_lower]
    depare_upper = np.full(depth.shape, NODATA_FLOAT, dtype=float)
    depare_upper[coverage & has_upper] = upper[coverage & has_upper]

    for src, name in [
        (depth_path, "candidate_depth_chart_datum_m_r11.tif"),
        (nearest_path, "nearest_evidence_distance_m_r11.tif"),
        (quality_path, "candidate_source_quality_weight_r11.tif"),
    ]:
        dst = grids / name
        shutil.copy2(src, dst)
        with rasterio.open(dst, "r+") as ds:
            ds.update_tags(
                R11_ROLE="ENC_DEPARE_CONDITIONED_PACKAGE",
                R11_NUMERIC_VALUES_CHANGED="FALSE",
                DEPARE_SOURCE_CELLS=",".join(source_cells),
                SOUNDING_DATUM_CODE=str(datum_code),
                SOUNDING_DATUM_NAME=str(datum_name),
            )

    unc_out = grids / "candidate_uncertainty_enc_depare_conditioned_m_r11.tif"
    write_float_like(
        unc_path, unc_out, uncertainty_r11,
        {
            "WORLD_STATUS": "CANDIDATE_NOT_SURVEY_TRUTH",
            "R11_ROLE": "ENC_DEPARE_CONDITIONED_UNCERTAINTY",
            "FORMULA": "sqrt(R10_uncertainty^2 + DEPARE_range_residual^2)",
            "DEPTH_MUTATION": "NONE",
            "NUMERIC_TOLERANCE_M": str(NUMERIC_TOLERANCE_M),
            "SOUNDING_DATUM_CODE": str(datum_code),
            "SOUNDING_DATUM_NAME": str(datum_name),
            "MSL_EQUIVALENCE": "NOT_ASSERTED",
        },
    )
    residual_out = grids / "enc_depare_range_residual_m_r11.tif"
    write_float_like(
        unc_path, residual_out, depare_residual,
        {
            "WORLD_STATUS": "TRACEABILITY_COMPANION_NOT_DEPTH_TRUTH",
            "R11_ROLE": "DEPARE_RANGE_RESIDUAL",
            "DEPTH_MUTATION": "NONE",
            "NUMERIC_TOLERANCE_M": str(NUMERIC_TOLERANCE_M),
        },
    )
    lower_out = grids / "enc_depare_drval1_m_r11.tif"
    upper_out = grids / "enc_depare_drval2_m_r11.tif"
    write_float_like(
        unc_path, lower_out, depare_lower,
        {"WORLD_STATUS": "SOURCE_DERIVED_COMPANION", "R11_ROLE": "DEPARE_DRVAL1", "SOUNDING_DATUM_NAME": str(datum_name)}
    )
    write_float_like(
        unc_path, upper_out, depare_upper,
        {"WORLD_STATUS": "SOURCE_DERIVED_COMPANION", "R11_ROLE": "DEPARE_DRVAL2", "SOUNDING_DATUM_NAME": str(datum_name)}
    )

    support_profile = depth_profile.copy()
    support_profile.update(dtype="uint8", count=1, nodata=NODATA_CLASS, compress="deflate")
    support_out = grids / "candidate_support_class_r11.tif"
    with rasterio.open(support_out, "w", **support_profile) as dst:
        dst.write(support, 1)
        dst.update_tags(
            WORLD_STATUS="TRACEABILITY_COMPANION_NOT_DEPTH_TRUTH",
            CLASS_0="NoData",
            CLASS_1="valid candidate outside selected DEPARE coverage",
            CLASS_2="candidate within selected DEPARE DRVAL interval",
            CLASS_3="candidate shallower than DEPARE DRVAL1 by > numeric tolerance",
            CLASS_4="candidate deeper than DEPARE DRVAL2 by > numeric tolerance",
            DEPTH_MUTATION="NONE",
        )

    zone_audit = {}
    for code, name in ZONE_NAMES.items():
        m = valid & (semantic == code)
        covered = m & coverage
        bad = m & contradiction
        zone_audit[name] = {
            "validCells": int(m.sum()),
            "depareCoveredCells": int(covered.sum()),
            "depareContradictionCells": int(bad.sum()),
            "depareContradictionFractionOfCovered": float(bad.sum() / covered.sum()) if covered.sum() else None,
            "residualStatsM": stats(residual[bad]),
            "contradictionCells60To70M": int(np.sum(bad & (depth >= 60.0) & (depth <= 70.0))),
            "contradictionCellsOver100M": int(np.sum(bad & (depth > 100.0))),
        }

    report = {
        "schema": "kaopu.palau.airai-enc-depare-consistency-r11/1.0",
        "sourceIdentity": {
            "depare": {
                "path": "vectors/DEPARE.geojson",
                "sha256": sha256(depare_path),
                "sourceCellsUsed": source_cells,
                "featureCountUsed": int(len(depare)),
                "role": "NOAA ENC charted depth-area interval evidence",
            },
            "depthR10": {"path": f"grids/{depth_path.name}", "sha256": sha256(depth_path)},
            "uncertaintyR10": {"path": f"grids/{unc_path.name}", "sha256": sha256(unc_path)},
            "datumR09": {"path": datum_path.name, "sha256": sha256(datum_path)},
        },
        "verticalDatum": {
            "soundingDatumCode": datum_code,
            "soundingDatumName": datum_name,
            "numericTransform": "NONE",
            "mslEquivalence": "NOT_ASSERTED",
        },
        "depareFields": {"lower": lo_col, "upper": hi_col, "sourceCell": cell_col},
        "overlapRule": "Broad/open DEPARE intervals are rasterized first; narrower intervals overwrite them in overlaps. No candidate value is used to select the interval.",
        "numericToleranceM": NUMERIC_TOLERANCE_M,
        "candidateAudit": {
            "validCells": int(valid.sum()),
            "depareCoveredValidCells": int(np.sum(valid & coverage)),
            "depareUncoveredValidCells": int(np.sum(valid & ~coverage)),
            "withinDepareRangeCells": int(np.sum(valid & coverage & ~contradiction)),
            "contradictionCells": int(np.sum(contradiction)),
            "shallowerThanDRVAL1Cells": int(np.sum(below)),
            "deeperThanDRVAL2Cells": int(np.sum(above)),
            "allCandidateDepthStatsM": stats(depth[valid]),
            "contradictionDepthStatsM": stats(depth[contradiction]),
            "contradictionResidualStatsM": stats(residual[contradiction]),
            "contradictionCells60To70M": int(np.sum(contradiction & (depth >= 60.0) & (depth <= 70.0))),
            "contradictionCellsOver100M": int(np.sum(contradiction & (depth > 100.0))),
        },
        "bySemanticZone": zone_audit,
        "uncertaintyUpdate": {
            "formula": "sqrt(R10_uncertainty^2 + DEPARE_range_residual^2)",
            "depthValuesChanged": False,
            "nearestEvidenceValuesChanged": False,
            "qualityWeightValuesChanged": False,
            "uncertaintyValuesChanged": bool(np.any(contradiction)),
            "depareUsedAsDepthReplacement": False,
        },
        "workingHypothesisAudit": {
            "hypothesis": "major channels about 60-70 m and reef-interior water generally below 100 m depth",
            "forcedToHypothesis": False,
            "rule": "DEPARE intervals are retained as encoded. No interval or candidate depth is changed to satisfy the hypothesis.",
        },
        "preferredCandidatePackage": {
            "status": "CANDIDATE_NOT_SURVEY_TRUTH",
            "depthGrid": "grids/candidate_depth_chart_datum_m_r11.tif",
            "uncertaintyGrid": "grids/candidate_uncertainty_enc_depare_conditioned_m_r11.tif",
            "nearestEvidenceGrid": "grids/nearest_evidence_distance_m_r11.tif",
            "qualityWeightGrid": "grids/candidate_source_quality_weight_r11.tif",
            "semanticZoneGrid": "grids/candidate_semantic_zone_r08.tif",
            "supportClassGrid": "grids/candidate_support_class_r11.tif",
            "depareLowerGrid": "grids/enc_depare_drval1_m_r11.tif",
            "depareUpperGrid": "grids/enc_depare_drval2_m_r11.tif",
            "depareResidualGrid": "grids/enc_depare_range_residual_m_r11.tif",
            "noDataPreserved": True,
            "numericDepthValuesChanged": False,
        },
        "palauWorldContract": "R11 remains one evidence package for PalauWorld.sample(); no traditional LOD or parallel terrain world is introduced.",
    }
    report_path = results / "ENC_DEPARE_CONSISTENCY_R11.json"
    write_json(report_path, report)

    binding = {
        "schema": "kaopu.palau-world.bathymetry-evidence-binding/1.1",
        "consumer": "PalauWorld.sample()",
        "singleConductor": True,
        "traditionalLOD": False,
        "status": "CANDIDATE_NOT_SURVEY_TRUTH",
        "verticalDatum": report["verticalDatum"],
        "rasters": report["preferredCandidatePackage"],
        "samplingRules": [
            "Return NoData where the preferred depth grid is NoData.",
            "Carry uncertainty, nearest-evidence distance, source-quality weight, semantic zone and DEPARE support class with sampled candidate depth.",
            "DEPARE disagreement raises uncertainty; it does not clamp or replace the interpolated depth in R11.",
            "Do not convert local chart sounding datum to MSL without an explicit transformation model.",
            "Allen/OSM/Sentinel semantics remain qualifiers, not depth observations.",
        ],
    }
    binding_path = results / "PALAU_WORLD_BATHYMETRY_BINDING_R11.json"
    write_json(binding_path, binding)

    main_report_path = results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if main_report_path.exists():
        main_report = json.loads(main_report_path.read_text(encoding="utf-8"))
        main_report["encDepareConsistencyR11"] = report
        main_report["candidateGridPreferred"] = report["preferredCandidatePackage"]
        main_report["palauWorldBathymetryBinding"] = binding_path.name
        write_json(main_report_path, main_report)

    index_path = results / "index.html"
    if index_path.exists():
        html = index_path.read_text(encoding="utf-8")
        marker = "ENC_DEPARE_R11"
        if marker not in html:
            a = report["candidateAudit"]
            block = (
                f'<!-- {marker} --><section><h2>R11 NOAA ENC DEPARE consistency</h2>'
                f'<p>DEPARE-covered valid cells: {a["depareCoveredValidCells"]}; contradictions: {a["contradictionCells"]} '
                f'(shallower than DRVAL1={a["shallowerThanDRVAL1Cells"]}, deeper than DRVAL2={a["deeperThanDRVAL2Cells"]}).</p>'
                f'<p>60–70 m contradiction cells: {a["contradictionCells60To70M"]}; &gt;100 m contradiction cells: {a["contradictionCellsOver100M"]}. '
                'Depth values remain unchanged; only uncertainty and support provenance are updated.</p>'
                '<p><a href="ENC_DEPARE_CONSISTENCY_R11.json">R11 JSON</a> · '
                '<a href="PALAU_WORLD_BATHYMETRY_BINDING_R11.json">PalauWorld.sample() binding</a></p></section>'
            )
            html = html.replace("</main>", block + "\n</main>") if "</main>" in html else html.replace("</body>", block + "\n</body>")
            index_path.write_text(html, encoding="utf-8")

    manifest = []
    for p in sorted(results.rglob("*")):
        if p.is_file() and p.name != "MANIFEST.sha256" and "_work" not in p.parts:
            manifest.append(f"{sha256(p)}  {p.relative_to(results).as_posix()}")
    (results / "MANIFEST.sha256").write_text("\n".join(manifest) + "\n", encoding="utf-8")

    print(json.dumps({
        "sourceCells": source_cells,
        "datumCode": datum_code,
        "datumName": datum_name,
        "candidateAudit": report["candidateAudit"],
        "preferredCandidatePackage": report["preferredCandidatePackage"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
