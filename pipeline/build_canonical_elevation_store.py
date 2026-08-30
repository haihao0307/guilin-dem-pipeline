from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.windows import Window

SOURCE_FILE = "guilin_raw_union_12_5m.tif"
SOURCE_BYTES = 124_348_471
SOURCE_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
SOURCE_CRS = "EPSG:32649"
SOURCE_GRID = [17_408, 18_867]
SOURCE_DTYPE = "int16"
SOURCE_NODATA = 0
SOURCE_SPACING_M = 12.5
AOI_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
AOI_WINDOW = [2_438, 949, 11_983, 17_685]
AOI_CENTER_BOUNDS = [380_343.75, 2_705_931.25, 530_118.75, 2_926_981.25]
CHUNK_SIZE = 512
SHARD_TARGET_BYTES = 64 * 1024 * 1024
EXPECTED_SAMPLE_COUNT = AOI_WINDOW[2] * AOI_WINDOW[3]
EXPECTED_DATA_BYTES = EXPECTED_SAMPLE_COUNT * 2
EXPECTED_CHUNK_ROWS = math.ceil(AOI_WINDOW[3] / CHUNK_SIZE)
EXPECTED_CHUNK_COLUMNS = math.ceil(AOI_WINDOW[2] / CHUNK_SIZE)
EXPECTED_CHUNK_COUNT = EXPECTED_CHUNK_ROWS * EXPECTED_CHUNK_COLUMNS


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_source(path: Path, dataset: rasterio.io.DatasetReader) -> None:
    if path.name != SOURCE_FILE:
        raise RuntimeError(f"source filename mismatch: {path.name}")
    if path.stat().st_size != SOURCE_BYTES:
        raise RuntimeError(f"source byte count mismatch: {path.stat().st_size}")
    digest = sha256_file(path)
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"source SHA256 mismatch: {digest}")
    if str(dataset.crs) != SOURCE_CRS:
        raise RuntimeError(f"source CRS mismatch: {dataset.crs}")
    if [dataset.width, dataset.height] != SOURCE_GRID:
        raise RuntimeError(f"source grid mismatch: {dataset.width} x {dataset.height}")
    if dataset.count != 1 or dataset.dtypes[0] != SOURCE_DTYPE:
        raise RuntimeError(f"source dtype mismatch: {dataset.dtypes}")
    if dataset.nodata != SOURCE_NODATA:
        raise RuntimeError(f"source NoData mismatch: {dataset.nodata}")
    if not math.isclose(dataset.transform.a, SOURCE_SPACING_M, abs_tol=1e-9):
        raise RuntimeError(f"source x spacing mismatch: {dataset.transform.a}")
    if not math.isclose(dataset.transform.e, -SOURCE_SPACING_M, abs_tol=1e-9):
        raise RuntimeError(f"source y spacing mismatch: {dataset.transform.e}")


def canonical_source_digest(dataset: rasterio.io.DatasetReader) -> dict[str, Any]:
    aoi_column, aoi_row, aoi_width, aoi_height = AOI_WINDOW
    digest = hashlib.sha256()
    sample_count = 0
    nodata_count = 0
    minimum: int | None = None
    maximum: int | None = None
    for row_offset in range(0, aoi_height, 256):
        height = min(256, aoi_height - row_offset)
        values = dataset.read(
            1,
            window=Window(aoi_column, aoi_row + row_offset, aoi_width, height),
            boundless=False,
        ).astype("<i2", copy=False)
        digest.update(values.tobytes(order="C"))
        sample_count += int(values.size)
        nodata_count += int(np.count_nonzero(values == SOURCE_NODATA))
        valid = values != SOURCE_NODATA
        if np.any(valid):
            block_minimum = int(values[valid].min())
            block_maximum = int(values[valid].max())
            minimum = block_minimum if minimum is None else min(minimum, block_minimum)
            maximum = block_maximum if maximum is None else max(maximum, block_maximum)
    if sample_count != EXPECTED_SAMPLE_COUNT:
        raise RuntimeError(f"canonical sample count mismatch: {sample_count}")
    return {
        "sha256": digest.hexdigest(),
        "sample_count": sample_count,
        "bytes": sample_count * 2,
        "nodata_count": nodata_count,
        "valid_sample_count": sample_count - nodata_count,
        "elevation_range_m": [minimum, maximum],
    }


def chunk_bounds(dataset: rasterio.io.DatasetReader, source_column: int, source_row: int, width: int, height: int) -> tuple[list[float], list[float]]:
    transform = dataset.transform
    west_edge = float(transform.c + source_column * transform.a)
    east_edge = float(transform.c + (source_column + width) * transform.a)
    north_edge = float(transform.f + source_row * transform.e)
    south_edge = float(transform.f + (source_row + height) * transform.e)
    west_center = west_edge + SOURCE_SPACING_M * 0.5
    east_center = east_edge - SOURCE_SPACING_M * 0.5
    north_center = north_edge - SOURCE_SPACING_M * 0.5
    south_center = south_edge + SOURCE_SPACING_M * 0.5
    return (
        [west_center, south_center, east_center, north_center],
        [west_edge, south_edge, east_edge, north_edge],
    )


