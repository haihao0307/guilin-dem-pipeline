#!/usr/bin/env python3
"""Download exact GEBCO_2026 and TID subsets from official CEDA GeoTIFF tiles.

The source tiles remain identified by the CEDA JSON catalogue. GDAL HTTP range
requests read only the WGS84 envelope required to cover the complete aligned
EPSG:32651 coastal model grid. The TID subset is nearest-neighbour aligned to
the exact bathymetry subset grid because the official source tiles can differ
by a sub-pixel registration offset.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/coastal_domain_v100.json"
RAW_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/raw/gebco_2026"
REPORT_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json"

GRID_CATALOGUE = (
    "https://data.ceda.ac.uk/bodc/gebco/global/gebco_2026/"
    "ice_surface_elevation/geotiff?json="
)
TID_CATALOGUE = (
    "https://data.ceda.ac.uk/bodc/gebco/global/gebco_2026/"
    "type_identifier_grid/geotiff?json="
)
GRID_TILE = "gebco_2026_n90.0_s0.0_w90.0_e180.0_geotiff.tif"
TID_TILE = "gebco_2026_tid_n90.0_s0.0_w90.0_e180.0_geotiff.tif"
EXPECTED_CRS = "EPSG:4326"
EXPECTED_TILE_BOUNDS = [90.0, 0.0, 180.0, 90.0]
EXPECTED_RESOLUTION = 1.0 / 240.0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "WenzhouCoastalPipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        if getattr(response, "status", 200) != 200:
            raise RuntimeError(f"CEDA catalogue returned HTTP {response.status}: {url}")
        return json.load(response)


def catalogue_item(catalogue_url: str, filename: str) -> dict[str, Any]:
    payload = fetch_json(catalogue_url)
    matches = [
        item
        for item in payload.get("items", [])
        if item.get("type") == "file" and item.get("name") == filename
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"CEDA catalogue did not contain one exact file {filename}: "
            f"found {len(matches)}"
        )
    item = matches[0]
    required = ("download", "size", "md5", "last_modified", "path")
    missing = [key for key in required if not item.get(key)]
    if missing:
        raise RuntimeError(f"CEDA item lacks required identity metadata {missing}: {item}")
    if not str(item["download"]).startswith("https://dap.ceda.ac.uk/"):
        raise RuntimeError(f"Unexpected non-CEDA download URL: {item['download']}")
    return item


def aligned_projected_bounds(config: dict[str, Any]) -> list[float]:
    spacing = float(config["domains"]["coastalModelGrid"]["pixelSpacingMeters"][0])
    bounds = config["domains"]["bathymetryAndTideBoundaryProjected"]["bounds"]
    return [
        math.floor(bounds[0] / spacing) * spacing,
        math.floor(bounds[1] / spacing) * spacing,
        math.ceil(bounds[2] / spacing) * spacing,
        math.ceil(bounds[3] / spacing) * spacing,
    ]


def derive_source_read_bounds(config: dict[str, Any]) -> tuple[list[float], list[float]]:
    """Densify the aligned UTM boundary, transform to WGS84 and pad two source cells."""
    from pyproj import Transformer

    projected = aligned_projected_bounds(config)
    left, bottom, right, top = projected
    transformer = Transformer.from_crs("EPSG:32651", "EPSG:4326", always_xy=True)
    samples: list[tuple[float, float]] = []
    for index in range(101):
        ratio = index / 100.0
        samples.extend(
            [
                (left + ratio * (right - left), bottom),
                (left + ratio * (right - left), top),
                (left, bottom + ratio * (top - bottom)),
                (right, bottom + ratio * (top - bottom)),
            ]
        )
    transformed = [transformer.transform(x, y) for x, y in samples]
    longitudes = [item[0] for item in transformed]
    latitudes = [item[1] for item in transformed]
    padding = 2.0 * EXPECTED_RESOLUTION
    source_bounds = [
        min(longitudes) - padding,
        min(latitudes) - padding,
        max(longitudes) + padding,
        max(latitudes) + padding,
    ]
    return projected, source_bounds


def source_window(dataset: Any, bounds: list[float]) -> Any:
    from rasterio.windows import Window, from_bounds

    floating = from_bounds(*bounds, transform=dataset.transform)
    col_start = math.floor(floating.col_off)
    row_start = math.floor(floating.row_off)
    col_stop = math.ceil(floating.col_off + floating.width)
    row_stop = math.ceil(floating.row_off + floating.height)
    col_start = max(0, col_start)
    row_start = max(0, row_start)
    col_stop = min(dataset.width, col_stop)
    row_stop = min(dataset.height, row_stop)
    if col_stop <= col_start or row_stop <= row_start:
        raise RuntimeError(f"Requested bounds do not intersect source tile: {bounds}")
    return Window(col_start, row_start, col_stop - col_start, row_stop - row_start)


def assert_close(actual: float, expected: float, tolerance: float = 1e-9) -> None:
    if not math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance):
        raise RuntimeError(f"Value mismatch: observed {actual}, expected {expected}")


def validate_remote_dataset(dataset: Any, role: str) -> dict[str, Any]:
    crs = dataset.crs.to_string() if dataset.crs else None
    if crs != EXPECTED_CRS:
        raise RuntimeError(f"{role} source CRS mismatch: {crs}")
    if dataset.width != 21600 or dataset.height != 21600:
        raise RuntimeError(
            f"{role} source dimensions mismatch: {dataset.width} x {dataset.height}"
        )
    observed_bounds = [
        dataset.bounds.left,
        dataset.bounds.bottom,
        dataset.bounds.right,
        dataset.bounds.top,
    ]
    for actual, expected in zip(observed_bounds, EXPECTED_TILE_BOUNDS, strict=True):
        assert_close(actual, expected, tolerance=0.01)
    assert_close(abs(dataset.res[0]), EXPECTED_RESOLUTION, tolerance=1e-9)
    assert_close(abs(dataset.res[1]), EXPECTED_RESOLUTION, tolerance=1e-9)
    if dataset.count != 1:
        raise RuntimeError(f"{role} source must contain one band, found {dataset.count}")
    return {
        "crs": crs,
        "width": dataset.width,
        "height": dataset.height,
        "dtype": dataset.dtypes[0],
        "nodata": dataset.nodata,
        "transform": list(dataset.transform)[:6],
        "resolution": [abs(dataset.res[0]), abs(dataset.res[1])],
        "bounds": observed_bounds,
    }


def write_cog(
    destination: Path,
    array: np.ndarray,
    transform: Any,
    crs: Any,
    nodata: float | int | None,
    role: str,
    source_item: dict[str, Any],
    registration_note: str,
) -> None:
    import rasterio
    from rasterio.shutil import copy as raster_copy

    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="wenzhou-gebco-subset-") as temporary_directory:
        source_path = Path(temporary_directory) / "source.tif"
        predictor = 2 if np.issubdtype(array.dtype, np.integer) else 3
        profile = {
            "driver": "GTiff",
            "height": array.shape[0],
            "width": array.shape[1],
            "count": 1,
            "dtype": str(array.dtype),
            "crs": crs,
            "transform": transform,
            "nodata": nodata,
            "tiled": True,
            "blockxsize": 256,
            "blockysize": 256,
            "compress": "DEFLATE",
            "predictor": predictor,
        }
        with rasterio.open(source_path, "w", **profile) as target:
            target.write(array, 1)
            target.update_tags(
                SOURCE_DATASET="GEBCO_2026",
                SOURCE_ROLE=role,
                SOURCE_TILE=source_item["name"],
                SOURCE_TILE_BYTES=str(source_item["size"]),
                SOURCE_TILE_MD5=source_item["md5"],
                SOURCE_TILE_LAST_MODIFIED=source_item["last_modified"],
                SOURCE_URL=source_item["download"],
                EXTRACTION_METHOD="GDAL HTTP range window from official CEDA tile",
                SOURCE_RESOLUTION="15 arc-second",
                REGISTRATION_NOTE=registration_note,
            )
        raster_copy(
            source_path,
            destination,
            driver="COG",
            compress="DEFLATE",
            blocksize=256,
            overview_resampling="nearest" if role == "type_identifier" else "average",
        )


def inspect_local(path: Path) -> dict[str, Any]:
    import rasterio

    with rasterio.open(path) as dataset:
        return {
            "path": str(path.relative_to(REPO_ROOT)),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "driver": dataset.driver,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "width": dataset.width,
            "height": dataset.height,
            "dtype": dataset.dtypes[0],
            "nodata": dataset.nodata,
            "resolution": [abs(dataset.res[0]), abs(dataset.res[1])],
            "bounds": [
                dataset.bounds.left,
                dataset.bounds.bottom,
                dataset.bounds.right,
                dataset.bounds.top,
            ],
            "blockShapes": [list(shape) for shape in dataset.block_shapes],
            "overviews": dataset.overviews(1),
            "imageStructure": dataset.tags(ns="IMAGE_STRUCTURE"),
            "tags": dataset.tags(),
        }


def main() -> int:
    report: dict[str, Any] = {
        "schema": "wenzhou_gebco_2026_acquisition@1.3.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "dataset": "GEBCO_2026 Grid and Type Identifier Grid",
        "source": "NERC CEDA official archive",
        "passed": False,
    }
    try:
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.warp import reproject
        from rasterio.windows import transform as window_transform

        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        configured_bounds = config["domains"]["bathymetryAndTideBoundaryWgs84"]["bounds"]
        target_projected_bounds, source_read_bounds = derive_source_read_bounds(config)
        grid_item = catalogue_item(GRID_CATALOGUE, GRID_TILE)
        tid_item = catalogue_item(TID_CATALOGUE, TID_TILE)

        environment = {
            "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
            "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.tiff",
            "GDAL_HTTP_MULTIRANGE": "YES",
            "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
            "VSI_CACHE": "TRUE",
            "VSI_CACHE_SIZE": "50000000",
        }

        grid_source_url = f"/vsicurl/{grid_item['download']}"
        with rasterio.Env(**environment):
            with rasterio.open(grid_source_url) as grid_source:
                grid_source_metadata = validate_remote_dataset(grid_source, "bathymetry")
                grid_window = source_window(grid_source, source_read_bounds)
                grid_data = grid_source.read(1, window=grid_window)
                target_transform = window_transform(grid_window, grid_source.transform)
                target_crs = grid_source.crs
                target_shape = grid_data.shape
                target_nodata = grid_source.nodata

        grid_destination = RAW_ROOT / "WENZHOU_GEBCO_2026_BATHY_NATIVE.tif"
        write_cog(
            grid_destination,
            grid_data,
            target_transform,
            target_crs,
            target_nodata,
            "bathymetry",
            grid_item,
            "Native GEBCO source window covering the complete aligned EPSG:32651 model grid",
        )

        tid_source_url = f"/vsicurl/{tid_item['download']}"
        tid_data = np.full(target_shape, 255, dtype="uint8")
        with rasterio.Env(**environment):
            with rasterio.open(tid_source_url) as tid_source:
                tid_source_metadata = validate_remote_dataset(tid_source, "type_identifier")
                reproject(
                    source=rasterio.band(tid_source, 1),
                    destination=tid_data,
                    src_transform=tid_source.transform,
                    src_crs=tid_source.crs,
                    src_nodata=tid_source.nodata,
                    dst_transform=target_transform,
                    dst_crs=target_crs,
                    dst_nodata=255,
                    resampling=Resampling.nearest,
                    num_threads=2,
                )

        tid_destination = RAW_ROOT / "WENZHOU_GEBCO_2026_TID_NATIVE.tif"
        write_cog(
            tid_destination,
            tid_data,
            target_transform,
            target_crs,
            255,
            "type_identifier",
            tid_item,
            "Nearest-neighbour aligned to the expanded bathymetry source window",
        )

        outputs = [inspect_local(grid_destination), inspect_local(tid_destination)]
        grid_output, tid_output = outputs
        if grid_output["width"] != tid_output["width"] or grid_output["height"] != tid_output["height"]:
            raise RuntimeError("Final bathymetry and TID dimensions differ")
        if grid_output["bounds"] != tid_output["bounds"]:
            raise RuntimeError("Final bathymetry and TID bounds differ")
        if grid_output["resolution"] != tid_output["resolution"]:
            raise RuntimeError("Final bathymetry and TID resolutions differ")

        report.update(
            {
                "passed": True,
                "configuredCoastalBoundsWgs84": configured_bounds,
                "targetModelBoundsProjected": target_projected_bounds,
                "sourceReadBoundsWgs84": source_read_bounds,
                "sourceReadPaddingArcSeconds": 30.0,
                "sourceCatalogues": {
                    "grid": GRID_CATALOGUE,
                    "tid": TID_CATALOGUE,
                },
                "sourceTiles": {
                    "grid": grid_item,
                    "tid": tid_item,
                },
                "sourceRasterMetadata": {
                    "grid": grid_source_metadata,
                    "tid": tid_source_metadata,
                },
                "bathymetrySourceWindow": [
                    int(grid_window.col_off),
                    int(grid_window.row_off),
                    int(grid_window.width),
                    int(grid_window.height),
                ],
                "subsetTransform": list(target_transform)[:6],
                "subsetShape": list(target_shape),
                "tidAlignment": {
                    "method": "nearest-neighbour reprojection to bathymetry source window",
                    "reason": "official grid and TID tiles use a sub-pixel registration offset",
                },
                "outputs": outputs,
                "doi": "10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa",
                "attribution": (
                    "GEBCO Bathymetric Compilation Group 2026 (2026). "
                    "The GEBCO_2026 Grid, NERC EDS BODC NOC."
                ),
            }
        )
    except Exception as exc:
        report["error"] = type(exc).__name__
        report["detail"] = str(exc)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
