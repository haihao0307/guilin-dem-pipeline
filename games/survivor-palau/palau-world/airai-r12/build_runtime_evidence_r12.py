#!/usr/bin/env python3
"""Build the reproducible Airai R12 PalauWorld evidence runtime.

This builder uses only vector evidence already present in the sealed R11 handoff.
It never downloads data, never fills unsupported areas, never converts the
unresolved NOAA ENC local chart datum, and never labels interpolation as survey
truth. Numeric candidate depth is retained while semantic and DEPARE conflicts
increase uncertainty only.
"""
from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import numpy as np
import pandas as pd
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy.spatial import cKDTree
from shapely.geometry import box, mapping

CORE = [134.535, 7.315, 134.605, 7.385]
UTM_EPSG = 32653
RESOLUTION_M = 25.0
MAX_SUPPORT_DISTANCE_M = 800.0
NODATA_FLOAT = -9999.0
NODATA_I16 = -32768
NODATA_U16 = 65535
CONTOUR_MODEL_WEIGHT = 0.35
UNKNOWN_SOUNDING_WEIGHT = 0.18
DEPARE_CELL = "US4TB3P0"
NUMERIC_TOLERANCE_M = 0.05

ZONE_CODE = {
    "outside_allen_geomorphic_or_unclassified": 1,
    "reef_flat_or_crest": 2,
    "shallow_lagoon": 3,
    "deep_lagoon": 4,
    "reef_slope": 5,
    "plateau": 6,
}
ZONE_NAME = {v: k for k, v in ZONE_CODE.items()}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(path: Path, target_crs: int | None = None) -> gpd.GeoDataFrame:
    g = gpd.read_file(path)
    if g.crs is None:
        g = g.set_crs(4326)
    else:
        g = g.to_crs(4326)
    if target_crs is not None:
        g = g.to_crs(target_crs)
    return g


def classify_geomorphic(value) -> int:
    if value is None or pd.isna(value):
        return ZONE_CODE["outside_allen_geomorphic_or_unclassified"]
    s = str(value).strip().lower()
    if "reef flat" in s or "reef crest" in s:
        return ZONE_CODE["reef_flat_or_crest"]
    if s == "shallow lagoon":
        return ZONE_CODE["shallow_lagoon"]
    if s == "deep lagoon":
        return ZONE_CODE["deep_lagoon"]
    if "reef slope" in s:
        return ZONE_CODE["reef_slope"]
    if s == "plateau":
        return ZONE_CODE["plateau"]
    return ZONE_CODE["outside_allen_geomorphic_or_unclassified"]


@dataclass(frozen=True)
class GridGeometry:
    west: float
    south: float
    east: float
    north: float
    width: int
    height: int
    transform: object


def grid_geometry() -> GridGeometry:
    fwd = Transformer.from_crs(4326, UTM_EPSG, always_xy=True)
    west, south = fwd.transform(CORE[0], CORE[1])
    east, north = fwd.transform(CORE[2], CORE[3])
    width = int(math.ceil((east - west) / RESOLUTION_M))
    height = int(math.ceil((north - south) / RESOLUTION_M))
    return GridGeometry(
        west=west,
        south=south,
        east=east,
        north=north,
        width=width,
        height=height,
        transform=from_origin(west, north, RESOLUTION_M, RESOLUTION_M),
    )


