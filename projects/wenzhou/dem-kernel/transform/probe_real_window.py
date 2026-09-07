#!/usr/bin/env python3
"""Run the first falsifiable lossless experiment on a verified Wenzhou window.

The command refuses generic or synthetic arrays.  A provenance manifest must bind
an extracted 12.5 m Int16 window to the fixed 17-tile Wenzhou COG identity.  This
keeps mathematical tests separate from source-data evidence.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import time
import tracemalloc
from typing import Any, Iterable

import numpy as np

from reversible_cdf53 import (
    decode_lossless,
    encode_grid,
    pack_lossless,
    reconstruct_with_zeroed_details,
    zero_detail_levels,
)

EXPECTED_COG = {
    "path": "projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif",
    "bytes": 136760745,
    "sha256": "c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43",
    "grid": [17555, 17918],
    "spacingMeters": [12.5, 12.5],
    "crs": "EPSG:32651",
    "dtype": "int16",
    "nodata": -32768,
}
MANIFEST_SCHEMA = "wenzhou-dem-real-window/v1"
REPORT_SCHEMA = "wenzhou-dem-kernel-real-window-probe/v1"


class ProvenanceError(ValueError):
    """Raised when a window cannot be tied to the fixed Wenzhou truth identity."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        required=True,
        help="Verified window provenance JSON. Generic arrays are rejected.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Destination for the JSON evidence report.",
    )
    parser.add_argument(
        "--compression-level", type=int, default=9, choices=range(0, 10)
    )
    parser.add_argument(
        "--drop-finest-count",
        type=int,
        default=3,
        help="Number of partial reconstructions, dropping 1..N finest levels.",
    )
    parser.add_argument(
        "--query-count", type=int, default=20000, help="Decoded-array point queries."
    )
    return parser.parse_args()


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(chunk_size)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def gzip_deterministic(data: bytes, level: int) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=level, mtime=0) as stream:
        stream.write(data)
    return buffer.getvalue()


def _require_equal(label: str, actual: Any, expected: Any) -> None:
    if actual != expected:
        raise ProvenanceError(f"{label} mismatch: expected {expected!r}, got {actual!r}")


