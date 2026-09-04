#!/usr/bin/env python3
"""Full QA for the Wenzhou V0.6.0 exact node terrain pyramid."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


DEFAULT_SOURCE = Path(
    "projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif"
)
DEFAULT_PYRAMID = Path("projects/wenzhou/v200/web/workbench-v060/terrain-pyramid")
DEFAULT_REPORT = Path("projects/wenzhou/v200/reports/v060/V060_PYRAMID_QA.json")
NODATA = -32768


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--pyramid", type=Path, default=DEFAULT_PYRAMID)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_tile(root: Path, record: dict[str, Any]) -> np.ndarray:
    compressed = (root / record["path"]).read_bytes()
    if sha256_bytes(compressed) != record["gzipSha256"]:
        raise RuntimeError(f"gzip hash mismatch: {record['id']}")
    raw = gzip.decompress(compressed)
    if sha256_bytes(raw) != record["rawSha256"]:
        raise RuntimeError(f"raw hash mismatch: {record['id']}")
    expected_bytes = int(record["grid"][0]) * int(record["grid"][1]) * 2
    if len(raw) != expected_bytes:
        raise RuntimeError(f"raw byte length mismatch: {record['id']}")
    return np.frombuffer(raw, dtype="<i2").reshape(record["grid"])


def main() -> int:
    args = parse_args()
    manifest_path = args.pyramid / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    try:
        import rasterio  # type: ignore
    except ImportError as exc:
        raise RuntimeError("rasterio is required") from exc

    with rasterio.open(args.source) as dataset:
        source = dataset.read(1, out_dtype="int16")

    failures: list[dict[str, Any]] = []
    tile_cache: dict[str, np.ndarray] = {}
    checked_tiles = 0
    checked_values = 0
    shared_edges_checked = 0

    for level in manifest["levels"]:
        records = level["tiles"]
        by_position: dict[tuple[int, int], dict[str, Any]] = {}
        for record in records:
            parts = record["id"].split("-")
            tile_row = int(parts[1][1:])
            tile_col = int(parts[2][1:])
            by_position[(tile_row, tile_col)] = record
            try:
                tile = load_tile(args.pyramid, record)
                tile_cache[record["id"]] = tile
                row0, row1 = record["sourceRows"]
                col0, col1 = record["sourceColumns"]
                stride = int(record["sourceStride"])
                rows = np.arange(row0, row1 + 1, stride, dtype=np.int64)
                cols = np.arange(col0, col1 + 1, stride, dtype=np.int64)
                if rows[-1] != row1:
                    rows = np.concatenate((rows, np.array([row1], dtype=np.int64)))
                if cols[-1] != col1:
                    cols = np.concatenate((cols, np.array([col1], dtype=np.int64)))
                expected = source[np.ix_(rows, cols)]
                if expected.shape != tile.shape or not np.array_equal(expected, tile):
                    mismatch = None
                    if expected.shape == tile.shape:
                        positions = np.argwhere(expected != tile)
                        if positions.size:
                            rr, cc = map(int, positions[0])
                            mismatch = {
                                "tileRow": rr,
                                "tileColumn": cc,
                                "expected": int(expected[rr, cc]),
                                "actual": int(tile[rr, cc]),
                            }
                    failures.append({"type": "source_value_mismatch", "tile": record["id"], "first": mismatch})
                checked_tiles += 1
                checked_values += int(tile.size)
            except Exception as exc:
                failures.append({"type": "tile_read_failure", "tile": record["id"], "error": str(exc)})

        for (tile_row, tile_col), record in by_position.items():
            tile = tile_cache.get(record["id"])
            if tile is None:
                continue
            right_record = by_position.get((tile_row, tile_col + 1))
            if right_record is not None and right_record["id"] in tile_cache:
                right = tile_cache[right_record["id"]]
                shared_edges_checked += 1
                if not np.array_equal(tile[:, -1], right[:, 0]):
                    failures.append(
                        {
                            "type": "horizontal_shared_edge_mismatch",
                            "left": record["id"],
                            "right": right_record["id"],
                        }
                    )
            lower_record = by_position.get((tile_row + 1, tile_col))
            if lower_record is not None and lower_record["id"] in tile_cache:
                lower = tile_cache[lower_record["id"]]
                shared_edges_checked += 1
                if not np.array_equal(tile[-1, :], lower[0, :]):
                    failures.append(
                        {
                            "type": "vertical_shared_edge_mismatch",
                            "upper": record["id"],
                            "lower": lower_record["id"],
                        }
                    )

        tile_cache.clear()

    report = {
        "schema": "wenzhou_v060_pyramid_qa@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "passed": not failures,
        "source": args.source.as_posix(),
        "pyramid": args.pyramid.as_posix(),
        "levelCount": len(manifest["levels"]),
        "tilesChecked": checked_tiles,
        "valuesChecked": checked_values,
        "sharedEdgesChecked": shared_edges_checked,
        "failures": failures,
        "hardRules": {
            "allValuesEqualExactSourceNodes": not any(
                failure["type"] == "source_value_mismatch" for failure in failures
            ),
            "allSharedEdgesEqual": not any("shared_edge" in failure["type"] for failure in failures),
            "syntheticGapFill": False,
            "interpolation": False,
            "oldQingjiangTruthUsed": False,
        },
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 3


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pyramid QA failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
