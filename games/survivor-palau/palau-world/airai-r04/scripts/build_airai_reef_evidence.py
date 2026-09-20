#!/usr/bin/env python3
"""Build traceable Airai reef bathymetry evidence products.

Output depth grids are candidates derived from chart evidence. They are never
labelled as measured truth and always carry uncertainty and evidence-distance.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import zipfile

import fiona
import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyproj import Transformer
import rasterio
from rasterio.transform import from_origin
from scipy.spatial import cKDTree
from shapely.geometry import box

CONTEXT = [134.49, 7.27, 134.64, 7.42]
CORE = [134.535, 7.315, 134.605, 7.385]
ANCHOR = [134.5667427743189, 7.349032638038719]
LAYERS = ["SOUNDG", "DEPCNT", "DEPARE", "SBDARE", "COALNE", "LNDARE", "M_QUAL", "M_SDAT", "WATTUR", "OBSTRN", "UWTROC"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(cmd))
    return subprocess.run(cmd, text=True, capture_output=True, check=check)


def extract_encs(intake: Path, work: Path) -> list[tuple[str, Path]]:
    sources: list[tuple[str, Path]] = []
    for zpath in sorted((intake / "raw/noaa_enc").glob("US*.zip")):
        cell = zpath.stem
        target = work / "unpacked" / cell
        target.mkdir(parents=True, exist_ok=True)
        try:
            with zipfile.ZipFile(zpath) as zf:
                zf.extractall(target)
        except zipfile.BadZipFile:
            print(f"skip bad zip: {zpath}")
            continue
        base = next(iter(target.rglob("*.000")), None)
        if base:
            sources.append((cell, base))
    return sources


def convert_cell(cell: str, base: Path, work: Path) -> Path | None:
    gpkg = work / "gpkg" / f"{cell}.gpkg"
    gpkg.parent.mkdir(parents=True, exist_ok=True)
    if gpkg.exists():
        gpkg.unlink()
    cmd = [
        "ogr2ogr", "-f", "GPKG", str(gpkg), str(base),
        "-oo", "RETURN_PRIMITIVES=OFF",
        "-oo", "SPLIT_MULTIPOINT=ON",
        "-oo", "ADD_SOUNDG_DEPTH=ON",
        "-skipfailures",
    ]
    cp = run(cmd, check=False)
    if cp.returncode != 0 or not gpkg.exists():
        print(f"conversion failed {cell}: {cp.stderr[-1200:]}")
        return None
    return gpkg


def load_layer(gpkg: Path, layer: str, cell: str) -> gpd.GeoDataFrame | None:
    try:
        if layer not in fiona.listlayers(gpkg):
            return None
        gdf = gpd.read_file(gpkg, layer=layer)
        if gdf.empty:
            return None
        gdf["_enc_cell"] = cell
        if gdf.crs is None:
            gdf = gdf.set_crs(4326)
        else:
            gdf = gdf.to_crs(4326)
        gdf = gdf[gdf.geometry.notna()].copy()
        return gdf
    except Exception as exc:
        print(f"read {cell}/{layer} failed: {exc}")
        return None


def combine_layers(gpkgs: list[tuple[str, Path]], derived: Path) -> dict[str, gpd.GeoDataFrame]:
    context_poly = box(*CONTEXT)
    combined: dict[str, gpd.GeoDataFrame] = {}
    for layer in LAYERS:
        chunks = []
        for cell, gpkg in gpkgs:
            gdf = load_layer(gpkg, layer, cell)
            if gdf is not None:
                chunks.append(gdf)
        if not chunks:
            continue
        frame = gpd.GeoDataFrame(pd.concat(chunks, ignore_index=True), crs=4326)
        frame = frame[frame.intersects(context_poly)].copy()
        if frame.empty:
            continue
        combined[layer] = frame
        out = derived / "vectors" / f"{layer}.geojson"
        out.parent.mkdir(parents=True, exist_ok=True)
        frame.to_file(out, driver="GeoJSON")
        print(f"{layer}: {len(frame)} features")
    return combined


def numeric_field(gdf: gpd.GeoDataFrame, candidates: list[str]) -> str | None:
    upper = {str(c).upper(): c for c in gdf.columns}
    for candidate in candidates:
        if candidate.upper() in upper:
            return upper[candidate.upper()]
    return None


def soundings_frame(layers: dict[str, gpd.GeoDataFrame]) -> gpd.GeoDataFrame:
    gdf = layers.get("SOUNDG")
    if gdf is None or gdf.empty:
        return gpd.GeoDataFrame(columns=["depth_m", "geometry"], geometry="geometry", crs=4326)
    gdf = gdf.explode(index_parts=False).reset_index(drop=True)
    field = numeric_field(gdf, ["DEPTH", "VALSOU", "VALDCO"])
    if field is None:
        for col in gdf.columns:
            if "DEPTH" in str(col).upper():
                field = col
                break
    if field is None:
        return gpd.GeoDataFrame(columns=["depth_m", "geometry"], geometry="geometry", crs=4326)
    gdf["depth_m"] = pd.to_numeric(gdf[field], errors="coerce")
    gdf = gdf[np.isfinite(gdf["depth_m"]) & (gdf["depth_m"] >= 0)].copy()
    return gdf


def contour_points(layers: dict[str, gpd.GeoDataFrame], spacing_m: float = 150.0) -> gpd.GeoDataFrame:
    gdf = layers.get("DEPCNT")
    if gdf is None or gdf.empty:
        return gpd.GeoDataFrame(columns=["depth_m", "geometry"], geometry="geometry", crs=4326)
    field = numeric_field(gdf, ["VALDCO", "DEPTH"])
    if field is None:
        return gpd.GeoDataFrame(columns=["depth_m", "geometry"], geometry="geometry", crs=4326)
    utm = gdf.to_crs(32653)
    rows = []
    back = Transformer.from_crs(32653, 4326, always_xy=True)
    for _, row in utm.iterrows():
        depth = pd.to_numeric(pd.Series([row[field]]), errors="coerce").iloc[0]
        geom = row.geometry
        if not np.isfinite(depth) or geom is None or geom.is_empty:
            continue
        lines = list(geom.geoms) if geom.geom_type == "MultiLineString" else [geom]
        for line in lines:
            count = max(2, int(math.ceil(line.length / spacing_m)) + 1)
            for d in np.linspace(0, line.length, count):
                p = line.interpolate(float(d))
                lon, lat = back.transform(p.x, p.y)
                rows.append({"depth_m": float(depth), "evidence": "DEPCNT", "geometry": gpd.points_from_xy([lon], [lat])[0]})
    return gpd.GeoDataFrame(rows, crs=4326)


def stats(values: np.ndarray) -> dict[str, float | int | None]:
    values = values[np.isfinite(values)]
    if values.size == 0:
        return {"count": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None}
    return {
        "count": int(values.size),
        "min": float(np.min(values)),
        "p05": float(np.percentile(values, 5)),
        "median": float(np.median(values)),
        "p95": float(np.percentile(values, 95)),
        "max": float(np.max(values)),
    }


def build_candidate_grid(soundings: gpd.GeoDataFrame, contours: gpd.GeoDataFrame, derived: Path) -> dict[str, object]:
    core_poly = box(*CORE)
    snd = soundings[soundings.intersects(core_poly)].copy()
    cnt = contours[contours.intersects(core_poly)].copy()
    evidence = []
    if not snd.empty:
        a = snd[["depth_m", "geometry"]].copy(); a["quality"] = 1.0; a["kind"] = "SOUNDG"; evidence.append(a)
    if not cnt.empty:
        b = cnt[["depth_m", "geometry"]].copy(); b["quality"] = 0.35; b["kind"] = "DEPCNT"; evidence.append(b)
    if not evidence:
        return {"built": False, "reason": "no SOUNDG or DEPCNT evidence in core"}
    pts = gpd.GeoDataFrame(pd.concat(evidence, ignore_index=True), crs=4326).to_crs(32653)
    xy = np.array([[p.x, p.y] for p in pts.geometry])
    depth = pts["depth_m"].to_numpy(float)
    quality = pts["quality"].to_numpy(float)
    tree = cKDTree(xy)

    fwd = Transformer.from_crs(4326, 32653, always_xy=True)
    west, south = fwd.transform(CORE[0], CORE[1])
    east, north = fwd.transform(CORE[2], CORE[3])
    resolution = 25.0
    width = int(math.ceil((east - west) / resolution))
    height = int(math.ceil((north - south) / resolution))
    xs = west + (np.arange(width) + 0.5) * resolution
    ys = north - (np.arange(height) + 0.5) * resolution
    xx, yy = np.meshgrid(xs, ys)
    query = np.c_[xx.ravel(), yy.ravel()]
    k = min(12, len(xy))
    dist, idx = tree.query(query, k=k)
    if k == 1:
        dist = dist[:, None]; idx = idx[:, None]
    dvals = depth[idx]
    qvals = quality[idx]
    weights = qvals / np.square(dist + 5.0)
    z = np.sum(weights * dvals, axis=1) / np.sum(weights, axis=1)
    spread = np.sqrt(np.sum(weights * np.square(dvals - z[:, None]), axis=1) / np.sum(weights, axis=1))
    nearest = dist[:, 0]
    uncertainty = spread + 0.025 * nearest
    valid = nearest <= 800.0
    nodata = -9999.0
    z = np.where(valid, z, nodata).reshape(height, width).astype("float32")
    uncertainty = np.where(valid, uncertainty, nodata).reshape(height, width).astype("float32")
    nearest = np.where(valid, nearest, nodata).reshape(height, width).astype("float32")
    transform = from_origin(west, north, resolution, resolution)
    profile = {
        "driver": "GTiff", "height": height, "width": width, "count": 1,
        "dtype": "float32", "crs": "EPSG:32653", "transform": transform,
        "nodata": nodata, "compress": "deflate", "tiled": True,
    }
    grids = derived / "grids"; grids.mkdir(parents=True, exist_ok=True)
    for name, data in [("candidate_depth_chart_datum_m.tif", z), ("candidate_uncertainty_m.tif", uncertainty), ("nearest_evidence_distance_m.tif", nearest)]:
        with rasterio.open(grids / name, "w", **profile) as dst:
            dst.write(data, 1)
            dst.update_tags(
                WORLD_STATUS="CANDIDATE_NOT_SURVEY_TRUTH",
                VERTICAL_DATUM="NOAA_ENC_CHART_DATUM_UNRESOLVED",
                SOURCE="SOUNDG exact + DEPCNT lower-weight constraints",
            )
    return {
        "built": True,
        "resolutionM": resolution,
        "shape": [height, width],
        "validFraction": float(np.mean(valid)),
        "evidenceCount": int(len(pts)),
        "exactSoundingCount": int(len(snd)),
        "contourConstraintCount": int(len(cnt)),
        "maxInterpolationDistanceM": 800.0,
        "status": "CANDIDATE_NOT_SURVEY_TRUTH",
    }


def survey_counts(intake: Path) -> dict[str, object]:
    result: dict[str, object] = {}
    for path in sorted((intake / "metadata/noaa_surveys").glob("*.geojson")):
        try:
            doc = json.loads(path.read_text())
            result[path.stem] = {"featureCount": len(doc.get("features", []))}
        except Exception as exc:
            result[path.stem] = {"error": str(exc)}
    return result


def gmrt_summary(intake: Path) -> dict[str, object]:
    result: dict[str, object] = {}
    for name in ["airai_topo_max.tif", "airai_topo_mask_max.tif"]:
        path = intake / "raw/gmrt" / name
        if not path.exists():
            continue
        try:
            with rasterio.open(path) as ds:
                arr = ds.read(1, masked=True)
                vals = arr.compressed()
                result[name] = {"shape": [ds.height, ds.width], "crs": str(ds.crs), "stats": stats(vals.astype(float))}
        except Exception as exc:
            result[name] = {"error": str(exc)}
    return result


def make_preview(layers: dict[str, gpd.GeoDataFrame], soundings: gpd.GeoDataFrame, contours: gpd.GeoDataFrame, derived: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 9), dpi=160)
    ax.set_xlim(CONTEXT[0], CONTEXT[2]); ax.set_ylim(CONTEXT[1], CONTEXT[3]); ax.set_aspect("equal")
    if "LNDARE" in layers: layers["LNDARE"].plot(ax=ax, alpha=0.35, edgecolor="black", linewidth=0.35)
    if "COALNE" in layers: layers["COALNE"].plot(ax=ax, linewidth=0.5)
    if not contours.empty: contours.plot(ax=ax, column="depth_m", linewidth=0.45, legend=False)
    if not soundings.empty: soundings.plot(ax=ax, column="depth_m", markersize=7, legend=True)
    core = box(*CORE)
    gpd.GeoSeries([core], crs=4326).boundary.plot(ax=ax, linewidth=1.5)
    ax.scatter([ANCHOR[0]], [ANCHOR[1]], marker="x", s=55)
    ax.set_title("Airai reef bathymetry evidence: NOAA ENC SOUNDG / DEPCNT")
    ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
    fig.tight_layout()
    preview = derived / "preview"; preview.mkdir(parents=True, exist_ok=True)
    fig.savefig(preview / "airai_enc_bathymetry_evidence.png")
    plt.close(fig)


def build(intake: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    work = output / "_work"
    if work.exists(): shutil.rmtree(work)
    work.mkdir(parents=True)
    sources = extract_encs(intake, work)
    gpkgs = []
    for cell, base in sources:
        gpkg = convert_cell(cell, base, work)
        if gpkg: gpkgs.append((cell, gpkg))
    layers = combine_layers(gpkgs, output)
    soundings = soundings_frame(layers)
    contours = contour_points(layers)
    vectors = output / "vectors"; vectors.mkdir(parents=True, exist_ok=True)
    if not soundings.empty:
        soundings.to_file(vectors / "SOUNDG_NORMALIZED.geojson", driver="GeoJSON")
        pd.DataFrame({
            "lon": soundings.geometry.x, "lat": soundings.geometry.y,
            "depth_m_chart_datum": soundings["depth_m"], "enc_cell": soundings.get("_enc_cell", "")
        }).to_csv(vectors / "SOUNDG_NORMALIZED.csv", index=False)
    if not contours.empty:
        contours.to_file(vectors / "DEPCNT_SAMPLED_POINTS.geojson", driver="GeoJSON")

    context_poly = box(*CONTEXT); core_poly = box(*CORE)
    context_snd = soundings[soundings.intersects(context_poly)] if not soundings.empty else soundings
    core_snd = soundings[soundings.intersects(core_poly)] if not soundings.empty else soundings
    core_values = core_snd["depth_m"].to_numpy(float) if not core_snd.empty else np.array([])
    assumption = {
        "soundingsBetween60And70M": int(np.sum((core_values >= 60) & (core_values <= 70))) if core_values.size else 0,
        "soundingsDeeperThan100M": int(np.sum(core_values > 100)) if core_values.size else 0,
        "userWorkingHypothesis": "channels around 60-70 m; reef interior usually below 100 m",
        "status": "EVIDENCE_PENDING" if core_values.size < 10 else "CHECKED_AGAINST_CURRENT_ENC_SOUNDINGS",
        "warning": "Sparse chart soundings cannot prove a continuous maximum depth.",
    }
    grid = build_candidate_grid(soundings, contours, output)
    make_preview(layers, soundings, contours, output)

    report = {
        "schema": "kaopu.palau.airai-reef-evidence/1.0",
        "contextBBoxWGS84": CONTEXT,
        "coreBBoxWGS84": CORE,
        "userConfirmedAnchorWGS84": ANCHOR,
        "encCellsConverted": [cell for cell, _ in gpkgs],
        "layerCounts": {name: int(len(gdf)) for name, gdf in layers.items()},
        "soundingsContext": stats(context_snd["depth_m"].to_numpy(float)) if not context_snd.empty else stats(np.array([])),
        "soundingsCore": stats(core_values),
        "depthHypothesisCheck": assumption,
        "candidateGrid": grid,
        "noaaSurveyCoverage": survey_counts(intake),
        "gmrt": gmrt_summary(intake),
        "verticalDatum": "NOAA ENC chart datum unresolved; M_SDAT retained separately",
        "truthBoundary": "Only source observations are evidence. Interpolated grid is a candidate expression with NoData and uncertainty.",
        "visualAcceptance": False,
    }
    (output / "AIRAI_REEF_EVIDENCE_REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    html = f"""<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Airai Reef Bathymetry Evidence R01</title><style>body{{font:15px/1.6 system-ui;margin:0;background:#071820;color:#eaf4ef}}main{{max-width:1050px;margin:auto;padding:28px}}section{{background:#0d2730;border:1px solid #ffffff20;border-radius:18px;padding:18px;margin:14px 0}}img{{max-width:100%;border-radius:14px}}code,pre{{white-space:pre-wrap;color:#c8e9df}}</style><main>
<h1>Airai 礁盘内水深证据 R01</h1><section><b>一个总指挥：</b>PalauWorld.sample()。本页只显示证据，不把插值冒充测绘真值。</section>
<section><h2>当前统计</h2><pre>{json.dumps(report, ensure_ascii=False, indent=2)}</pre></section>
<section><h2>NOAA ENC 证据图</h2><img src='preview/airai_enc_bathymetry_evidence.png'></section>
</main>"""
    (output / "index.html").write_text(html, encoding="utf-8")

    manifest = []
    for path in sorted(output.rglob("*")):
        if path.is_file() and "_work" not in path.parts and path.name != "MANIFEST.sha256":
            manifest.append(f"{sha256(path)}  {path.relative_to(output).as_posix()}")
    (output / "MANIFEST.sha256").write_text("\n".join(manifest) + "\n")
    shutil.rmtree(work, ignore_errors=True)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--intake", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    build(args.intake.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
