from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

RAW_NAME = "guilin_raw_union_12_5m.tif"
RAW_BYTES = 124_348_471
RAW_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
RAW_GRID = [17_408, 18_867]
CRS = "EPSG:32649"
SPACING = 12.5
NODATA = 0
AOI_BOUNDS = [380_331.8, 2_705_928.1, 530_128.2, 2_926_987.2]
AOI_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
HYDRO_BYTES = 5_832_414
HYDRO_BLOB_SHA1 = "c00174242b68106cec9febcf24e0b94464b3727c"
HYDRO_SHA256 = "be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df"
TILE_SIZE = 2_048
STRIDE = 2_047
TILE_BYTES = 8_388_608
CANONICAL_BRANCH = "project/guilin-native-12p5m-single-truth"
CANONICAL_TAG = "guilin-native-12p5m-single-truth-v001"
PUBLIC_URL = "https://haihao0307.github.io/guilin-dem-pipeline/guilin/"
ANCHORS = (
    {"id": "zhenbaoding", "name": "真宝鼎", "e": 482_534.530462443, "n": 2_890_708.122979571},
    {"id": "guilin", "name": "桂林城", "e": 429_459.239540243, "n": 2_795_494.225020682},
    {"id": "yangtang", "name": "秧塘机场", "e": 414_949.565810143, "n": 2_789_301.889164384},
    {"id": "yangshuo", "name": "阳朔县", "e": 448_648.462659552, "n": 2_740_850.767499203},
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha1(path: Path) -> str:
    payload = path.read_bytes()
    digest = hashlib.sha1()
    digest.update(f"blob {len(payload)}\0".encode("ascii"))
    digest.update(payload)
    return digest.hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def aoi_window(dataset: rasterio.io.DatasetReader) -> tuple[int, int, int, int]:
    west, south, east, north = AOI_BOUNDS
    transform = dataset.transform
    epsilon = 1e-9
    col0 = max(0, math.ceil((west - transform.c) / SPACING - 0.5 - epsilon))
    col1 = min(dataset.width - 1, math.floor((east - transform.c) / SPACING - 0.5 + epsilon))
    row0 = max(0, math.ceil((transform.f - north) / SPACING - 0.5 - epsilon))
    row1 = min(dataset.height - 1, math.floor((transform.f - south) / SPACING - 0.5 + epsilon))
    if col1 < col0 or row1 < row0:
        raise RuntimeError("AOI has no native sample centers")
    return col0, row0, col1 - col0 + 1, row1 - row0 + 1


def tile_for_index(row0: int, col0: int, source_row: int, source_col: int) -> tuple[int, int]:
    return (source_row - row0) // STRIDE, (source_col - col0) // STRIDE


def validate_and_manifest(source: Path, tile_dir: Path) -> tuple[dict, dict]:
    if source.name != RAW_NAME or source.stat().st_size != RAW_BYTES or sha256(source) != RAW_SHA256:
        raise RuntimeError("source TIFF identity failed")
    with rasterio.open(source) as ds:
        if str(ds.crs) != CRS or [ds.width, ds.height] != RAW_GRID or ds.count != 1 or ds.dtypes[0] != "int16" or ds.nodata != NODATA:
            raise RuntimeError("source raster contract failed")
        if not math.isclose(ds.transform.a, SPACING, abs_tol=1e-9) or not math.isclose(ds.transform.e, -SPACING, abs_tol=1e-9):
            raise RuntimeError("source spacing failed")
        col0, row0, width, height = aoi_window(ds)
        rows = math.ceil((height - 1) / STRIDE)
        cols = math.ceil((width - 1) / STRIDE)
        if [rows, cols] != [9, 6]:
            raise RuntimeError(f"unexpected matrix {rows}x{cols}")
        anchor_map: dict[str, str] = {}
        anchors_by_tile: dict[str, list[dict]] = {}
        for anchor in ANCHORS:
            sr, sc = ds.index(anchor["e"], anchor["n"])
            tr, tc = tile_for_index(row0, col0, sr, sc)
            tile_id = f"native-r{tr:02d}-c{tc:02d}"
            anchor_map[anchor["id"]] = tile_id
            anchors_by_tile.setdefault(tile_id, []).append(dict(anchor))
        records: list[dict] = []
        arrays: dict[tuple[int, int], np.memmap] = {}
        horizontal = vertical = 0
        for tr in range(rows):
            for tc in range(cols):
                tile_id = f"native-r{tr:02d}-c{tc:02d}"
                filename = f"{tile_id}-2048x2048-i16.bin"
                path = tile_dir / filename
                if not path.is_file() or path.stat().st_size != TILE_BYTES:
                    raise RuntimeError(f"missing or malformed tile {filename}")
                array = np.memmap(path, dtype="<i2", mode="r", shape=(TILE_SIZE, TILE_SIZE))
                arrays[(tr, tc)] = array
                rel_col = tc * STRIDE
                rel_row = tr * STRIDE
                valid_width = min(TILE_SIZE, width - rel_col)
                valid_height = min(TILE_SIZE, height - rel_row)
                source_col = col0 + rel_col
                source_row = row0 + rel_row
                expected = ds.read(1, window=Window(source_col, source_row, valid_width, valid_height))
                if not np.array_equal(array[:valid_height, :valid_width], expected):
                    raise RuntimeError(f"source sample mismatch {tile_id}")
                if valid_width < TILE_SIZE and np.any(array[:valid_height, valid_width:] != 0):
                    raise RuntimeError(f"east padding mismatch {tile_id}")
                if valid_height < TILE_SIZE and np.any(array[valid_height:, :] != 0):
                    raise RuntimeError(f"south padding mismatch {tile_id}")
                valid = expected != NODATA
                values = expected[valid]
                first = ds.xy(source_row, source_col, offset="center")
                last = ds.xy(source_row + valid_height - 1, source_col + valid_width - 1, offset="center")
                west_edge = ds.xy(source_row, source_col, offset="ul")[0]
                north_edge = ds.xy(source_row, source_col, offset="ul")[1]
                east_edge = ds.xy(source_row, source_col + valid_width - 1, offset="ur")[0]
                south_edge = ds.xy(source_row + valid_height - 1, source_col, offset="ll")[1]
                records.append({
                    "id": tile_id,
                    "matrix_index": [tr, tc],
                    "file": filename,
                    "sha256": sha256(path),
                    "stored_bytes": TILE_BYTES,
                    "stored_grid": [TILE_SIZE, TILE_SIZE],
                    "valid_grid": [valid_width, valid_height],
                    "source_window": [source_col, source_row, valid_width, valid_height],
                    "source_sample_center_bounds_epsg32649": [first[0], last[1], last[0], first[1]],
                    "source_cell_edge_bounds_epsg32649": [west_edge, south_edge, east_edge, north_edge],
                    "valid_sample_count": int(valid.sum()),
                    "native_nodata_sample_count": int(valid.size - valid.sum()),
                    "padding_nodata_sample_count": int(TILE_SIZE * TILE_SIZE - expected.size),
                    "elevation_range_m": [int(values.min()), int(values.max())] if values.size else [None, None],
                    "encoding": "int16-little-endian-raw-elevation-m",
                    "compression": "none",
                    "quantization": "none",
                    "nodata": NODATA,
                    "resampling": "none",
                    "source_elevation_modified_m": 0.0,
                    "anchors": anchors_by_tile.get(tile_id, []),
                })
        for tr in range(rows):
            for tc in range(cols - 1):
                left, right = records[tr * cols + tc], records[tr * cols + tc + 1]
                count = min(left["valid_grid"][1], right["valid_grid"][1])
                if not np.array_equal(arrays[(tr, tc)][:count, STRIDE], arrays[(tr, tc + 1)][:count, 0]):
                    raise RuntimeError(f"horizontal seam mismatch {tr},{tc}")
                horizontal += 1
        for tr in range(rows - 1):
            for tc in range(cols):
                top, bottom = records[tr * cols + tc], records[(tr + 1) * cols + tc]
                count = min(top["valid_grid"][0], bottom["valid_grid"][0])
                if not np.array_equal(arrays[(tr, tc)][STRIDE, :count], arrays[(tr + 1, tc)][0, :count]):
                    raise RuntimeError(f"vertical seam mismatch {tr},{tc}")
                vertical += 1
        first = ds.xy(row0, col0, offset="center")
        last = ds.xy(row0 + height - 1, col0 + width - 1, offset="center")
    manifest = {
        "schema": "guilin-canonical-native-dem/v1",
        "status": "sole_authoritative",
        "canonical_identity": {"sole_guilin_dem_truth": True, "effective_date": "2026-08-29", "release_tag": CANONICAL_TAG, "public_review_url": PUBLIC_URL},
        "source": {"file": RAW_NAME, "bytes": RAW_BYTES, "sha256": RAW_SHA256, "crs": CRS, "grid": RAW_GRID, "resolution_m": [SPACING, SPACING], "dtype": "int16", "nodata": NODATA, "read_only": True},
        "aoi": {"status": "ACCEPTED", "geometry_sha256": AOI_SHA256, "bounds_epsg32649": AOI_BOUNDS, "native_sample_window": [col0, row0, width, height], "native_sample_center_bounds_epsg32649": [first[0], last[1], last[0], first[1]]},
        "tile_matrix": {"rows": 9, "columns": 6, "stored_grid": [TILE_SIZE, TILE_SIZE], "stride_samples": [STRIDE, STRIDE], "shared_edge_samples": 1, "expected_tile_bytes": TILE_BYTES, "full_matrix_tile_count": 54, "built_tile_count": 54, "encoding": "int16-little-endian-raw-elevation-m", "compression": "none", "quantization": "none", "resampling": "none", "edge_padding": "NoData 0 on east and south edge tiles only"},
        "anchor_tile_map": anchor_map,
        "tiles": records,
        "rules": {"sole_authoritative_guilin_dem": True, "source_resampling": False, "source_reencoding": False, "source_recompression": False, "tile_compression": "none", "quantization": "none", "gap_fill_applied": False, "fallback_30m_used": False, "source_elevation_modified_m": 0.0, "vertical_scale": 1.0, "height_image_texture_used": False, "direct_numeric_vertex_geometry": True, "lake_surface_asset_emitted": False, "reservoir_surface_asset_emitted": False, "manual_centerline_added": False, "synthetic_gap_line_added": False, "public_review_deployment": True, "legacy_procedural_terrain_runtime_allowed": False, "geometry_generation": "direct_numeric_vertex_geometry_only", "terrain_texture_input_allowed": False, "canonical_data_root": "canonical_release"},
    }
    receipt = {"schema": "guilin-canonical-native-dem-validation/v1", "passed": True, "source_sha256": RAW_SHA256, "tile_count": 54, "stored_bytes": 54 * TILE_BYTES, "horizontal_shared_edges_checked": horizontal, "vertical_shared_edges_checked": vertical, "source_sample_identity": True, "compression": "none", "resampling": "none", "gap_fill": False, "fallback_30m": False, "source_elevation_modified_m": 0.0}
    return manifest, receipt
