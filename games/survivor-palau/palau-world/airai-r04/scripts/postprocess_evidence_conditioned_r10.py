#!/usr/bin/env python3
"""R10: evidence-condition the Airai candidate bathymetry uncertainty without inventing depth.

This bounded stage keeps the R09 depth values exactly unchanged. It uses only measured
high-quality ENC soundings already reconciled with Allen geomorphic zones to identify
where an interpolated candidate is well supported by the local evidence distribution
and where uncertainty should be increased. Allen/OSM semantics never become depth
observations. The user's 60–70 m / <100 m working hypothesis is audited, never enforced.
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

NODATA_FLOAT = -9999.0
NODATA_CLASS = 0
HIGH_QUALITY_ZOC = {"A1", "A2", "B"}
ZONE_NAME = {
    1: "outside_allen_geomorphic_or_unclassified",
    2: "reef_flat_or_crest",
    3: "shallow_lagoon",
    4: "deep_lagoon",
    5: "reef_slope",
    6: "plateau",
}
ZONE_CODE = {v: k for k, v in ZONE_NAME.items()}
MIN_HQ_SOUNDINGS_FOR_ENVELOPE = 4


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


def stats(values: np.ndarray) -> dict:
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


def empirical_envelopes(soundings: gpd.GeoDataFrame) -> dict[str, dict]:
    out: dict[str, dict] = {}
    zoc = soundings.get("zoc_label", pd.Series(index=soundings.index, dtype=object)).astype(str)
    hq = soundings[zoc.isin(HIGH_QUALITY_ZOC)].copy()
    hq["depth_m"] = pd.to_numeric(hq.get("depth_m"), errors="coerce")

    for name, code in ZONE_CODE.items():
        if code == 1:
            continue
        grp = hq[hq.get("semantic_zone", pd.Series(index=hq.index, dtype=object)).astype(str) == name]
        a = grp["depth_m"].to_numpy(float)
        a = a[np.isfinite(a)]
        s = stats(a)
        rec = {
            "zoneCode": code,
            "highQualitySoundingStatsM": s,
            "envelopeBuilt": False,
            "lowerM": None,
            "upperM": None,
            "method": None,
        }
        if len(a) >= MIN_HQ_SOUNDINGS_FOR_ENVELOPE:
            p05 = float(np.percentile(a, 5))
            p95 = float(np.percentile(a, 95))
            span = max(0.0, p95 - p05)
            margin = max(3.0, 0.35 * span)
            rec.update({
                "envelopeBuilt": True,
                "lowerM": max(0.0, p05 - margin),
                "upperM": p95 + margin,
                "method": "HQ CATZOC A1/A2/B empirical p05-p95 expanded by max(3 m, 35% of span); uncertainty-only",
            })
        out[name] = rec
    return out


def alignment_signature(ds: rasterio.io.DatasetReader) -> tuple:
    return (ds.width, ds.height, str(ds.crs), tuple(ds.transform))


def audit_zone_grid(depth: np.ndarray, valid: np.ndarray, zone: np.ndarray, envelopes: dict[str, dict]) -> dict:
    out = {}
    for code, name in ZONE_NAME.items():
        m = valid & (zone == code)
        vals = depth[m]
        rec = {
            "cells": int(m.sum()),
            "depthStatsM": stats(vals),
            "cells60To70M": int(np.sum((vals >= 60.0) & (vals <= 70.0))) if len(vals) else 0,
            "cellsOver100M": int(np.sum(vals > 100.0)) if len(vals) else 0,
        }
        env = envelopes.get(name)
        if env and env.get("envelopeBuilt") and len(vals):
            lo, hi = float(env["lowerM"]), float(env["upperM"])
            rec["outsideEmpiricalEnvelopeCells"] = int(np.sum((vals < lo) | (vals > hi)))
            rec["empiricalEnvelopeM"] = [lo, hi]
        else:
            rec["outsideEmpiricalEnvelopeCells"] = None
            rec["empiricalEnvelopeM"] = None
        out[name] = rec
    return out


def write_float_like(src_path: Path, dst_path: Path, arr: np.ndarray, tags: dict) -> None:
    with rasterio.open(src_path) as src:
        profile = src.profile.copy()
        nodata = src.nodata if src.nodata is not None else NODATA_FLOAT
    profile.update(dtype="float32", count=1, nodata=nodata, compress="deflate", tiled=True)
    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(arr.astype("float32"), 1)
        dst.update_tags(**tags)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()
    results = args.results.resolve()
    grids = results / "grids"
    vectors = results / "vectors"

    depth_path = grids / "candidate_depth_chart_datum_m_r09.tif"
    unc_path = grids / "candidate_uncertainty_m_r09.tif"
    nearest_path = grids / "nearest_evidence_distance_m_r09.tif"
    quality_path = grids / "candidate_source_quality_weight_r09.tif"
    semantic_path = grids / "candidate_semantic_zone_r08.tif"
    sounding_path = vectors / "SOUNDG_REEF_ZONE_JOINED_R08.geojson"
    datum_report_path = results / "ENC_SOUNDING_DATUM_R09.json"
    required = [depth_path, unc_path, nearest_path, quality_path, semantic_path, sounding_path, datum_report_path]
    for p in required:
        if not p.exists():
            raise SystemExit(f"R10 required input missing: {p}")

    with rasterio.open(depth_path) as ds:
        depth = ds.read(1).astype(float)
        depth_nodata = ds.nodata
        sig = alignment_signature(ds)
        depth_profile = ds.profile.copy()
        depth_tags = ds.tags()
    with rasterio.open(unc_path) as ds:
        if alignment_signature(ds) != sig:
            raise SystemExit("R10 alignment failure: uncertainty grid does not match R09 depth grid")
        uncertainty = ds.read(1).astype(float)
        unc_nodata = ds.nodata
    with rasterio.open(nearest_path) as ds:
        if alignment_signature(ds) != sig:
            raise SystemExit("R10 alignment failure: nearest-evidence grid does not match R09 depth grid")
        nearest = ds.read(1).astype(float)
        nearest_nodata = ds.nodata
    with rasterio.open(quality_path) as ds:
        if alignment_signature(ds) != sig:
            raise SystemExit("R10 alignment failure: quality grid does not match R09 depth grid")
        quality = ds.read(1).astype(float)
        quality_nodata = ds.nodata
    with rasterio.open(semantic_path) as ds:
        if alignment_signature(ds) != sig:
            raise SystemExit("R10 alignment failure: semantic grid does not match R09 depth grid")
        zone = ds.read(1).astype(np.uint8)

    valid = (
        valid_mask(depth, depth_nodata)
        & valid_mask(uncertainty, unc_nodata)
        & valid_mask(nearest, nearest_nodata)
        & valid_mask(quality, quality_nodata)
    )
    if not np.any(valid):
        raise SystemExit("R10 found no valid candidate cells")

    snd = gpd.read_file(sounding_path)
    envelopes = empirical_envelopes(snd)

    residual = np.full(depth.shape, NODATA_FLOAT, dtype=float)
    penalty = np.zeros(depth.shape, dtype=float)
    support_class = np.full(depth.shape, NODATA_CLASS, dtype=np.uint8)
    support_class[valid & (zone == 1)] = 1

    envelope_cells = 0
    outside_cells = 0
    for name, rec in envelopes.items():
        code = int(rec["zoneCode"])
        m = valid & (zone == code)
        if not np.any(m):
            continue
        if not rec.get("envelopeBuilt"):
            support_class[m] = 4
            continue
        lo, hi = float(rec["lowerM"]), float(rec["upperM"])
        vals = depth[m]
        resid = np.where(vals < lo, lo - vals, np.where(vals > hi, vals - hi, 0.0))
        residual[m] = resid
        idx = np.where(m)
        penalty[idx] = resid
        support_class[idx] = np.where(resid > 0.0, 3, 2).astype(np.uint8)
        envelope_cells += int(m.sum())
        outside_cells += int(np.sum(resid > 0.0))

    uncertainty_r10 = np.full(depth.shape, unc_nodata if unc_nodata is not None else NODATA_FLOAT, dtype=float)
    uncertainty_r10[valid] = np.sqrt(np.square(uncertainty[valid]) + np.square(penalty[valid]))

    copied = {}
    for src, suffix in [
        (depth_path, "candidate_depth_chart_datum_m_r10.tif"),
        (nearest_path, "nearest_evidence_distance_m_r10.tif"),
        (quality_path, "candidate_source_quality_weight_r10.tif"),
    ]:
        dst = grids / suffix
        shutil.copy2(src, dst)
        with rasterio.open(dst, "r+") as ds:
            ds.update_tags(
                R10_ROLE="EVIDENCE_CONDITIONED_PACKAGE",
                R10_NUMERIC_VALUES_CHANGED="FALSE",
                R10_RULE="Semantics do not alter depth/nearest/quality; see R10 uncertainty and support companion grids",
            )
        copied[src.name] = f"grids/{dst.name}"

    out_unc = grids / "candidate_uncertainty_evidence_conditioned_m_r10.tif"
    write_float_like(
        unc_path,
        out_unc,
        uncertainty_r10,
        {
            "WORLD_STATUS": "CANDIDATE_NOT_SURVEY_TRUTH",
            "R10_ROLE": "EVIDENCE_CONDITIONED_UNCERTAINTY",
            "SOURCE": "R09 uncertainty plus empirical Allen-zone residual from HQ ENC SOUNDG",
            "SEMANTIC_DEPTH_MUTATION": "NONE",
            "WORKING_HYPOTHESIS_FORCED": "FALSE",
            "VERTICAL_DATUM": depth_tags.get("SOUNDING_DATUM_NAME", "local datum"),
        },
    )

    out_resid = grids / "semantic_depth_residual_m_r10.tif"
    write_float_like(
        unc_path,
        out_resid,
        residual,
        {
            "WORLD_STATUS": "TRACEABILITY_COMPANION_NOT_DEPTH_TRUTH",
            "R10_ROLE": "EMPIRICAL_ZONE_RESIDUAL",
            "SOURCE": "Distance outside conservative HQ SOUNDG empirical envelope within Allen geomorphic zone",
            "NO_ENVELOPE_OR_OUTSIDE_ALLEN": "NoData",
            "WORKING_HYPOTHESIS_FORCED": "FALSE",
        },
    )

    support_profile = depth_profile.copy()
    support_profile.update(dtype="uint8", count=1, nodata=NODATA_CLASS, compress="deflate")
    out_support = grids / "candidate_support_class_r10.tif"
    with rasterio.open(out_support, "w", **support_profile) as dst:
        dst.write(support_class, 1)
        dst.update_tags(
            WORLD_STATUS="TRACEABILITY_COMPANION_NOT_DEPTH_TRUTH",
            CLASS_1="valid candidate outside/unclassified Allen shallow geomorphology",
            CLASS_2="Allen zone with HQ empirical envelope; candidate within envelope",
            CLASS_3="Allen zone with HQ empirical envelope; candidate outside envelope; uncertainty inflated",
            CLASS_4="Allen zone lacks enough HQ soundings for empirical envelope",
            CLASS_0="NoData",
            WORKING_HYPOTHESIS_FORCED="FALSE",
        )

    datum_report = json.loads(datum_report_path.read_text(encoding="utf-8"))
    datum_code = datum_report.get("candidateConstraintDatumCode")
    datum_name = datum_report.get("candidateConstraintDatumName")

    grid_audit = audit_zone_grid(depth, valid, zone, envelopes)
    measured_zoc = snd.get("zoc_label", pd.Series(index=snd.index, dtype=object)).astype(str)
    measured_hq = snd[measured_zoc.isin(HIGH_QUALITY_ZOC)].copy()
    measured_depth = pd.to_numeric(measured_hq.get("depth_m"), errors="coerce").to_numpy(float)
    measured_depth = measured_depth[np.isfinite(measured_depth)]
    hypothesis_audit = {
        "workingHypothesis": "major channels about 60-70 m and reef-interior water generally below 100 m depth",
        "highQualityMeasuredSoundings": {
            **stats(measured_depth),
            "between60And70M": int(np.sum((measured_depth >= 60.0) & (measured_depth <= 70.0))),
            "deeperThan100M": int(np.sum(measured_depth > 100.0)),
        },
        "candidateValidCells": int(valid.sum()),
        "candidateCells60To70M": int(np.sum(valid & (depth >= 60.0) & (depth <= 70.0))),
        "candidateCellsOver100M": int(np.sum(valid & (depth > 100.0))),
        "forcedToHypothesis": False,
        "rule": "Counts are diagnostics only. No cell is clipped, deepened, or shoaled to satisfy the working hypothesis.",
    }

    report = {
        "schema": "kaopu.palau.airai-evidence-conditioned-candidate-r10/1.0",
        "inputIdentity": {
            "depthR09": {"path": f"grids/{depth_path.name}", "sha256": sha256(depth_path)},
            "uncertaintyR09": {"path": f"grids/{unc_path.name}", "sha256": sha256(unc_path)},
            "nearestEvidenceR09": {"path": f"grids/{nearest_path.name}", "sha256": sha256(nearest_path)},
            "qualityR09": {"path": f"grids/{quality_path.name}", "sha256": sha256(quality_path)},
            "semanticZoneR08": {"path": f"grids/{semantic_path.name}", "sha256": sha256(semantic_path)},
            "soundingsR08": {"path": f"vectors/{sounding_path.name}", "sha256": sha256(sounding_path)},
        },
        "verticalDatum": {
            "soundingDatumCode": datum_code,
            "soundingDatumName": datum_name,
            "numericTransform": "NONE",
            "mslEquivalence": "NOT_ASSERTED",
        },
        "empiricalZoneEnvelopes": envelopes,
        "gridAuditBySemanticZone": grid_audit,
        "hypothesisAudit": hypothesis_audit,
        "uncertaintyUpdate": {
            "formula": "sqrt(R09_uncertainty^2 + semantic_empirical_residual^2)",
            "cellsWithEmpiricalEnvelope": envelope_cells,
            "cellsOutsideEnvelope": outside_cells,
            "depthValuesChanged": False,
            "nearestEvidenceValuesChanged": False,
            "qualityWeightValuesChanged": False,
            "uncertaintyValuesChanged": bool(outside_cells > 0),
            "semanticsUsedAsDepthObservations": False,
        },
        "preferredCandidatePackage": {
            "status": "CANDIDATE_NOT_SURVEY_TRUTH",
            "depthGrid": "grids/candidate_depth_chart_datum_m_r10.tif",
            "uncertaintyGrid": "grids/candidate_uncertainty_evidence_conditioned_m_r10.tif",
            "nearestEvidenceGrid": "grids/nearest_evidence_distance_m_r10.tif",
            "qualityWeightGrid": "grids/candidate_source_quality_weight_r10.tif",
            "semanticZoneGrid": "grids/candidate_semantic_zone_r08.tif",
            "supportClassGrid": "grids/candidate_support_class_r10.tif",
            "semanticResidualGrid": "grids/semantic_depth_residual_m_r10.tif",
            "noDataPreserved": True,
            "numericDepthValuesChanged": False,
        },
        "palauWorldContract": "All R10 rasters are one evidence package for the same PalauWorld.sample() conductor. No traditional LOD or parallel terrain world is introduced.",
    }
    out_json = results / "EVIDENCE_CONDITIONED_CANDIDATE_R10.json"
    write_json(out_json, report)

    conductor = {
        "schema": "kaopu.palau-world.bathymetry-evidence-binding/1.0",
        "consumer": "PalauWorld.sample()",
        "singleConductor": True,
        "traditionalLOD": False,
        "status": "CANDIDATE_NOT_SURVEY_TRUTH",
        "verticalDatum": report["verticalDatum"],
        "rasters": report["preferredCandidatePackage"],
        "samplingRules": [
            "Return NoData where the preferred depth grid is NoData; do not synthesize depth from habitat semantics.",
            "Carry uncertainty, nearest-evidence distance, source-quality weight, semantic zone and support class with every sampled candidate depth.",
            "Do not convert the local chart sounding datum to MSL without an explicit transformation model.",
            "Allen/OSM/Sentinel semantics may qualify support or uncertainty but are not depth observations by themselves.",
        ],
    }
    write_json(results / "PALAU_WORLD_BATHYMETRY_BINDING_R10.json", conductor)

    main_report_path = results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if main_report_path.exists():
        main_report = json.loads(main_report_path.read_text(encoding="utf-8"))
        main_report["evidenceConditionedCandidateR10"] = report
        main_report["candidateGridPreferred"] = report["preferredCandidatePackage"]
        main_report["palauWorldBathymetryBinding"] = "PALAU_WORLD_BATHYMETRY_BINDING_R10.json"
        write_json(main_report_path, main_report)

    index_path = results / "index.html"
    if index_path.exists():
        html = index_path.read_text(encoding="utf-8")
        marker = "EVIDENCE_CONDITIONED_R10"
        if marker not in html:
            block = (
                f'<!-- {marker} --><section><h2>R10 evidence-conditioned candidate</h2>'
                f'<p>R09 depth values are unchanged. {outside_cells} cells inside Allen zones fall outside conservative '
                f'empirical envelopes from high-quality ENC soundings, so only their uncertainty is increased.</p>'
                f'<p>Valid candidate cells: {int(valid.sum())}; 60–70 m cells: {hypothesis_audit["candidateCells60To70M"]}; '
                f'&gt;100 m cells: {hypothesis_audit["candidateCellsOver100M"]}. These are diagnostics, not hypothesis constraints.</p>'
                '<p><a href="EVIDENCE_CONDITIONED_CANDIDATE_R10.json">R10 JSON</a> · '
                '<a href="PALAU_WORLD_BATHYMETRY_BINDING_R10.json">PalauWorld.sample() binding</a></p></section>'
            )
            html = html.replace("</main>", block + "\n</main>") if "</main>" in html else html.replace("</body>", block + "\n</body>")
            index_path.write_text(html, encoding="utf-8")

    manifest = []
    for p in sorted(results.rglob("*")):
        if p.is_file() and p.name != "MANIFEST.sha256" and "_work" not in p.parts:
            manifest.append(f"{sha256(p)}  {p.relative_to(results).as_posix()}")
    (results / "MANIFEST.sha256").write_text("\n".join(manifest) + "\n", encoding="utf-8")

    print(json.dumps({
        "validCandidateCells": int(valid.sum()),
        "cellsWithEmpiricalEnvelope": envelope_cells,
        "cellsOutsideEnvelope": outside_cells,
        "hypothesisAudit": hypothesis_audit,
        "preferredCandidatePackage": report["preferredCandidatePackage"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
