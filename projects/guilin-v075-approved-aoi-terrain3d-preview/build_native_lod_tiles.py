from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import rasterio
from rasterio.windows import Window

RAW_TIFF_NAME = "guilin_raw_union_12_5m.tif"
RAW_TIFF_SIZE = 124_348_471
RAW_TIFF_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
RAW_SOURCE_GRID = [17_408, 18_867]
RAW_SOURCE_RESOLUTION_M = 12.5
RAW_SOURCE_CRS = "EPSG:32649"
RAW_SOURCE_NODATA = 0
AOI_BOUNDS = [380_331.8, 2_705_928.1, 530_128.2, 2_926_987.2]
AOI_GEOMETRY_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
TILE_SIZE = 2_048
TILE_STRIDE = TILE_SIZE - 1
TILE_BYTES = TILE_SIZE * TILE_SIZE * 2

ANCHORS = (
    {"id": "zhenbaoding", "name": "真寶鼎", "e": 482_534.530462443, "n": 2_890_708.122979571},
    {"id": "guilin", "name": "桂林城", "e": 429_459.239540243, "n": 2_795_494.225020682},
    {"id": "yangtang", "name": "秧塘機場", "e": 414_949.565810143, "n": 2_789_301.889164384},
    {"id": "yangshuo", "name": "陽朔縣", "e": 448_648.462659552, "n": 2_740_850.767499203},
)


@dataclass(frozen=True)
class SampleWindow:
    col_start: int
    row_start: int
    width: int
    height: int

    @property
    def col_stop(self) -> int:
        return self.col_start + self.width

    @property
    def row_stop(self) -> int:
        return self.row_start + self.height


@dataclass(frozen=True, order=True)
class TileKey:
    row: int
    col: int

    @property
    def identifier(self) -> str:
        return f"native-r{self.row:02d}-c{self.col:02d}"


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def validate_source(path: Path, dataset: rasterio.io.DatasetReader) -> None:
    if path.name != RAW_TIFF_NAME:
        raise RuntimeError(f"Unexpected source name: {path.name}")
    if path.stat().st_size != RAW_TIFF_SIZE:
        raise RuntimeError(f"Source byte count mismatch: {path.stat().st_size}")
    digest = sha256_file(path)
    if digest != RAW_TIFF_SHA256:
        raise RuntimeError(f"Source SHA256 mismatch: {digest}")
    if str(dataset.crs) != RAW_SOURCE_CRS:
        raise RuntimeError(f"Source CRS mismatch: {dataset.crs}")
    if [dataset.width, dataset.height] != RAW_SOURCE_GRID:
        raise RuntimeError(f"Source grid mismatch: {dataset.width} x {dataset.height}")
    if dataset.count != 1 or dataset.dtypes[0] != "int16":
        raise RuntimeError(f"Source data type mismatch: count={dataset.count}, dtype={dataset.dtypes[0]}")
    if dataset.nodata != RAW_SOURCE_NODATA:
        raise RuntimeError(f"Source NoData mismatch: {dataset.nodata}")
    if not math.isclose(dataset.transform.a, RAW_SOURCE_RESOLUTION_M, abs_tol=1e-9):
        raise RuntimeError(f"Source x resolution mismatch: {dataset.transform.a}")
    if not math.isclose(dataset.transform.e, -RAW_SOURCE_RESOLUTION_M, abs_tol=1e-9):
        raise RuntimeError(f"Source y resolution mismatch: {dataset.transform.e}")
    if dataset.transform.b != 0 or dataset.transform.d != 0:
        raise RuntimeError("Rotated source rasters are unsupported")


