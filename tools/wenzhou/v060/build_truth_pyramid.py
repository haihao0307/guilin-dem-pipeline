#!/usr/bin/env python3
"""Build the Wenzhou V0.6.0 exact node terrain pyramid.

Every output value is copied from the verified 12.5 metre Int16 source grid. The
builder performs no interpolation, smoothing, resampling or gap filling.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import math
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np


DEFAULT_SOURCE = Path(
    "projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif"
)
DEFAULT_TRUTH_MANIFEST = Path(
    "projects/wenzhou/v200/truth/WENZHOU_17TILE_TRUTH_MANIFEST.json"
)
DEFAULT_PREFLIGHT = Path(
    "projects/wenzhou/v200/reports/v060/V060_TRUTH_PREFLIGHT.json"
)
DEFAULT_OUTPUT = Path("projects/wenzhou/v200/web/workbench-v060/terrain-pyramid")

LEVELS = (
    (0, 1, 12.5),
    (1, 2, 25.0),
    (2, 4, 50.0),
    (3, 8, 100.0),
    (4, 16, 200.0),
    (5, 32, 400.0),
    (6, 64, 800.0),
)
TILE_INTERVALS = 256
NODATA = -32768


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--truth-manifest", type=Path, default=DEFAULT_TRUTH_MANIFEST)
    parser.add_argument("--preflight", type=Path, default=DEFAULT_PREFLIGHT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--gzip-level", type=int, default=6, choices=range(1, 10))
    return parser.parse_args()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def gzip_deterministic(data: bytes, level: int) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=level, mtime=0) as stream:
        stream.write(data)
    return buffer.getvalue()


def exact_axis_indices(size: int, stride: int) -> np.ndarray:
    indices = np.arange(0, size, stride, dtype=np.int64)
    if indices[-1] != size - 1:
        indices = np.concatenate((indices, np.array([size - 1], dtype=np.int64)))
    return indices


def tile_slices(node_count: int) -> Iterable[tuple[int, int, int]]:
    tile_count = math.ceil((node_count - 1) / TILE_INTERVALS)
    for tile_index in range(tile_count):
        start = tile_index * TILE_INTERVALS
        stop = min(node_count - 1, start + TILE_INTERVALS)
        yield tile_index, start, stop


def projected_xy(transform: Any, row: int, col: int) -> tuple[float, float]:
    x = transform.c + transform.a * col + transform.b * row
    y = transform.f + transform.d * col + transform.e * row
    return float(x), float(y)


def main() -> int:
    args = parse_args()
    truth_doc = json.loads(args.truth_manifest.read_text(encoding="utf-8"))
    truth = truth_doc["truthCog"]
    preflight = json.loads(args.preflight.read_text(encoding="utf-8"))

    if preflight.get("readyForPyramid") is not True:
        raise RuntimeError("V0.6.0 truth preflight is not ready")
    if args.source.stat().st_size != int(truth["expectedBytes"]):
        raise RuntimeError("source byte length changed after preflight")
    if sha256_file(args.source) != truth["expectedSha256"]:
        raise RuntimeError("source SHA256 changed after preflight")

    try:
        import rasterio  # type: ignore
    except ImportError as exc:
        raise RuntimeError("rasterio is required") from exc

    if args.clean and args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.source) as dataset:
        if [dataset.height, dataset.width] != truth["grid"]:
            raise RuntimeError("source grid changed after preflight")
        if dataset.dtypes[0] != "int16" or dataset.nodata != NODATA:
            raise RuntimeError("source encoding changed after preflight")

        source = dataset.read(1, out_dtype="int16")
        if source.dtype != np.dtype("int16"):
            raise RuntimeError(f"unexpected source dtype {source.dtype}")

        total_valid = int(np.count_nonzero(source != NODATA))
        total_nodata = int(source.size - total_valid)
        source_value_sha = sha256_bytes(source.astype("<i2", copy=False).tobytes(order="C"))

        manifest: dict[str, Any] = {
            "schema": "wenzhou_v060_exact_node_pyramid@1.0.0",
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "source": {
                "path": args.source.as_posix(),
                "bytes": args.source.stat().st_size,
                "sha256": truth["expectedSha256"],
                "valueSha256LittleEndianInt16": source_value_sha,
                "grid": [dataset.height, dataset.width],
                "crs": dataset.crs.to_string() if dataset.crs else None,
                "transform": [
                    dataset.transform.a,
                    dataset.transform.b,
                    dataset.transform.c,
                    dataset.transform.d,
                    dataset.transform.e,
                    dataset.transform.f,
                ],
                "nodata": NODATA,
                "validNodes": total_valid,
                "nodataNodes": total_nodata,
            },
            "policy": {
                "interpolation": False,
                "smoothing": False,
                "syntheticGapFill": False,
                "fallback30m": False,
                "oldQingjiangTruthUsed": False,
                "selection": "exact source nodes only",
                "tileIntervals": TILE_INTERVALS,
                "sharedEdgeNodes": True,
                "edgeTilesMayBeSmaller": True,
            },
            "levels": [],
        }

        all_tile_records: list[dict[str, Any]] = []
        for level, stride, spacing_m in LEVELS:
            row_indices = exact_axis_indices(dataset.height, stride)
            col_indices = exact_axis_indices(dataset.width, stride)
            level_dir = args.output / f"L{level}"
            level_dir.mkdir(parents=True, exist_ok=True)
            row_tiles = list(tile_slices(len(row_indices)))
            col_tiles = list(tile_slices(len(col_indices)))
            level_record: dict[str, Any] = {
                "level": level,
                "sourceStride": stride,
                "nominalSpacingMeters": spacing_m,
                "grid": [len(row_indices), len(col_indices)],
                "tileRows": len(row_tiles),
                "tileColumns": len(col_tiles),
                "tileCount": len(row_tiles) * len(col_tiles),
                "tiles": [],
            }

            for tile_row, row_start, row_stop in row_tiles:
                selected_rows = row_indices[row_start : row_stop + 1]
                for tile_col, col_start, col_stop in col_tiles:
                    selected_cols = col_indices[col_start : col_stop + 1]
                    tile = source[np.ix_(selected_rows, selected_cols)]
                    raw = tile.astype("<i2", copy=False).tobytes(order="C")
                    compressed = gzip_deterministic(raw, args.gzip_level)
                    relative = Path(f"L{level}") / f"r{tile_row:03d}_c{tile_col:03d}.i16.gz"
                    destination = args.output / relative
                    destination.write_bytes(compressed)

                    north_west = projected_xy(dataset.transform, int(selected_rows[0]), int(selected_cols[0]))
                    south_east = projected_xy(dataset.transform, int(selected_rows[-1]), int(selected_cols[-1]))
                    valid = tile != NODATA
                    valid_values = tile[valid]
                    record = {
                        "id": f"L{level}-R{tile_row}-C{tile_col}",
                        "path": relative.as_posix(),
                        "grid": [int(tile.shape[0]), int(tile.shape[1])],
                        "sourceRows": [int(selected_rows[0]), int(selected_rows[-1])],
                        "sourceColumns": [int(selected_cols[0]), int(selected_cols[-1])],
                        "sourceStride": stride,
                        "nominalSpacingMeters": spacing_m,
                        "projectedBoundsNodeCenters": [
                            north_west[0],
                            south_east[1],
                            south_east[0],
                            north_west[1],
                        ],
                        "rawBytes": len(raw),
                        "gzipBytes": len(compressed),
                        "rawSha256": sha256_bytes(raw),
                        "gzipSha256": sha256_bytes(compressed),
                        "validNodes": int(np.count_nonzero(valid)),
                        "nodataNodes": int(tile.size - np.count_nonzero(valid)),
                        "minimumMeters": int(valid_values.min()) if valid_values.size else None,
                        "maximumMeters": int(valid_values.max()) if valid_values.size else None,
                    }
                    level_record["tiles"].append(record)
                    all_tile_records.append(record)

            manifest["levels"].append(level_record)

    manifest["summary"] = {
        "levelCount": len(manifest["levels"]),
        "tileCount": len(all_tile_records),
        "gzipBytes": sum(tile["gzipBytes"] for tile in all_tile_records),
        "rawBytes": sum(tile["rawBytes"] for tile in all_tile_records),
    }
    manifest_path = args.output / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    build_report = {
        "schema": "wenzhou_v060_pyramid_build@1.0.0",
        "generatedAtUtc": manifest["generatedAtUtc"],
        "readyForRuntimeQa": True,
        "manifest": manifest_path.as_posix(),
        "manifestSha256": sha256_file(manifest_path),
        "summary": manifest["summary"],
        "sourceValueSha256LittleEndianInt16": manifest["source"]["valueSha256LittleEndianInt16"],
        "hardRules": manifest["policy"],
    }
    report_path = args.output / "BUILD_QA.json"
    report_path.write_text(json.dumps(build_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build_report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pyramid build failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
