#!/usr/bin/env python3
"""Build the R19 user-yellow-AOI evidence package from already-persisted sources.

This script never downloads data and never promotes interpolation to survey truth.
It clips the previously verified NOAA/ENC/Allen context vectors to the user AOI,
then builds a 25 m candidate grid carrying NoData, uncertainty, evidence distance,
quality weight and DEPARE disagreement.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask, rasterize
from rasterio.transform import from_origin
from scipy.spatial import cKDTree
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

LAYERS = [
    "COALNE", "LNDARE", "SOUNDG_DATUM_JOINED_R09", "DEPCNT", "DEPARE",
    "SBDARE", "M_QUAL", "UWTROC", "OBSTRN",
    "ALLEN_GEOMORPHIC_CONTEXT_SOURCE_R05", "ALLEN_BENTHIC_CONTEXT_SOURCE_R05",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def stats(values: np.ndarray | pd.Series) -> dict[str, float | int | None]:
    a = np.asarray(values, dtype=float)
    a = a[np.isfinite(a)]
    if not len(a):
        return {"count": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None}
    return {
        "count": int(len(a)), "min": float(np.min(a)), "p05": float(np.percentile(a, 5)),
        "median": float(np.median(a)), "p95": float(np.percentile(a, 95)), "max": float(np.max(a)),
    }


def clean_for_geojson(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    out = gdf.copy()
    for col in out.columns:
        if col == "geometry":
            continue
        if out[col].dtype == "object":
            out[col] = out[col].apply(
                lambda value: json.dumps(value, ensure_ascii=False)
                if isinstance(value, (list, dict, tuple)) else value
            )
    return out


def load_aoi(candidate_file: Path) -> tuple[list[list[float]], Polygon]:
    doc = json.loads(candidate_file.read_text())
    coords = doc["consensusCandidate"]["meanPolygonLonLat"]
    polygon = Polygon(coords)
    if not polygon.is_valid or polygon.is_empty:
        raise SystemExit("invalid candidate AOI polygon")
    return coords, polygon


def clip_layer(source_root: Path, output: Path, name: str, aoi_gdf: gpd.GeoDataFrame):
    source_path = source_root / "vectors" / f"{name}.geojson"
    gdf = gpd.read_file(source_path)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    selected = gdf[gdf.intersects(aoi_gdf.geometry.iloc[0])].copy()
    clipped = gpd.clip(selected, aoi_gdf, keep_geom_type=False) if len(selected) else selected
    clipped = clipped[clipped.geometry.notna() & ~clipped.geometry.is_empty].copy()
    out_path = output / "vectors" / f"{name}.geojson"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if len(clipped):
        clean_for_geojson(clipped).to_file(out_path, driver="GeoJSON")
    else:
        gpd.GeoDataFrame(columns=["geometry"], geometry="geometry", crs=4326).to_file(out_path, driver="GeoJSON")
    return gdf, clipped, out_path


def contour_points(depcnt: gpd.GeoDataFrame, spacing_m: float = 100.0) -> gpd.GeoDataFrame:
    if depcnt.empty:
        return gpd.GeoDataFrame(columns=["depth_m", "quality", "kind", "geometry"], geometry="geometry", crs=4326)
    utm = depcnt.to_crs(32653)
    back = Transformer.from_crs(32653, 4326, always_xy=True)
    rows: list[dict[str, object]] = []
    for _, row in utm.iterrows():
        try:
            depth = float(row.get("VALDCO"))
        except Exception:
            continue
        geom = row.geometry
        lines = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
        for line in lines:
            count = max(2, int(math.ceil(line.length / spacing_m)) + 1)
            for distance in np.linspace(0, line.length, count):
                point = line.interpolate(float(distance))
                lon, lat = back.transform(point.x, point.y)
                rows.append({
                    "depth_m": depth, "quality": 0.35, "kind": "DEPCNT",
                    "geometry": gpd.points_from_xy([lon], [lat])[0],
                })
    return gpd.GeoDataFrame(rows, crs=4326)


def grid_profile(aoi_gdf: gpd.GeoDataFrame, resolution: float = 25.0):
    aoi_utm = aoi_gdf.to_crs(32653).geometry.iloc[0]
    west, south, east, north = aoi_utm.bounds
    west = math.floor(west / resolution) * resolution
    south = math.floor(south / resolution) * resolution
    east = math.ceil(east / resolution) * resolution
    north = math.ceil(north / resolution) * resolution
    width = int(round((east - west) / resolution))
    height = int(round((north - south) / resolution))
    transform = from_origin(west, north, resolution, resolution)
    profile = {
        "driver": "GTiff", "height": height, "width": width, "count": 1,
        "dtype": "float32", "crs": "EPSG:32653", "transform": transform,
        "nodata": -9999.0, "compress": "deflate", "tiled": True,
    }
    return aoi_utm, profile


def build_grids(output: Path, aoi_gdf: gpd.GeoDataFrame, soundings: gpd.GeoDataFrame,
                depcnt: gpd.GeoDataFrame, depare: gpd.GeoDataFrame) -> dict[str, object]:
    aoi_utm, profile = grid_profile(aoi_gdf)
    height, width = profile["height"], profile["width"]
    transform, nodata = profile["transform"], profile["nodata"]

    snd = soundings.copy()
    snd["quality"] = pd.to_numeric(snd.get("quality_model_weight", 1.0), errors="coerce").fillna(0.5).clip(0.05, 1.0)
    snd["kind"] = "SOUNDG"
    snd = snd[["depth_m", "quality", "kind", "geometry"]]
    cnt = contour_points(depcnt)
    points = gpd.GeoDataFrame(pd.concat([snd, cnt], ignore_index=True), crs=4326).to_crs(32653)

    xy = np.array([[point.x, point.y] for point in points.geometry], dtype=float)
    depth = pd.to_numeric(points["depth_m"], errors="coerce").to_numpy(float)
    quality = pd.to_numeric(points["quality"], errors="coerce").fillna(0.2).to_numpy(float)
    kind = points["kind"].to_numpy()
    keep = np.isfinite(depth)
    xy, depth, quality, kind = xy[keep], depth[keep], quality[keep], kind[keep]
    if not len(xy):
        raise SystemExit("no SOUNDG/DEPCNT evidence in candidate AOI")

    xs = transform.c + (np.arange(width) + 0.5) * transform.a
    ys = transform.f + (np.arange(height) + 0.5) * transform.e
    xx, yy = np.meshgrid(xs, ys)
    query = np.c_[xx.ravel(), yy.ravel()]
    tree = cKDTree(xy)
    k = min(12, len(xy))
    distance, index = tree.query(query, k=k)
    if k == 1:
        distance, index = distance[:, None], index[:, None]
    values, qvalues = depth[index], quality[index]
    weights = qvalues / np.square(distance + 5.0)
    sum_weights = np.sum(weights, axis=1)
    candidate = np.sum(weights * values, axis=1) / sum_weights
    spread = np.sqrt(np.sum(weights * np.square(values - candidate[:, None]), axis=1) / sum_weights)
    nearest = distance[:, 0]
    quality_grid = np.sum(weights * qvalues, axis=1) / sum_weights
    nearest_kind = kind[index[:, 0]]
    base_uncertainty = spread + 0.025 * nearest

    inside = geometry_mask([mapping(aoi_utm)], out_shape=(height, width), transform=transform,
                           invert=True, all_touched=False).ravel()
    valid = inside & (nearest <= 800.0)
    support = np.zeros(len(query), dtype=np.float32)
    support[valid] = 3
    support[valid & (nearest <= 150.0) & (nearest_kind == "DEPCNT")] = 2
    support[valid & (nearest <= 150.0) & (nearest_kind == "SOUNDG")] = 1

    areas = depare.to_crs(32653).copy()
    areas["lo"] = pd.to_numeric(areas["DRVAL1"], errors="coerce")
    areas["hi"] = pd.to_numeric(areas["DRVAL2"], errors="coerce")
    areas["interval_width"] = (areas["hi"] - areas["lo"]).where(
        np.isfinite(areas["hi"] - areas["lo"]), 1e9
    )
    areas = areas.sort_values("interval_width", ascending=False)
    lo_shapes, hi_shapes = [], []
    for _, row in areas.iterrows():
        if row.geometry is None or row.geometry.is_empty:
            continue
        if np.isfinite(row["lo"]):
            lo_shapes.append((mapping(row.geometry), float(row["lo"])))
        if np.isfinite(row["hi"]):
            hi_shapes.append((mapping(row.geometry), float(row["hi"])))
    lo = rasterize(lo_shapes, out_shape=(height, width), transform=transform, fill=nodata, dtype="float32").ravel()
    hi = rasterize(hi_shapes, out_shape=(height, width), transform=transform, fill=nodata, dtype="float32").ravel()
    covered = (lo != nodata) | (hi != nodata)
    lower = np.where(lo != nodata, lo, -np.inf)
    upper = np.where(hi != nodata, hi, np.inf)
    residual_value = np.zeros(len(query), dtype=float)
    residual_value = np.where(candidate < lower, lower - candidate, residual_value)
    residual_value = np.where(candidate > upper, candidate - upper, residual_value)
    residual = np.full(len(query), nodata, dtype=np.float32)
    residual[valid & covered] = residual_value[valid & covered]
    uncertainty = np.sqrt(np.square(base_uncertainty) + np.square(np.where(residual == nodata, 0, residual)))

    arrays = {
        "candidate_depth_chart_datum_m_r19aoi.tif": np.where(valid, candidate, nodata),
        "candidate_uncertainty_enc_depare_conditioned_m_r19aoi.tif": np.where(valid, uncertainty, nodata),
        "nearest_evidence_distance_m_r19aoi.tif": np.where(valid, nearest, nodata),
        "candidate_source_quality_weight_r19aoi.tif": np.where(valid, quality_grid, nodata),
        "candidate_support_class_r19aoi.tif": np.where(inside, support, nodata),
        "enc_depare_drval1_m_r19aoi.tif": np.where(inside & (lo != nodata), lo, nodata),
        "enc_depare_drval2_m_r19aoi.tif": np.where(inside & (hi != nodata), hi, nodata),
        "enc_depare_range_residual_m_r19aoi.tif": residual,
        "aoi_mask_r19aoi.tif": np.where(inside, 1, nodata),
    }
    grids = output / "grids"
    grids.mkdir(parents=True, exist_ok=True)
    tags = {
        "WORLD_STATUS": "CANDIDATE_NOT_SURVEY_TRUTH",
        "VERTICAL_DATUM": "NOAA_ENC_LOCAL_DATUM_CODE_24",
        "AOI_STATUS": "EVIDENCE_DERIVED_CANDIDATE_NOT_FINAL",
        "NO_DATA_RULE": "PRESERVED",
        "SOURCE": "NOAA ENC SOUNDG + DEPCNT + DEPARE + M_QUAL",
    }
    for name, values_out in arrays.items():
        data = values_out.reshape(height, width).astype("float32")
        with rasterio.open(grids / name, "w", **profile) as dst:
            dst.write(data, 1)
            dst.update_tags(**tags)

    return {
        "resolutionM": 25.0, "shape": [height, width],
        "aoiCells": int(inside.sum()), "validCells": int(valid.sum()),
        "validFractionOfAoi": float(valid.sum() / max(inside.sum(), 1)),
        "soundings": int(len(snd)), "contourSamplePoints": int(len(cnt)),
        "evidencePoints": int(len(points)), "maxInterpolationDistanceM": 800.0,
        "depthStatsM": stats(candidate[valid]), "uncertaintyStatsM": stats(uncertainty[valid]),
        "nearestEvidenceStatsM": stats(nearest[valid]),
        "depareCoveredValidCells": int((valid & covered).sum()),
        "depareContradictionCells": int((valid & covered & (residual_value > 0.05)).sum()),
        "supportClassCounts": {
            str(int(value)): int(count)
            for value, count in zip(*np.unique(support[valid], return_counts=True))
        },
        "files": {
            name: {"bytes": (grids / name).stat().st_size, "sha256": sha256(grids / name)}
            for name in arrays
        },
    }


def build(source_root: Path, candidate_file: Path, output: Path) -> None:
    coords, aoi = load_aoi(candidate_file)
    aoi_gdf = gpd.GeoDataFrame([
        {"id": "STONE_MONEY_USER_YELLOW_AOI_CANDIDATE",
         "status": "EVIDENCE_DERIVED_CANDIDATE_NOT_FINAL", "geometry": aoi}
    ], crs=4326)
    if output.exists():
        import shutil
        shutil.rmtree(output)
    output.mkdir(parents=True)
    aoi_gdf.to_file(output / "STONE_MONEY_USER_YELLOW_AOI_CANDIDATE.geojson", driver="GeoJSON")

    clipped: dict[str, gpd.GeoDataFrame] = {}
    clip_summary: dict[str, object] = {}
    for name in LAYERS:
        source, part, out_path = clip_layer(source_root, output, name, aoi_gdf)
        clipped[name] = part
        clip_summary[name] = {
            "sourceFeatures": int(len(source)), "intersectingFeatures": int(len(part)),
            "geometryTypes": part.geom_type.value_counts().to_dict() if len(part) else {},
            "bytes": out_path.stat().st_size, "sha256": sha256(out_path),
        }

    land = clipped["LNDARE"].to_crs(32653)
    coast = clipped["COALNE"].to_crs(32653)
    land_union = unary_union(list(land.geometry)) if len(land) else None
    components = []
    if land_union is not None and not land_union.is_empty:
        components = list(land_union.geoms) if land_union.geom_type == "MultiPolygon" else [land_union]
    relation = {
        "landFeatureCount": int(len(land)), "landConnectedComponentCount": int(len(components)),
        "landAreaM2": float(sum(geom.area for geom in components)),
        "coastFeatureCount": int(len(coast)), "coastLengthM": float(coast.length.sum()) if len(coast) else 0.0,
        "namedLandObjects": sorted({
            str(value) for value in clipped["LNDARE"].get("OBJNAM", [])
            if value is not None and str(value) != "nan"
        }),
        "warning": "ENC object names are evidence only; no story-island name is assigned.",
    }
    grid = build_grids(output, aoi_gdf, clipped["SOUNDG_DATUM_JOINED_R09"],
                       clipped["DEPCNT"], clipped["DEPARE"])
    soundings = clipped["SOUNDG_DATUM_JOINED_R09"]
    report = {
        "schema": "kaopu.survivor-palau.r19-user-aoi-evidence/1.0",
        "status": "EVIDENCE_DERIVED_CANDIDATE_NOT_FINAL",
        "aoi": {
            "source": candidate_file.as_posix(), "coordinates": coords, "bbox": list(aoi.bounds),
            "geographicRegistrationPassed": False,
        },
        "sourceEvidence": {
            "root": source_root.as_posix(), "noRedownload": True,
            "chartDatumCode": 24, "chartDatumName": "local datum",
            "candidateBathymetryIsSurveyTruth": False,
        },
        "clipSummary": clip_summary, "spatialRelationQa": relation,
        "soundings": {
            "count": int(len(soundings)), "depthStatsM": stats(soundings["depth_m"]),
            "zocCounts": {str(key): int(value) for key, value in soundings["zoc_label"].value_counts(dropna=False).to_dict().items()},
            "sourceCells": sorted(soundings["_enc_cell"].dropna().astype(str).unique().tolist()),
        },
        "gridCandidate": grid,
        "truthBoundaries": {
            "noDataPreserved": True, "chartDatumConvertedToMsl": False,
            "proceduralCoastlineAdded": False, "unknownFilled": False,
            "storyIslandNamed": False, "visualBuildAllowed": False,
        },
    }
    (output / "R19_USER_AOI_EVIDENCE_REPORT.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    lines = []
    for path in sorted(output.rglob("*")):
        if path.is_file() and path.name != "MANIFEST.sha256":
            lines.append(f"{sha256(path)}  {path.relative_to(output).as_posix()}")
    (output / "MANIFEST.sha256").write_text("\n".join(lines) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.source_root.resolve(), args.candidate.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