def build_store(source: Path, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    shards_dir = output_dir / "shards"
    shards_dir.mkdir(parents=True, exist_ok=True)
    for stale in shards_dir.glob("elevation-shard-*.i16pack"):
        stale.unlink()

    with rasterio.open(source) as dataset:
        validate_source(source, dataset)
        canonical = canonical_source_digest(dataset)
        aoi_column, aoi_row, aoi_width, aoi_height = AOI_WINDOW

        chunks: list[dict[str, Any]] = []
        shards: list[dict[str, Any]] = []
        current_handle = None
        current_path: Path | None = None
        current_digest: hashlib._Hash | None = None
        current_bytes = 0
        current_chunk_count = 0
        shard_index = -1

        def open_shard() -> None:
            nonlocal current_handle, current_path, current_digest, current_bytes, current_chunk_count, shard_index
            shard_index += 1
            current_path = shards_dir / f"elevation-shard-{shard_index:03d}.i16pack"
            current_handle = current_path.open("wb")
            current_digest = hashlib.sha256()
            current_bytes = 0
            current_chunk_count = 0

        def close_shard() -> None:
            nonlocal current_handle, current_path, current_digest, current_bytes, current_chunk_count
            if current_handle is None or current_path is None or current_digest is None:
                return
            current_handle.flush()
            current_handle.close()
            if current_path.stat().st_size != current_bytes:
                raise RuntimeError(f"shard byte count mismatch: {current_path}")
            shards.append({
                "id": current_path.stem,
                "file": f"shards/{current_path.name}",
                "bytes": current_bytes,
                "sha256": current_digest.hexdigest(),
                "chunk_count": current_chunk_count,
                "compression": "none",
            })
            current_handle = None
            current_path = None
            current_digest = None
            current_bytes = 0
            current_chunk_count = 0

        open_shard()
        total_chunk_bytes = 0
        total_nodata = 0
        for chunk_row in range(EXPECTED_CHUNK_ROWS):
            relative_row = chunk_row * CHUNK_SIZE
            height = min(CHUNK_SIZE, aoi_height - relative_row)
            for chunk_column in range(EXPECTED_CHUNK_COLUMNS):
                relative_column = chunk_column * CHUNK_SIZE
                width = min(CHUNK_SIZE, aoi_width - relative_column)
                source_column = aoi_column + relative_column
                source_row = aoi_row + relative_row
                values = dataset.read(
                    1,
                    window=Window(source_column, source_row, width, height),
                    boundless=False,
                ).astype("<i2", copy=False)
                raw = values.tobytes(order="C")
                expected_bytes = width * height * 2
                if len(raw) != expected_bytes:
                    raise RuntimeError("chunk byte count mismatch")
                if current_bytes and current_bytes + expected_bytes > SHARD_TARGET_BYTES:
                    close_shard()
                    open_shard()
                assert current_handle is not None and current_path is not None and current_digest is not None
                byte_offset = current_bytes
                current_handle.write(raw)
                current_digest.update(raw)
                current_bytes += expected_bytes
                current_chunk_count += 1
                total_chunk_bytes += expected_bytes
                nodata_count = int(np.count_nonzero(values == SOURCE_NODATA))
                total_nodata += nodata_count
                valid = values != SOURCE_NODATA
                elevation_range = [None, None]
                if np.any(valid):
                    elevation_range = [int(values[valid].min()), int(values[valid].max())]
                center_bounds, edge_bounds = chunk_bounds(dataset, source_column, source_row, width, height)
                chunks.append({
                    "id": f"r{chunk_row:03d}-c{chunk_column:03d}",
                    "matrix_index": [chunk_row, chunk_column],
                    "aoi_window": [relative_column, relative_row, width, height],
                    "source_window": [source_column, source_row, width, height],
                    "grid": [width, height],
                    "sample_count": width * height,
                    "bytes": expected_bytes,
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "shard": f"shards/{current_path.name}",
                    "shard_byte_offset": byte_offset,
                    "source_sample_center_bounds_epsg32649": center_bounds,
                    "source_cell_edge_bounds_epsg32649": edge_bounds,
                    "nodata_sample_count": nodata_count,
                    "valid_sample_count": width * height - nodata_count,
                    "elevation_range_m": elevation_range,
                    "encoding": "int16-little-endian-row-major",
                    "compression": "none",
                    "resampling": "none",
                    "quantization": "none",
                    "padding_samples": 0,
                    "shared_edge_duplicate_samples": 0,
                    "source_elevation_modified_m": 0.0,
                })
        close_shard()

    if len(chunks) != EXPECTED_CHUNK_COUNT:
        raise RuntimeError(f"chunk count mismatch: {len(chunks)}")
    if total_chunk_bytes != EXPECTED_DATA_BYTES:
        raise RuntimeError(f"total data byte count mismatch: {total_chunk_bytes}")
    if sum(int(shard["bytes"]) for shard in shards) != EXPECTED_DATA_BYTES:
        raise RuntimeError("shard byte sum mismatch")
    if total_nodata != canonical["nodata_count"]:
        raise RuntimeError("NoData count mismatch between canonical stream and chunks")

    manifest = {
        "schema": "guilin-canonical-elevation-store/v1",
        "status": "built_pending_independent_validation",
        "identity": {
            "name": "Guilin canonical lossless elevation store",
            "version": "1.0.0",
            "all_future_production_reads_this_store": True,
            "source_tiff_role_after_cutover": "cold_backup_only",
        },
        "source_cold_backup": {
            "file": SOURCE_FILE,
            "bytes": SOURCE_BYTES,
            "sha256": SOURCE_SHA256,
            "release_tag": "guilin-native-12p5m-single-truth-v001",
            "daily_runtime_read_allowed_after_cutover": False,
        },
        "spatial_reference": {
            "crs": SOURCE_CRS,
            "native_spacing_m": [SOURCE_SPACING_M, SOURCE_SPACING_M],
            "dtype": SOURCE_DTYPE,
            "nodata": SOURCE_NODATA,
            "source_grid": SOURCE_GRID,
        },
        "aoi": {
            "geometry_sha256": AOI_SHA256,
            "source_window": AOI_WINDOW,
            "grid": [AOI_WINDOW[2], AOI_WINDOW[3]],
            "source_sample_center_bounds_epsg32649": AOI_CENTER_BOUNDS,
            "sample_count": EXPECTED_SAMPLE_COUNT,
        },
        "canonical_row_major_stream": {
            "layout": "north-to-south rows, west-to-east columns",
            "encoding": "int16-little-endian-absolute-elevation-m",
            "sample_count": canonical["sample_count"],
            "bytes": canonical["bytes"],
            "sha256": canonical["sha256"],
            "nodata_sample_count": canonical["nodata_count"],
            "valid_sample_count": canonical["valid_sample_count"],
            "elevation_range_m": canonical["elevation_range_m"],
            "compression": "none",
            "resampling": "none",
            "quantization": "none",
            "interpolation": "none",
            "source_elevation_modified_m": 0.0,
        },
        "logical_chunks": {
            "chunk_grid_nominal": [CHUNK_SIZE, CHUNK_SIZE],
            "matrix_rows": EXPECTED_CHUNK_ROWS,
            "matrix_columns": EXPECTED_CHUNK_COLUMNS,
            "chunk_count": EXPECTED_CHUNK_COUNT,
            "edge_chunks_variable_size": True,
            "overlap_samples": 0,
            "padding_samples": 0,
            "each_source_sample_stored_once": True,
            "total_bytes": total_chunk_bytes,
        },
        "physical_shards": {
            "target_max_bytes": SHARD_TARGET_BYTES,
            "shard_count": len(shards),
            "total_bytes": sum(int(shard["bytes"]) for shard in shards),
            "packing_order": "logical chunks in row-major matrix order",
            "compression": "none",
            "shards": shards,
        },
        "chunks": chunks,
    }
    write_json(output_dir / "CANONICAL_ELEVATION_MANIFEST.json", manifest)
    checksum_lines = []
    for shard in shards:
        checksum_lines.append(f"{shard['sha256']}  {shard['file']}")
    checksum_lines.append(f"{sha256_file(output_dir / 'CANONICAL_ELEVATION_MANIFEST.json')}  CANONICAL_ELEVATION_MANIFEST.json")
    (output_dir / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    receipt = {
        "schema": "guilin-canonical-elevation-store-build-receipt/v1",
        "passed": True,
        "source_sha256": SOURCE_SHA256,
        "aoi_geometry_sha256": AOI_SHA256,
        "canonical_stream_sha256": canonical["sha256"],
        "sample_count": EXPECTED_SAMPLE_COUNT,
        "data_bytes": EXPECTED_DATA_BYTES,
        "chunk_count": EXPECTED_CHUNK_COUNT,
        "shard_count": len(shards),
        "overlap_samples": 0,
        "padding_samples": 0,
        "compression": "none",
        "resampling": "none",
        "quantization": "none",
        "source_elevation_modified_m": 0.0,
    }
    write_json(output_dir / "BUILD_RECEIPT.json", receipt)
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="One-time pixel-exact distillation of the Guilin 12.5 m TIFF into the canonical elevation store")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    receipt = build_store(args.source, args.output_dir)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