def validate_manifest(manifest_path: Path) -> tuple[dict[str, Any], Path]:
    if not manifest_path.is_file():
        raise FileNotFoundError(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _require_equal("schema", manifest.get("schema"), MANIFEST_SCHEMA)
    _require_equal("dataClass", manifest.get("dataClass"), "real_wenzhou_12p5m")
    _require_equal("provenanceStatus", manifest.get("provenanceStatus"), "verified")

    source = manifest.get("sourceCog")
    if not isinstance(source, dict):
        raise ProvenanceError("sourceCog object is required")
    for key in ("path", "bytes", "sha256", "grid", "spacingMeters", "crs", "dtype", "nodata"):
        _require_equal(f"sourceCog.{key}", source.get(key), EXPECTED_COG[key])

    window = manifest.get("sourceWindow")
    if not isinstance(window, dict):
        raise ProvenanceError("sourceWindow object is required")
    for key in ("row", "column", "height", "width"):
        if not isinstance(window.get(key), int) or int(window[key]) < 0:
            raise ProvenanceError(f"sourceWindow.{key} must be a non-negative integer")
    if window["height"] < 1 or window["width"] < 1:
        raise ProvenanceError("source window dimensions must be positive")
    if window["row"] + window["height"] > EXPECTED_COG["grid"][0]:
        raise ProvenanceError("source window exceeds fixed COG row count")
    if window["column"] + window["width"] > EXPECTED_COG["grid"][1]:
        raise ProvenanceError("source window exceeds fixed COG column count")

    payload = manifest.get("payload")
    if not isinstance(payload, dict):
        raise ProvenanceError("payload object is required")
    relative = payload.get("path")
    if not isinstance(relative, str) or not relative:
        raise ProvenanceError("payload.path is required")
    payload_path = (manifest_path.parent / relative).resolve()
    if not payload_path.is_file():
        raise FileNotFoundError(payload_path)
    _require_equal("payload.bytes", payload.get("bytes"), payload_path.stat().st_size)
    _require_equal("payload.sha256", payload.get("sha256"), sha256_file(payload_path))
    _require_equal("payload.dtype", payload.get("dtype"), "int16")
    _require_equal("payload.endian", payload.get("endian"), "little")
    _require_equal(
        "payload.grid", payload.get("grid"), [window["height"], window["width"]]
    )
    if payload.get("format") not in {"raw-i16", "npy"}:
        raise ProvenanceError("payload.format must be raw-i16 or npy")
    return manifest, payload_path


def load_grid(manifest: dict[str, Any], payload_path: Path) -> np.ndarray:
    payload = manifest["payload"]
    rows, columns = (int(value) for value in payload["grid"])
    if payload["format"] == "raw-i16":
        expected_bytes = rows * columns * np.dtype("<i2").itemsize
        if payload_path.stat().st_size != expected_bytes:
            raise ProvenanceError(
                f"raw payload length mismatch: expected {expected_bytes}, "
                f"got {payload_path.stat().st_size}"
            )
        grid = np.fromfile(payload_path, dtype="<i2").reshape((rows, columns))
    else:
        grid = np.load(payload_path, allow_pickle=False)
        if not isinstance(grid, np.ndarray):
            raise ProvenanceError("NPY payload did not produce a NumPy array")
    if grid.shape != (rows, columns):
        raise ProvenanceError(f"payload shape mismatch: {grid.shape} != {(rows, columns)}")
    if grid.dtype != np.dtype("int16"):
        raise ProvenanceError(f"payload dtype mismatch: expected int16, got {grid.dtype}")
    return np.asarray(grid, dtype="<i2")


def terrain_error_metrics(source: np.ndarray, candidate: np.ndarray, nodata: int) -> dict[str, Any]:
    source_mask = source == nodata
    candidate_mask = candidate == nodata
    mask_equal = bool(np.array_equal(source_mask, candidate_mask))
    valid = ~source_mask
    if not np.any(valid):
        return {
            "nodataMaskEqual": mask_equal,
            "validSampleCount": 0,
            "maxAbsHeightErrorMeters": None,
            "rmseHeightMeters": None,
            "slopeRmseMetersPerMeter": None,
            "curvatureRmseInverseMeters": None,
        }

    source64 = source.astype(np.float64)
    candidate64 = candidate.astype(np.float64)
    difference = candidate64[valid] - source64[valid]
    spacing_y, spacing_x = EXPECTED_COG["spacingMeters"]

    # Derivative metrics exclude NoData by filling both surfaces identically with
    # zero. They are screening metrics only; feature-line gates remain separate.
    source_for_gradient = source64.copy()
    candidate_for_gradient = candidate64.copy()
    source_for_gradient[source_mask] = 0.0
    candidate_for_gradient[source_mask] = 0.0
    slope_rmse: float | None = None
    curvature_rmse: float | None = None
    if source.shape[0] >= 2 and source.shape[1] >= 2:
        source_dy, source_dx = np.gradient(source_for_gradient, spacing_y, spacing_x)
        candidate_dy, candidate_dx = np.gradient(
            candidate_for_gradient, spacing_y, spacing_x
        )
        source_slope = np.hypot(source_dx, source_dy)
        candidate_slope = np.hypot(candidate_dx, candidate_dy)
        slope_difference = candidate_slope[valid] - source_slope[valid]
        slope_rmse = float(np.sqrt(np.mean(np.square(slope_difference))))

        source_dyy = np.gradient(source_dy, spacing_y, axis=0)
        source_dxx = np.gradient(source_dx, spacing_x, axis=1)
        candidate_dyy = np.gradient(candidate_dy, spacing_y, axis=0)
        candidate_dxx = np.gradient(candidate_dx, spacing_x, axis=1)
        curvature_difference = (
            candidate_dxx[valid]
            + candidate_dyy[valid]
            - source_dxx[valid]
            - source_dyy[valid]
        )
        curvature_rmse = float(
            np.sqrt(np.mean(np.square(curvature_difference)))
        )

    return {
        "nodataMaskEqual": mask_equal,
        "validSampleCount": int(np.count_nonzero(valid)),
        "maxAbsHeightErrorMeters": float(np.max(np.abs(difference))),
        "rmseHeightMeters": float(np.sqrt(np.mean(np.square(difference)))),
        "slopeRmseMetersPerMeter": slope_rmse,
        "curvatureRmseInverseMeters": curvature_rmse,
    }


def detail_coefficient_count(
    level_shapes: Iterable[tuple[int, int]], levels_to_zero: Iterable[int]
) -> int:
    selected = set(int(value) for value in levels_to_zero)
    total = 0
    for index, (height, width) in enumerate(level_shapes):
        if index not in selected:
            continue
        low_height = (height + 1) // 2
        low_width = (width + 1) // 2
        total += height * width - low_height * low_width
    return total


def benchmark_queries(grid: np.ndarray, count: int) -> dict[str, Any]:
    if count < 1:
        raise ValueError("query count must be positive")
    rng = np.random.default_rng(20260907)
    rows = rng.integers(0, grid.shape[0], size=count)
    columns = rng.integers(0, grid.shape[1], size=count)
    accumulator = 0
    started = time.perf_counter_ns()
    for row, column in zip(rows, columns, strict=True):
        accumulator += int(grid[int(row), int(column)])
    elapsed = time.perf_counter_ns() - started
    return {
        "mode": "decoded_array_baseline",
        "queryCount": int(count),
        "elapsedNanoseconds": int(elapsed),
        "averageNanosecondsPerQuery": float(elapsed / count),
        "checksum": int(accumulator),
        "localCoefficientQueryImplemented": False,
    }


def run_probe(
    manifest_path: Path,
    *,
    compression_level: int,
    drop_finest_count: int,
    query_count: int,
) -> dict[str, Any]:
    manifest, payload_path = validate_manifest(manifest_path)
    source = load_grid(manifest, payload_path)
    nodata = EXPECTED_COG["nodata"]
    raw = source.astype("<i2", copy=False).tobytes(order="C")
    baseline_gzip = gzip_deterministic(raw, compression_level)

    tracemalloc.start()
    started_encode = time.perf_counter()
    encoded = encode_grid(source, nodata=nodata)
    container = pack_lossless(encoded, compression_level=compression_level)
    encode_seconds = time.perf_counter() - started_encode
    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    started_decode = time.perf_counter()
    restored = decode_lossless(container)
    decode_seconds = time.perf_counter() - started_decode
    exact_metrics = terrain_error_metrics(source, restored, nodata)
    exact_pass = bool(
        np.array_equal(source, restored)
        and exact_metrics["nodataMaskEqual"]
        and exact_metrics["maxAbsHeightErrorMeters"] == 0.0
    )

    partial: list[dict[str, Any]] = []
    maximum_drop = min(max(0, int(drop_finest_count)), len(encoded.level_shapes))
    for drop_count in range(1, maximum_drop + 1):
        zeroed_levels = list(range(drop_count))
        # Exercise the coefficient filter independently so its retained fraction is
        # measured from the transform layout, not from numerical zero coincidences.
        filtered_coefficients = zero_detail_levels(
            encoded.coefficients, encoded.level_shapes, zeroed_levels
        )
        if filtered_coefficients.shape != encoded.coefficients.shape:
            raise AssertionError("filtered coefficient shape changed")
        candidate = reconstruct_with_zeroed_details(encoded, zeroed_levels)
        zeroed_count = detail_coefficient_count(encoded.level_shapes, zeroed_levels)
        partial.append(
            {
                "zeroedFinestLevelCount": drop_count,
                "zeroedLevelIndices": zeroed_levels,
                "zeroedCoefficientCount": int(zeroed_count),
                "retainedCoefficientFraction": float(
                    1.0 - zeroed_count / encoded.coefficients.size
                ),
                "errors": terrain_error_metrics(source, candidate, nodata),
                "featureConstraintMetrics": {
                    "status": "not_run_no_verified_point_line_mask_bundle",
                    "peakDisplacement": None,
                    "ridgeValleyDisplacement": None,
                    "riverBankOffset": None,
                    "coastlineOffset": None,
                },
            }
        )

    return {
        "schema": REPORT_SCHEMA,
        "status": "probe_passed" if exact_pass else "probe_failed",
        "sourceEvidence": {
            "manifest": manifest_path.as_posix(),
            "manifestSha256": sha256_file(manifest_path),
            "payload": payload_path.as_posix(),
            "payloadSha256": sha256_file(payload_path),
            "dataClass": manifest["dataClass"],
            "provenanceStatus": manifest["provenanceStatus"],
            "sourceCog": manifest["sourceCog"],
            "sourceWindow": manifest["sourceWindow"],
        },
        "grid": {
            "shape": [int(source.shape[0]), int(source.shape[1])],
            "dtype": str(source.dtype),
            "nodata": nodata,
            "validSamples": int(np.count_nonzero(source != nodata)),
            "nodataSamples": int(np.count_nonzero(source == nodata)),
        },
        "losslessBaseline": {
            "rawBytes": len(raw),
            "deterministicGzipBytes": len(baseline_gzip),
            "gzipToRawRatio": float(len(baseline_gzip) / len(raw)),
        },
        "reversibleCdf53": {
            "containerBytes": len(container),
            "containerToRawRatio": float(len(container) / len(raw)),
            "containerToBaselineGzipRatio": float(
                len(container) / len(baseline_gzip)
            ),
            "levelCount": len(encoded.level_shapes),
            "levelShapes": [list(shape) for shape in encoded.level_shapes],
            "coefficientRange": [
                int(encoded.coefficients.min()),
                int(encoded.coefficients.max()),
            ],
            "encodeSeconds": float(encode_seconds),
            "decodeSeconds": float(decode_seconds),
            "pythonTracemallocPeakBytes": int(peak_bytes),
            "exactRoundTrip": exact_pass,
            "exactErrors": exact_metrics,
        },
        "pointQuery": benchmark_queries(restored, query_count),
        "partialBandReconstructions": partial,
        "gates": {
            "sampleExactRoundTrip": exact_pass,
            "nodataIdentity": bool(exact_metrics["nodataMaskEqual"]),
            "coordinateIdentity": "bound_by_manifest_not_modified",
            "sharedEdgeCheck": "not_run_single_window",
            "pointLineMaskConstraintCheck": "not_run_bundle_unavailable",
            "productionIntegration": False,
            "visualAcceptance": False,
            "productionReady": False,
        },
        "interpretationLimits": [
            "Compression ratios apply only to this verified source window.",
            "Decoded-array point timing is not a local wavelet coefficient query benchmark.",
            "Slope and curvature are screening metrics; verified feature constraints are still required.",
            "No full-domain Wenzhou claim is permitted from this window probe.",
        ],
    }


def main() -> int:
    args = parse_args()
    if args.drop_finest_count < 0:
        raise ValueError("--drop-finest-count must be non-negative")
    report = run_probe(
        args.manifest,
        compression_level=args.compression_level,
        drop_finest_count=args.drop_finest_count,
        query_count=args.query_count,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "probe_passed" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"real Wenzhou window probe failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
