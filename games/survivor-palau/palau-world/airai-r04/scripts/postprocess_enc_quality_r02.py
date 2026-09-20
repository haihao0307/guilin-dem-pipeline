#!/usr/bin/env python3
"""Join NOAA ENC M_QUAL provenance to Airai soundings and rebuild a quality-aware candidate grid.

CATZOC is an IHO chart-quality classification. The model weights below are deliberately
relative weights for interpolation only; they are NOT conversions of CATZOC into survey
accuracy and MUST NOT be presented as measured uncertainty.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from pyproj import Transformer
import rasterio
from rasterio.transform import from_origin
from scipy.spatial import cKDTree
from shapely.geometry import box

CORE = [134.535, 7.315, 134.605, 7.385]
CORE_POLY = box(*CORE)
UTM = 32653
NODATA = -9999.0

# S-57 CATZOC enumeration: 1=A1, 2=A2, 3=B, 4=C, 5=D, 6=U.
CATZOC_LABEL = {1: "A1", 2: "A2", 3: "B", 4: "C", 5: "D", 6: "U"}
# Conservative relative interpolation weights only. Not IHO error limits.
CATZOC_MODEL_WEIGHT = {1: 1.00, 2: 0.90, 3: 0.72, 4: 0.45, 5: 0.22, 6: 0.15}
UNKNOWN_WEIGHT = 0.18
CONTOUR_WEIGHT = 0.30


def safe_int(v):
    try:
        if pd.isna(v): return None
        return int(v)
    except Exception:
        return None


def year_int(v):
    if v is None or pd.isna(v): return None
    s = str(v).strip()
    if len(s) >= 4 and s[:4].isdigit(): return int(s[:4])
    return None


def quality_rank(code):
    c = safe_int(code)
    if c in (1, 2, 3, 4, 5): return c
    if c == 6: return 99
    return 100


def load(path: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(path)
    if g.crs is None: g = g.set_crs(4326)
    else: g = g.to_crs(4326)
    return g


def join_quality(results: Path) -> gpd.GeoDataFrame:
    vectors = results / "vectors"
    snd = load(vectors / "SOUNDG_NORMALIZED.geojson").reset_index(drop=True)
    snd["_sound_id"] = np.arange(len(snd), dtype=int)
    qual_path = vectors / "M_QUAL.geojson"
    if not qual_path.exists():
        snd["CATZOC"] = np.nan
        snd["zoc_label"] = "UNQUALIFIED"
        snd["quality_model_weight"] = UNKNOWN_WEIGHT
        return snd

    qual = load(qual_path).copy()
    keep = [c for c in ["_enc_cell", "CATZOC", "POSACC", "SOUACC", "SUREND", "SURSTA", "TECSOU", "VERDAT", "INFORM", "SORDAT", "SORIND", "geometry"] if c in qual.columns]
    qual = qual[keep].copy()
    rename = {c: f"q_{c}" for c in qual.columns if c != "geometry"}
    qual = qual.rename(columns=rename)
    joined = gpd.sjoin(snd, qual, how="left", predicate="intersects")

    # Prefer a quality polygon from the same ENC cell as the sounding. Then prefer the
    # strongest assessed CATZOC and most recent survey-end date. This resolves overlaps
    # created by chart-cell / compilation boundaries without duplicating soundings.
    joined["_same_cell"] = (
        joined.get("_enc_cell", "").astype(str) == joined.get("q__enc_cell", "").astype(str)
    ).astype(int)
    joined["_zrank"] = joined.get("q_CATZOC", pd.Series(index=joined.index, dtype=float)).map(quality_rank)
    joined["_survey_end_year"] = joined.get("q_SUREND", pd.Series(index=joined.index, dtype=object)).map(year_int).fillna(-1)
    joined = joined.sort_values(
        ["_sound_id", "_same_cell", "_zrank", "_survey_end_year"],
        ascending=[True, False, True, False],
        kind="stable",
    ).drop_duplicates("_sound_id", keep="first")

    for src, dst in [
        ("q_CATZOC", "CATZOC"), ("q_POSACC", "QUAL_POSACC"), ("q_SOUACC", "QUAL_SOUACC"),
        ("q_SUREND", "QUAL_SUREND"), ("q_SURSTA", "QUAL_SURSTA"), ("q_TECSOU", "QUAL_TECSOU"),
        ("q_VERDAT", "QUAL_VERDAT"), ("q_INFORM", "QUAL_INFORM"), ("q_SORDAT", "QUAL_SORDAT"),
        ("q_SORIND", "QUAL_SORIND"), ("q__enc_cell", "QUAL_ENC_CELL")
    ]:
        if src in joined.columns: joined[dst] = joined[src]

    joined["CATZOC"] = pd.to_numeric(joined.get("CATZOC"), errors="coerce")
    joined["zoc_label"] = joined["CATZOC"].map(lambda v: CATZOC_LABEL.get(safe_int(v), "UNQUALIFIED"))
    joined["quality_model_weight"] = joined["CATZOC"].map(lambda v: CATZOC_MODEL_WEIGHT.get(safe_int(v), UNKNOWN_WEIGHT)).astype(float)
    drop_cols = [c for c in joined.columns if c.startswith("q_") or c in {"index_right", "_same_cell", "_zrank", "_survey_end_year"}]
    joined = joined.drop(columns=drop_cols, errors="ignore")
    return gpd.GeoDataFrame(joined, geometry="geometry", crs=4326)


def stat(vals):
    a = np.asarray(vals, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a): return {"count": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None}
    return {
        "count": int(len(a)), "min": float(np.min(a)), "p05": float(np.percentile(a,5)),
        "median": float(np.median(a)), "p95": float(np.percentile(a,95)), "max": float(np.max(a))
    }


def summarize(joined: gpd.GeoDataFrame, results: Path) -> dict:
    core = joined[joined.intersects(CORE_POLY)].copy()
    def counts(frame, col):
        if col not in frame.columns: return {}
        s = frame[col].fillna("NULL").astype(str).value_counts(dropna=False)
        return {str(k): int(v) for k, v in s.items()}

    by_zoc = {}
    for label, grp in core.groupby("zoc_label", dropna=False):
        d = pd.to_numeric(grp["depth_m"], errors="coerce")
        by_zoc[str(label)] = {
            "count": int(len(grp)), "depthStatsM": stat(d),
            "between60And70M": int(((d >= 60) & (d <= 70)).sum()),
            "deeperThan100M": int((d > 100).sum()),
            "surveyEndYears": counts(grp, "QUAL_SUREND"),
        }
    return {
        "schema": "kaopu.palau.airai-enc-quality-r02/1.0",
        "coreBBoxWGS84": CORE,
        "allSoundings": int(len(joined)),
        "coreSoundings": int(len(core)),
        "coreMatchedToMQUAL": int((core["zoc_label"] != "UNQUALIFIED").sum()),
        "coreUnqualified": int((core["zoc_label"] == "UNQUALIFIED").sum()),
        "coreCATZOCCounts": counts(core, "zoc_label"),
        "coreByCATZOC": by_zoc,
        "coreSurveyEndYears": counts(core, "QUAL_SUREND"),
        "coreSurveyStartYears": counts(core, "QUAL_SURSTA"),
        "coreSourceCells": counts(core, "_enc_cell"),
        "sourceLineageExamples": sorted({str(x) for x in core.get("QUAL_INFORM", pd.Series(dtype=str)).dropna().unique()})[:20],
        "modelWeightBoundary": "quality_model_weight is a relative interpolation weight, not an IHO CATZOC accuracy conversion",
        "officialCATZOCEnumeration": {"1":"A1","2":"A2","3":"B","4":"C","5":"D","6":"U"},
        "m_sdatPresent": (results / "vectors/M_SDAT.geojson").exists(),
    }


def quality_grid(joined: gpd.GeoDataFrame, results: Path) -> dict:
    vectors = results / "vectors"
    contours = load(vectors / "DEPCNT_SAMPLED_POINTS.geojson")
    snd = joined[joined.intersects(CORE_POLY)].copy()
    contours = contours[contours.intersects(CORE_POLY)].copy()

    s = snd[["depth_m", "quality_model_weight", "geometry"]].copy()
    s["kind"] = "SOUNDG"
    c = contours[["depth_m", "geometry"]].copy()
    c["quality_model_weight"] = CONTOUR_WEIGHT
    c["kind"] = "DEPCNT"
    pts = gpd.GeoDataFrame(pd.concat([s, c], ignore_index=True), crs=4326).to_crs(UTM)
    xy = np.array([[p.x, p.y] for p in pts.geometry], dtype=float)
    depth = pd.to_numeric(pts["depth_m"], errors="coerce").to_numpy(float)
    q = pd.to_numeric(pts["quality_model_weight"], errors="coerce").fillna(UNKNOWN_WEIGHT).to_numpy(float)
    ok = np.isfinite(depth)
    xy, depth, q = xy[ok], depth[ok], q[ok]
    tree = cKDTree(xy)

    fwd = Transformer.from_crs(4326, UTM, always_xy=True)
    west, south = fwd.transform(CORE[0], CORE[1]); east, north = fwd.transform(CORE[2], CORE[3])
    res = 25.0
    width = int(math.ceil((east-west)/res)); height = int(math.ceil((north-south)/res))
    xs = west + (np.arange(width)+0.5)*res; ys = north - (np.arange(height)+0.5)*res
    xx, yy = np.meshgrid(xs, ys); query = np.c_[xx.ravel(), yy.ravel()]
    k = min(12, len(xy)); dist, idx = tree.query(query, k=k)
    if k == 1: dist, idx = dist[:,None], idx[:,None]
    dz = depth[idx]; qw = q[idx]
    w = qw / np.square(dist + 5.0)
    z = np.sum(w*dz, axis=1) / np.sum(w, axis=1)
    spread = np.sqrt(np.sum(w*np.square(dz-z[:,None]), axis=1) / np.sum(w, axis=1))
    nearest = dist[:,0]
    # Keep uncertainty explicitly model-derived. Add a penalty where evidence quality is weak.
    local_q = np.sum(w*qw, axis=1) / np.sum(w, axis=1)
    uncertainty = spread + 0.025*nearest + (1.0-local_q)*4.0
    valid = nearest <= 800.0
    transform = from_origin(west, north, res, res)
    profile = {"driver":"GTiff","height":height,"width":width,"count":1,"dtype":"float32","crs":f"EPSG:{UTM}","transform":transform,"nodata":NODATA,"compress":"deflate","tiled":True}
    grids = results / "grids"; grids.mkdir(exist_ok=True)
    products = {
        "candidate_depth_chart_datum_m_r02.tif": z,
        "candidate_uncertainty_m_r02.tif": uncertainty,
        "nearest_evidence_distance_m_r02.tif": nearest,
        "candidate_source_quality_weight_r02.tif": local_q,
    }
    for name, arr in products.items():
        out = np.where(valid, arr, NODATA).reshape(height,width).astype("float32")
        with rasterio.open(grids/name, "w", **profile) as dst:
            dst.write(out,1)
            dst.update_tags(
                WORLD_STATUS="CANDIDATE_NOT_SURVEY_TRUTH",
                VERTICAL_DATUM="NOAA_ENC_CHART_DATUM_UNRESOLVED",
                SOURCE="SOUNDG weighted by spatial M_QUAL CATZOC + DEPCNT constraints",
                QUALITY_WEIGHT_STATUS="RELATIVE_MODEL_WEIGHT_NOT_IHO_ACCURACY",
            )
    return {
        "built": True, "resolutionM":res, "shape":[height,width], "validFraction":float(np.mean(valid)),
        "evidenceCount":int(len(xy)), "soundings":int(len(snd)), "contourConstraints":int(len(contours)),
        "maxInterpolationDistanceM":800.0, "status":"CANDIDATE_NOT_SURVEY_TRUTH",
        "preferredDepthGrid":"grids/candidate_depth_chart_datum_m_r02.tif",
        "uncertaintyGrid":"grids/candidate_uncertainty_m_r02.tif",
        "nearestEvidenceGrid":"grids/nearest_evidence_distance_m_r02.tif",
        "qualityWeightGrid":"grids/candidate_source_quality_weight_r02.tif",
    }


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--results", required=True); args = ap.parse_args()
    results = Path(args.results)
    joined = join_quality(results)
    out_gj = results / "vectors/SOUNDG_QUALITY_JOINED.geojson"
    out_csv = results / "vectors/SOUNDG_QUALITY_JOINED.csv"
    joined.to_file(out_gj, driver="GeoJSON")
    tab = joined.drop(columns="geometry").copy(); tab["lon"] = joined.geometry.x; tab["lat"] = joined.geometry.y
    tab.to_csv(out_csv, index=False)

    summary = summarize(joined, results)
    grid = quality_grid(joined, results)
    summary["qualityAwareCandidateGrid"] = grid
    (results/"ENC_QUALITY_SUMMARY_R02.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False)+"\n")

    report_path = results/"AIRAI_REEF_EVIDENCE_REPORT.json"
    report = json.loads(report_path.read_text())
    report["encQualityR02"] = summary
    report["candidateGridPreferred"] = grid
    report["verticalDatum"] = "NOAA ENC chart datum unresolved; M_SDAT absent in converted AOI layers; per-sounding/source VERDAT retained where encoded"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n")

    html = results/"index.html"
    if html.exists():
        text = html.read_text()
        marker = "<!-- ENC_QUALITY_R02 -->"
        if marker not in text:
            c = summary["coreCATZOCCounts"]
            block = f'''\n{marker}<section style="margin:18px;padding:16px;border:1px solid #ffffff22;border-radius:14px"><h2>ENC quality-aware R02</h2><p>Core soundings: {summary['coreSoundings']} · M_QUAL matched: {summary['coreMatchedToMQUAL']} · CATZOC: {json.dumps(c, ensure_ascii=False)}</p><p>Depth interpolation now uses spatial M_QUAL as a relative evidence weight. This does not convert CATZOC to survey accuracy; chart datum remains unresolved. The preferred R02 grid keeps NoData, model uncertainty and nearest-evidence distance.</p></section>'''
            text = text.replace("</body>", block+"\n</body>")
            html.write_text(text)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

if __name__ == "__main__": main()