def center_inclusive_aoi_window(dataset: rasterio.io.DatasetReader) -> SampleWindow:
    west, south, east, north = AOI_BOUNDS
    transform = dataset.transform
    resolution = RAW_SOURCE_RESOLUTION_M
    epsilon = 1e-9

    col_start = math.ceil((west - transform.c) / resolution - 0.5 - epsilon)
    col_end = math.floor((east - transform.c) / resolution - 0.5 + epsilon)
    row_start = math.ceil((transform.f - north) / resolution - 0.5 - epsilon)
    row_end = math.floor((transform.f - south) / resolution - 0.5 + epsilon)

    col_start = max(0, col_start)
    row_start = max(0, row_start)
    col_end = min(dataset.width - 1, col_end)
    row_end = min(dataset.height - 1, row_end)
    if col_end < col_start or row_end < row_start:
        raise RuntimeError("Accepted AOI does not contain any native sample centers")

    window = SampleWindow(col_start, row_start, col_end - col_start + 1, row_end - row_start + 1)
    first_x, first_y = dataset.xy(window.row_start, window.col_start, offset="center")
    last_x, last_y = dataset.xy(window.row_stop - 1, window.col_stop - 1, offset="center")
    if not (west <= first_x <= east and west <= last_x <= east):
        raise RuntimeError("Computed x sample window escapes accepted AOI")
    if not (south <= first_y <= north and south <= last_y <= north):
        raise RuntimeError("Computed y sample window escapes accepted AOI")
    return window


def tile_count(sample_count: int) -> int:
    if sample_count <= 0:
        raise ValueError("sample_count must be positive")
    return max(1, math.ceil((sample_count - 1) / TILE_STRIDE))


def parse_tile_key(value: str) -> TileKey:
    pieces = value.split(",")
    if len(pieces) != 2:
        raise argparse.ArgumentTypeError("tile must be ROW,COL")
    try:
        return TileKey(row=int(pieces[0]), col=int(pieces[1]))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("tile must contain integer ROW,COL") from exc