def evidence_points(results: Path, core_utm, geom: GridGeometry):
    vectors = results / "vectors"
    sound_path = vectors / "SOUNDG_DATUM_JOINED_R09.geojson"
    contour_path = vectors / "DEPCNT_SAMPLED_POINTS.geojson"
    sound = load(sound_path)
    contour = load(contour_path)
    sound = sound[sound.intersects(box(*CORE))].copy()
    contour = contour[contour.intersects(box(*CORE))].copy()

    s = sound[["depth_m", "quality_model_weight", "zoc_label", "geometry"]].copy()
    s["depth_m"] = pd.to_numeric(s["depth_m"], errors="coerce")
    s["quality_model_weight"] = pd.to_numeric(s["quality_model_weight"], errors="coerce").fillna(UNKNOWN_SOUNDING_WEIGHT)
    s["kind"] = "SOUNDG"

    c = contour[["depth_m", "geometry"]].copy()
    c["depth_m"] = pd.to_numeric(c["depth_m"], errors="coerce")
    c["quality_model_weight"] = CONTOUR_MODEL_WEIGHT
    c["zoc_label"] = "CONTOUR"
    c["kind"] = "DEPCNT"

    pts = gpd.GeoDataFrame(pd.concat([s, c], ignore_index=True), crs=4326).dropna(subset=["depth_m"])
    pts_utm = pts.to_crs(UTM_EPSG)
    xy = np.array([[p.x, p.y] for p in pts_utm.geometry], dtype=np.float64)
    depth = pts["depth_m"].to_numpy(np.float64)
    quality = pts["quality_model_weight"].to_numpy(np.float64)
    return sound, contour, pts, xy, depth, quality


def build_idw(geom: GridGeometry, xy, depth, quality):
    xs = geom.west + (np.arange(geom.width) + 0.5) * RESOLUTION_M
    ys = geom.north - (np.arange(geom.height) + 0.5) * RESOLUTION_M
    xx, yy = np.meshgrid(xs, ys)
    query = np.c_[xx.ravel(), yy.ravel()]
    tree = cKDTree(xy)
    k = min(12, len(xy))
    dist, idx = tree.query(query, k=k)
    if k == 1:
        dist, idx = dist[:, None], idx[:, None]
    dvals = depth[idx]
    qvals = quality[idx]
    weights = qvals / np.square(dist + 5.0)
    weight_sum = np.sum(weights, axis=1)
    candidate = np.sum(weights * dvals, axis=1) / weight_sum
    spread = np.sqrt(np.sum(weights * np.square(dvals - candidate[:, None]), axis=1) / weight_sum)
    nearest = dist[:, 0]
    local_quality = np.sum(weights * qvals, axis=1) / weight_sum
    uncertainty = spread + 0.025 * nearest + (1.0 - local_quality) * 4.0
    valid = nearest <= MAX_SUPPORT_DISTANCE_M
    shape = (geom.height, geom.width)
    return {
        "depth": candidate.reshape(shape).astype(np.float32),
        "uncertainty_r02": uncertainty.reshape(shape).astype(np.float32),
        "nearest": nearest.reshape(shape).astype(np.float32),
        "quality": local_quality.reshape(shape).astype(np.float32),
        "valid": valid.reshape(shape),
    }


def rasterize_semantic(results: Path, geom: GridGeometry):
    path = results / "vectors/ALLEN_GEOMORPHIC_CORE_R05.geojson"
    allen = load(path, UTM_EPSG)
    shapes = []
    for _, row in allen.iterrows():
        if row.geometry is None or row.geometry.is_empty:
            continue
        shapes.append((row.geometry, classify_geomorphic(row.get("class_name"))))
    return rasterize(
        shapes,
        out_shape=(geom.height, geom.width),
        transform=geom.transform,
        fill=ZONE_CODE["outside_allen_geomorphic_or_unclassified"],
        dtype="uint8",
    )


def rasterize_land(results: Path, geom: GridGeometry):
    path = results / "vectors/LNDARE.geojson"
    land = load(path, UTM_EPSG)
    core_utm = box(geom.west, geom.south, geom.east, geom.north)
    land = land[land.intersects(core_utm)].copy()
    shapes = [(g, 1) for g in land.geometry if g is not None and not g.is_empty]
    return rasterize(
        shapes,
        out_shape=(geom.height, geom.width),
        transform=geom.transform,
        fill=0,
        dtype="uint8",
    )