def tile_for_source_index(aoi_window: SampleWindow, source_row: int, source_col: int) -> TileKey:
    relative_row = source_row - aoi_window.row_start
    relative_col = source_col - aoi_window.col_start
    if not (0 <= relative_row < aoi_window.height and 0 <= relative_col < aoi_window.width):
        raise RuntimeError(f"Source index outside accepted AOI: row={source_row}, col={source_col}")
    return TileKey(row=relative_row // TILE_STRIDE, col=relative_col // TILE_STRIDE)


def select_tiles(
    dataset: rasterio.io.DatasetReader,
    aoi_window: SampleWindow,
    include_all: bool,
    requested: Iterable[TileKey],
    anchor_ids: set[str],
) -> tuple[list[TileKey], dict[str, TileKey]]:
    rows = tile_count(aoi_window.height)
    cols = tile_count(aoi_window.width)
    selected: set[TileKey] = set()
    anchor_tiles: dict[str, TileKey] = {}

    if include_all:
        selected.update(TileKey(row=row, col=col) for row in range(rows) for col in range(cols))

    for key in requested:
        if not (0 <= key.row < rows and 0 <= key.col < cols):
            raise RuntimeError(f"Requested tile outside matrix: {key.identifier}")
        selected.add(key)

    for anchor in ANCHORS:
        if anchor["id"] not in anchor_ids:
            continue
        source_row, source_col = dataset.index(anchor["e"], anchor["n"])
        key = tile_for_source_index(aoi_window, source_row, source_col)
        selected.add(key)
        anchor_tiles[anchor["id"]] = key

    if not selected:
        raise RuntimeError("No tiles selected. Use --anchors, --tile, or --all-tiles")
    return sorted(selected), anchor_tiles


def tile_source_window(aoi_window: SampleWindow, key: TileKey) -> SampleWindow:
    relative_col = key.col * TILE_STRIDE
    relative_row = key.row * TILE_STRIDE
    if relative_col >= aoi_window.width or relative_row >= aoi_window.height:
        raise RuntimeError(f"Tile outside AOI matrix: {key.identifier}")
    width = min(TILE_SIZE, aoi_window.width - relative_col)
    height = min(TILE_SIZE, aoi_window.height - relative_row)
    return SampleWindow(
        col_start=aoi_window.col_start + relative_col,
        row_start=aoi_window.row_start + relative_row,
        width=width,
        height=height,
    )


def build_tile(
    dataset: rasterio.io.DatasetReader,
    aoi_window: SampleWindow,
    key: TileKey,
    output_dir: Path,
    anchors_by_tile: dict[TileKey, list[dict[str, Any]]],
) -> dict[str, Any]:
    source_window = tile_source_window(aoi_window, key)
    native = dataset.read(
        1,
        window=Window(source_window.col_start, source_window.row_start, source_window.width, source_window.height),
        boundless=False,
    )
    if native.dtype != np.int16:
        raise RuntimeError(f"Unexpected tile dtype: {native.dtype}")
    stored = np.zeros((TILE_SIZE, TILE_SIZE), dtype="<i2")
    stored[: source_window.height, : source_window.width] = native.astype("<i2", copy=False)

    filename = f"{key.identifier}-2048x2048-i16.bin"
    tile_path = output_dir / filename
    tile_path.write_bytes(stored.tobytes(order="C"))
    if tile_path.stat().st_size != TILE_BYTES:
        raise RuntimeError(f"Stored tile byte count mismatch: {tile_path.stat().st_size}")

    valid = native != RAW_SOURCE_NODATA
    valid_values = native[valid]
    minimum = int(valid_values.min()) if valid_values.size else None
    maximum = int(valid_values.max()) if valid_values.size else None
    first_center = dataset.xy(source_window.row_start, source_window.col_start, offset="center")
    last_center = dataset.xy(source_window.row_stop - 1, source_window.col_stop - 1, offset="center")
    west_edge = dataset.xy(source_window.row_start, source_window.col_start, offset="ul")[0]
    north_edge = dataset.xy(source_window.row_start, source_window.col_start, offset="ul")[1]
    east_edge = dataset.xy(source_window.row_start, source_window.col_stop - 1, offset="ur")[0]
    south_edge = dataset.xy(source_window.row_stop - 1, source_window.col_start, offset="ll")[1]

    return {
        "id": key.identifier,
        "matrix_index": [key.row, key.col],
        "file": filename,
        "sha256": sha256_file(tile_path),
        "stored_bytes": tile_path.stat().st_size,
        "stored_grid": [TILE_SIZE, TILE_SIZE],
        "valid_grid": [source_window.width, source_window.height],
        "source_window": [source_window.col_start, source_window.row_start, source_window.width, source_window.height],
        "source_sample_center_bounds_epsg32649": [first_center[0], last_center[1], last_center[0], first_center[1]],
        "source_cell_edge_bounds_epsg32649": [west_edge, south_edge, east_edge, north_edge],
        "valid_sample_count": int(np.count_nonzero(valid)),
        "native_nodata_sample_count": int(valid.size - np.count_nonzero(valid)),
        "padding_nodata_sample_count": int(TILE_SIZE * TILE_SIZE - native.size),
        "elevation_range_m": [minimum, maximum],
        "encoding": "int16-little-endian-raw-elevation-m",
        "nodata": RAW_SOURCE_NODATA,
        "resampling": "none",
        "source_elevation_modified_m": 0.0,
        "anchors": anchors_by_tile.get(key, []),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build native-aligned 2048 sample LOD tiles from the locked Guilin 12.5 m truth TIFF")
    parser.add_argument("--mosaic", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--all-tiles", action="store_true")
    parser.add_argument("--tile", action="append", type=parse_tile_key, default=[])
    parser.add_argument(
        "--anchors",
        nargs="*",
        default=[anchor["id"] for anchor in ANCHORS],
        choices=[anchor["id"] for anchor in ANCHORS],
        help="Build deterministic tiles containing the selected fixed landmarks. Default: all four.",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.mosaic) as dataset:
        validate_source(args.mosaic, dataset)
        aoi_window = center_inclusive_aoi_window(dataset)
        selected, anchor_tile_lookup = select_tiles(
            dataset,
            aoi_window,
            include_all=args.all_tiles,
            requested=args.tile,
            anchor_ids=set(args.anchors),
        )
        matrix_rows = tile_count(aoi_window.height)
        matrix_cols = tile_count(aoi_window.width)

        anchors_by_tile: dict[TileKey, list[dict[str, Any]]] = {}
        for anchor in ANCHORS:
            key = anchor_tile_lookup.get(anchor["id"])
            if key is not None:
                anchors_by_tile.setdefault(key, []).append(dict(anchor))

        tile_records = [build_tile(dataset, aoi_window, key, args.output_dir, anchors_by_tile) for key in selected]
        first_center = dataset.xy(aoi_window.row_start, aoi_window.col_start, offset="center")
        last_center = dataset.xy(aoi_window.row_stop - 1, aoi_window.col_stop - 1, offset="center")

    manifest = {
        "schema": "guilin-v077-native-lod-manifest/v1",
        "status": "foundation",
        "source": {
            "file": RAW_TIFF_NAME,
            "release_tag": "guilin-v070-raw-mosaic-v001",
            "release_asset_id": 530_206_518,
            "bytes": RAW_TIFF_SIZE,
            "sha256": RAW_TIFF_SHA256,
            "crs": RAW_SOURCE_CRS,
            "grid": RAW_SOURCE_GRID,
            "resolution_m": [RAW_SOURCE_RESOLUTION_M, RAW_SOURCE_RESOLUTION_M],
            "dtype": "int16",
            "nodata": RAW_SOURCE_NODATA,
            "read_only": True,
        },
        "aoi": {
            "status": "ACCEPTED",
            "geometry_sha256": AOI_GEOMETRY_SHA256,
            "bounds_epsg32649": AOI_BOUNDS,
            "native_sample_window": [aoi_window.col_start, aoi_window.row_start, aoi_window.width, aoi_window.height],
            "native_sample_center_bounds_epsg32649": [first_center[0], last_center[1], last_center[0], first_center[1]],
        },
        "tile_matrix": {
            "rows": matrix_rows,
            "columns": matrix_cols,
            "stored_grid": [TILE_SIZE, TILE_SIZE],
            "stride_samples": [TILE_STRIDE, TILE_STRIDE],
            "shared_edge_samples": 1,
            "expected_tile_bytes": TILE_BYTES,
            "full_matrix_tile_count": matrix_rows * matrix_cols,
            "built_tile_count": len(tile_records),
            "encoding": "int16-little-endian-raw-elevation-m",
            "resampling": "none",
            "edge_padding": "NoData 0 on east and south edge tiles only",
        },
        "anchor_tile_map": {anchor_id: key.identifier for anchor_id, key in sorted(anchor_tile_lookup.items())},
        "tiles": tile_records,
        "rules": {
            "gap_fill_applied": False,
            "fallback_30m_used": False,
            "source_resampling": False,
            "source_elevation_modified_m": 0.0,
            "vertical_scale": 1.0,
            "hydrology_centerline_mutated": False,
            "public_deployment_allowed": False,
            "visual_acceptance": False,
            "production_ready": False,
        },
    }
    manifest_path = args.output_dir / "native_lod_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    receipt = {
        "schema": "guilin-v077-native-lod-build-receipt/v1",
        "source_sha256": RAW_TIFF_SHA256,
        "aoi_geometry_sha256": AOI_GEOMETRY_SHA256,
        "manifest": manifest_path.name,
        "manifest_sha256": sha256_file(manifest_path),
        "matrix": [matrix_rows, matrix_cols],
        "built_tile_ids": [record["id"] for record in tile_records],
        "built_tile_count": len(tile_records),
        "built_tile_bytes": sum(record["stored_bytes"] for record in tile_records),
        "resampling": "none",
        "gap_fill_applied": False,
        "fallback_30m_used": False,
        "source_elevation_modified_m": 0.0,
        "vertical_scale": 1.0,
    }
    (args.output_dir / "native_lod_build_receipt.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