def rasterize_depare(results: Path, geom: GridGeometry):
    """Rasterize NOAA DEPARE using the sealed R11 overlap rule exactly.

    Broad or open intervals are written first; narrower finite intervals are
    written last and therefore overwrite them. Candidate depth is never used to
    select an interval.
    """
    path = results / "vectors/DEPARE.geojson"
    dep = load(path, UTM_EPSG)
    if "_enc_cell" in dep.columns:
        dep = dep[dep["_enc_cell"].astype(str).eq(DEPARE_CELL)].copy()
    core_utm = box(geom.west, geom.south, geom.east, geom.north)
    dep = dep[dep.geometry.notna() & ~dep.geometry.is_empty].copy()
    dep = dep[dep.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    dep = dep[dep.intersects(core_utm)].copy()
    dep["_lo"] = pd.to_numeric(dep.get("DRVAL1"), errors="coerce")
    dep["_hi"] = pd.to_numeric(dep.get("DRVAL2"), errors="coerce")
    dep["_width"] = np.where(
        np.isfinite(dep["_lo"]) & np.isfinite(dep["_hi"]),
        np.maximum(0.0, dep["_hi"] - dep["_lo"]),
        1.0e12,
    )
    dep = dep.sort_values("_width", ascending=False, kind="stable")

    coverage_shapes = []
    lower_shapes = []
    upper_shapes = []
    for _, row in dep.iterrows():
        g = row.geometry
        if g is None or g.is_empty:
            continue
        coverage_shapes.append((g, 1))
        lo = float(row["_lo"]) if np.isfinite(row["_lo"]) else NODATA_FLOAT
        hi = float(row["_hi"]) if np.isfinite(row["_hi"]) else NODATA_FLOAT
        lower_shapes.append((g, lo))
        upper_shapes.append((g, hi))
    shape = (geom.height, geom.width)
    coverage = rasterize(coverage_shapes, out_shape=shape, transform=geom.transform, fill=0, dtype="uint8").astype(bool)
    lower = rasterize(lower_shapes, out_shape=shape, transform=geom.transform, fill=NODATA_FLOAT, dtype="float32")
    upper = rasterize(upper_shapes, out_shape=shape, transform=geom.transform, fill=NODATA_FLOAT, dtype="float32")
    return coverage, lower, upper, dep


def empirical_envelopes(results: Path) -> dict[int, tuple[float, float]]:
    p = results / "EVIDENCE_CONDITIONED_CANDIDATE_R10.json"
    doc = json.loads(p.read_text(encoding="utf-8"))
    out = {}
    for name, item in doc["empiricalZoneEnvelopes"].items():
        if item.get("envelopeBuilt") and item.get("lowerM") is not None and item.get("upperM") is not None:
            out[int(item["zoneCode"])] = (float(item["lowerM"]), float(item["upperM"]))
    return out


def apply_uncertainty(grid, semantic, dep_coverage, dep_lower, dep_upper, envelopes):
    depth = grid["depth"]
    valid = grid["valid"]
    uncertainty = grid["uncertainty_r02"].astype(np.float64)
    semantic_residual = np.zeros_like(depth, dtype=np.float64)
    for code, (lower, upper) in envelopes.items():
        zone = valid & (semantic == code)
        residual = np.where(depth < lower, lower - depth, np.where(depth > upper, depth - upper, 0.0))
        semantic_residual[zone] = residual[zone]
    uncertainty_r10 = np.sqrt(np.square(uncertainty) + np.square(semantic_residual))

    has_lower = dep_coverage & (dep_lower != NODATA_FLOAT) & np.isfinite(dep_lower)
    has_upper = dep_coverage & (dep_upper != NODATA_FLOAT) & np.isfinite(dep_upper)
    has_depare = valid & dep_coverage
    low_residual = np.where(has_lower, np.maximum(dep_lower - depth, 0.0), 0.0)
    high_residual = np.where(has_upper, np.maximum(depth - dep_upper, 0.0), 0.0)
    dep_residual = np.maximum(low_residual, high_residual)
    contradiction = has_depare & (dep_residual > NUMERIC_TOLERANCE_M)
    below = contradiction & (low_residual >= high_residual) & (low_residual > NUMERIC_TOLERANCE_M)
    above = contradiction & ~below
    uncertainty_r11 = np.sqrt(np.square(uncertainty_r10) + np.square(dep_residual))

    support = np.zeros_like(semantic, dtype=np.uint8)
    support[valid & ~dep_coverage] = 1
    support[has_depare & ~contradiction] = 2
    support[below] = 3
    support[above] = 4
    return uncertainty_r11.astype(np.float32), semantic_residual.astype(np.float32), dep_residual.astype(np.float32), support


def quantize_i16_decimeters(arr: np.ndarray, valid: np.ndarray) -> np.ndarray:
    out = np.full(arr.shape, NODATA_I16, dtype="<i2")
    vals = np.rint(arr[valid] * 10.0)
    vals = np.clip(vals, -32767, 32767).astype(np.int16)
    out[valid] = vals
    return out


def quantize_u16_decimeters(arr: np.ndarray, valid: np.ndarray) -> np.ndarray:
    out = np.full(arr.shape, NODATA_U16, dtype="<u2")
    vals = np.rint(np.maximum(0.0, arr[valid]) * 10.0)
    vals = np.clip(vals, 0, NODATA_U16 - 1).astype(np.uint16)
    out[valid] = vals
    return out


def quantize_u16_meters(arr: np.ndarray, valid: np.ndarray) -> np.ndarray:
    out = np.full(arr.shape, NODATA_U16, dtype="<u2")
    vals = np.rint(np.maximum(0.0, arr[valid]))
    vals = np.clip(vals, 0, NODATA_U16 - 1).astype(np.uint16)
    out[valid] = vals
    return out


def quantize_quality(arr: np.ndarray, valid: np.ndarray) -> np.ndarray:
    out = np.full(arr.shape, 255, dtype=np.uint8)
    out[valid] = np.clip(np.rint(arr[valid] * 254.0), 0, 254).astype(np.uint8)
    return out


def write_part(path: Path, key: str, arr: np.ndarray) -> dict:
    data = arr.tobytes(order="C")
    b64 = base64.b64encode(data).decode("ascii")
    text = (
        "window.__PALAU_R12_GRID_PARTS=window.__PALAU_R12_GRID_PARTS||{};\n"
        f"window.__PALAU_R12_GRID_PARTS[{json.dumps(key)}]={json.dumps(b64)};\n"
    )
    path.write_text(text, encoding="utf-8")
    return {
        "path": path.name,
        "arrayKey": key,
        "dtype": str(arr.dtype),
        "shape": list(arr.shape),
        "rawBytes": len(data),
        "rawSha256": sha256_bytes(data),
        "fileBytes": path.stat().st_size,
        "fileSha256": sha256(path),
    }


def simplify_line_coords(geom, inv, tolerance_m=5.0):
    if geom is None or geom.is_empty:
        return []
    g = geom.simplify(tolerance_m, preserve_topology=True)
    geoms = list(g.geoms) if hasattr(g, "geoms") and g.geom_type.startswith("Multi") else [g]
    out = []
    for part in geoms:
        if part.geom_type == "Polygon":
            rings = [part.exterior, *part.interiors]
        elif part.geom_type == "LineString":
            rings = [part]
        else:
            continue
        for ring in rings:
            coords = []
            for x, y in ring.coords:
                lon, lat = inv.transform(x, y)
                coords.append([round(lon, 7), round(lat, 7)])
            if len(coords) >= 2:
                out.append(coords)
    return out


def build_vectors(results: Path, sound: gpd.GeoDataFrame, contour: gpd.GeoDataFrame) -> dict:
    core = box(*CORE)
    sound = sound[sound.intersects(core)].copy()
    soundings = []
    for _, r in sound.iterrows():
        soundings.append([
            round(float(r.geometry.x), 7), round(float(r.geometry.y), 7),
            round(float(r["depth_m"]), 2), str(r.get("zoc_label") or "UNQUALIFIED"),
            round(float(r.get("quality_model_weight") or UNKNOWN_SOUNDING_WEIGHT), 3),
            str(r.get("QUAL_SUREND") or ""), str(r.get("_enc_cell") or ""),
        ])

    inv = Transformer.from_crs(UTM_EPSG, 4326, always_xy=True)
    coastline = load(results / "vectors/COALNE.geojson", UTM_EPSG)
    coastline = coastline[coastline.intersects(box(*Transformer.from_crs(4326, UTM_EPSG, always_xy=True).transform(CORE[0], CORE[1]), *Transformer.from_crs(4326, UTM_EPSG, always_xy=True).transform(CORE[2], CORE[3])))]
    coast_lines = []
    for g in coastline.geometry:
        coast_lines.extend(simplify_line_coords(g, inv, 4.0))

    contours = load(results / "vectors/DEPCNT.geojson", UTM_EPSG)
    fwd = Transformer.from_crs(4326, UTM_EPSG, always_xy=True)
    w, s = fwd.transform(CORE[0], CORE[1]); e, n = fwd.transform(CORE[2], CORE[3])
    core_utm = box(w, s, e, n)
    contours = contours[contours.intersects(core_utm)].copy()
    contour_lines = []
    for _, r in contours.iterrows():
        depth = pd.to_numeric(pd.Series([r.get("VALDCO")]), errors="coerce").iloc[0]
        if not np.isfinite(depth):
            continue
        for line in simplify_line_coords(r.geometry, inv, 8.0):
            contour_lines.append({"depthM": round(float(depth), 2), "coordinates": line})

    return {
        "schema": "kaopu.palau.airai-runtime-vectors/1.0",
        "soundingsFields": ["lon", "lat", "depthMChartDatum", "zoc", "qualityModelWeight", "surveyEnd", "encCell"],
        "soundings": soundings,
        "coastlines": coast_lines,
        "contours": contour_lines,
    }


def stats(arr: np.ndarray, valid: np.ndarray) -> dict:
    vals = arr[valid]
    if vals.size == 0:
        return {"count": 0}
    return {
        "count": int(vals.size),
        "min": float(np.min(vals)),
        "p05": float(np.percentile(vals, 5)),
        "median": float(np.median(vals)),
        "p95": float(np.percentile(vals, 95)),
        "max": float(np.max(vals)),
    }


def build(results: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    geom = grid_geometry()
    core_utm = box(geom.west, geom.south, geom.east, geom.north)
    sound, contour, pts, xy, depth, quality = evidence_points(results, core_utm, geom)
    grid = build_idw(geom, xy, depth, quality)
    semantic = rasterize_semantic(results, geom)
    land = rasterize_land(results, geom)
    dep_coverage, dep_lower, dep_upper, dep = rasterize_depare(results, geom)
    envelopes = empirical_envelopes(results)
    uncertainty, semantic_residual, dep_residual, support = apply_uncertainty(
        grid, semantic, dep_coverage, dep_lower, dep_upper, envelopes
    )
    valid = grid["valid"]
    semantic = semantic.astype(np.uint8)
    semantic[~valid] = 0
    land = land.astype(np.uint8)
    land[~valid] = 0

    arrays = {
        "depthDm": quantize_i16_decimeters(grid["depth"], valid),
        "uncertaintyDm": quantize_u16_decimeters(uncertainty, valid),
        "nearestM": quantize_u16_meters(grid["nearest"], valid),
        "qualityU8": quantize_quality(grid["quality"], valid),
        "semanticU8": semantic,
        "supportU8": support,
        "landU8": land,
        "depareLowerDm": quantize_i16_decimeters(dep_lower, valid & (dep_lower != NODATA_FLOAT)),
        "depareUpperDm": quantize_i16_decimeters(dep_upper, valid & (dep_upper != NODATA_FLOAT)),
        "depareResidualDm": quantize_u16_decimeters(dep_residual, valid),
        "semanticResidualDm": quantize_u16_decimeters(semantic_residual, valid),
    }

    parts = []
    for key, arr in arrays.items():
        parts.append(write_part(out / f"grid-{key}.js", key, arr))

    vector_doc = build_vectors(results, sound, contour)
    vector_text = "window.__PALAU_R12_VECTORS=" + json.dumps(vector_doc, ensure_ascii=False, separators=(",", ":")) + ";\n"
    vector_path = out / "evidence-vectors.js"
    vector_path.write_text(vector_text, encoding="utf-8")

    inv = Transformer.from_crs(UTM_EPSG, 4326, always_xy=True)
    corners_utm = [
        [geom.west, geom.south], [geom.west, geom.north],
        [geom.east, geom.south], [geom.east, geom.north],
    ]
    corners_wgs = [list(inv.transform(x, y)) for x, y in corners_utm]

    source_paths = [
        results / "vectors/SOUNDG_DATUM_JOINED_R09.geojson",
        results / "vectors/DEPCNT_SAMPLED_POINTS.geojson",
        results / "vectors/DEPARE.geojson",
        results / "vectors/COALNE.geojson",
        results / "vectors/LNDARE.geojson",
        results / "vectors/M_QUAL.geojson",
        results / "vectors/ALLEN_GEOMORPHIC_CORE_R05.geojson",
        results / "EVIDENCE_CONDITIONED_CANDIDATE_R10.json",
        results / "ENC_DEPARE_CONSISTENCY_R11.json",
    ]
    source_identity = [
        {"path": str(p.relative_to(results)), "bytes": p.stat().st_size, "sha256": sha256(p)}
        for p in source_paths
    ]

    rebuilt_depth_stats = stats(grid["depth"], valid)
    rebuilt_uncertainty_stats = stats(uncertainty, valid)
    historical_report_path = results / "ENC_DEPARE_CONSISTENCY_R11.json"
    historical_report = json.loads(historical_report_path.read_text(encoding="utf-8"))
    historical_stats = historical_report.get("candidateAudit", {}).get("allCandidateDepthStatsM", {})
    compare_keys = ["min", "p05", "median", "p95", "max"]
    drift = {
        key: (float(rebuilt_depth_stats[key]) - float(historical_stats[key]))
        for key in compare_keys
        if rebuilt_depth_stats.get(key) is not None and historical_stats.get(key) is not None
    }
    historical_reproduction_match = all(abs(v) <= 1.0e-5 for v in drift.values())

    meta = {
        "schema": "kaopu.palau-world.evidence-runtime/1.0",
        "version": "AIRAI_R12_REPRODUCIBLE_EVIDENCE_RUNTIME_20260921",
        "status": "CANDIDATE_NOT_SURVEY_TRUTH",
        "visualAcceptance": False,
        "productionReady": False,
        "worldConductor": "PalauWorld.sample()",
        "traditionalLOD": False,
        "grid": {
            "crs": f"EPSG:{UTM_EPSG}",
            "coreBBoxWGS84": CORE,
            "projectedBoundsM": [geom.west, geom.south, geom.east, geom.north],
            "cornerWGS84": corners_wgs,
            "resolutionM": RESOLUTION_M,
            "shape": [geom.height, geom.width],
            "rowOrder": "north_to_south",
            "columnOrder": "west_to_east",
            "maxSupportDistanceM": MAX_SUPPORT_DISTANCE_M,
        },
        "verticalDatum": {
            "soundingDatumCode": 24,
            "soundingDatumName": "local datum",
            "numericTransform": "NONE",
            "mslEquivalence": "NOT_ASSERTED",
        },
        "arraySemantics": {
            "depthDm": "candidate chart-datum depth in decimetres; -32768 NoData",
            "uncertaintyDm": "model uncertainty after semantic and DEPARE residuals in decimetres; 65535 NoData",
            "nearestM": "nearest evidence distance in metres; 65535 NoData",
            "qualityU8": "relative model evidence quality 0..254; 255 NoData; not IHO accuracy",
            "semanticU8": {"0": "NoData", **{str(k): v for k, v in ZONE_NAME.items()}},
            "supportU8": {
                "0": "NoData", "1": "candidate_no_depare", "2": "within_depare_or_partial_interval",
                "3": "candidate_shallower_than_depare", "4": "candidate_deeper_than_depare",
            },
            "landU8": "1 where NOAA ENC LNDARE overlaps a supported cell; land elevation remains unknown",
            "depareLowerDm": "NOAA ENC DEPARE DRVAL1 decimetres; -32768 NoData",
            "depareUpperDm": "NOAA ENC DEPARE DRVAL2 decimetres; -32768 NoData",
        },
        "rules": [
            "Depth values are not changed to satisfy semantics, user hypotheses, or DEPARE intervals.",
            "Allen/OSM semantics are qualifiers, not depth observations.",
            "Semantic and DEPARE disagreement increase uncertainty only.",
            "Unsupported cells remain NoData; no filling beyond 800 m from evidence.",
            "Land elevation is unknown until the accepted Palau DEM is restored.",
        ],
        "counts": {
            "soundingsCore": int(len(sound)),
            "contourConstraintPointsCore": int(len(contour)),
            "candidateValidCells": int(valid.sum()),
            "candidateNoDataCells": int((~valid).sum()),
            "landSupportedCells": int(((land == 1) & valid).sum()),
            "depareSupportedCells": int(((support >= 2) & valid).sum()),
            "depareContradictionCells": int(((support == 3) | (support == 4)).sum()),
            "depareShallowerCells": int((support == 3).sum()),
            "depareDeeperCells": int((support == 4).sum()),
        },
        "depthStatsM": rebuilt_depth_stats,
        "uncertaintyStatsM": rebuilt_uncertainty_stats,
        "historicalReceiptComparison": {
            "historicalReport": "../airai-r04/results-r01/ENC_DEPARE_CONSISTENCY_R11.json",
            "historicalDerivedRasterPresentInHandoff": False,
            "historicalDepthStatsM": historical_stats,
            "rebuiltFromSealedVectorsDepthStatsM": rebuilt_depth_stats,
            "rebuiltMinusHistoricalM": drift,
            "numericReproductionMatch": historical_reproduction_match,
            "interpretation": (
                "MATCH" if historical_reproduction_match else
                "LINEAGE_DRIFT: the sealed vectors and scripts rebuild the same grid geometry and valid-cell coverage, "
                "but not the historical R11 depth distribution; the missing historical GeoTIFF cannot be reconstructed byte-for-byte."
            ),
        },
        "parts": parts,
        "vectors": {
            "path": vector_path.name,
            "bytes": vector_path.stat().st_size,
            "sha256": sha256(vector_path),
            "soundings": len(vector_doc["soundings"]),
            "coastlineParts": len(vector_doc["coastlines"]),
            "contourParts": len(vector_doc["contours"]),
        },
        "sourceIdentity": source_identity,
    }
    meta_path = out / "manifest.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest_js = out / "manifest.js"
    manifest_js.write_text(
        "window.__PALAU_R12_MANIFEST=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    meta["manifestSha256"] = sha256(meta_path)
    meta["manifestJsSha256"] = sha256(manifest_js)
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    meta = build(args.results.resolve(), args.out.resolve())
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
