#!/usr/bin/env python3
"""Strict preflight for the Wenzhou V0.6.0 17 tile truth COG.

The script intentionally refuses substitutions. It validates exact bytes, SHA256,
raster metadata, nodata, transform, bounds, block shape and overview factors before
any terrain pyramid build is allowed to start.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_MANIFEST = Path(
    "projects/wenzhou/v200/truth/WENZHOU_17TILE_TRUTH_MANIFEST.json"
)
DEFAULT_SOURCE = Path(
    "projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif"
)
DEFAULT_REPORT = Path(
    "projects/wenzhou/v200/reports/v060/V060_TRUTH_PREFLIGHT.json"
)


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    expected: Any = None
    actual: Any = None
    detail: str | None = None


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def close_enough(actual: float, expected: float, tolerance: float = 1e-7) -> bool:
    return math.isclose(float(actual), float(expected), rel_tol=0.0, abs_tol=tolerance)


def list_close(actual: list[float], expected: list[float], tolerance: float = 1e-7) -> bool:
    return len(actual) == len(expected) and all(
        close_enough(a, b, tolerance) for a, b in zip(actual, expected)
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--truth-manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    checks: list[Check] = []

    if not args.truth_manifest.is_file():
        raise FileNotFoundError(f"Truth manifest missing: {args.truth_manifest}")

    truth_doc = json.loads(args.truth_manifest.read_text(encoding="utf-8"))
    truth = truth_doc["truthCog"]

    expected_path = Path(truth["repositoryPath"])
    checks.append(
        Check(
            "source_path_identity",
            args.source.as_posix() == expected_path.as_posix(),
            expected_path.as_posix(),
            args.source.as_posix(),
        )
    )

    source_exists = args.source.is_file()
    checks.append(Check("source_exists", source_exists, True, source_exists))

    pointer_only = False
    if source_exists:
        prefix = args.source.read_bytes()[:160]
        pointer_only = prefix.startswith(b"version https://git-lfs.github.com/spec/v1")
    checks.append(Check("source_is_not_lfs_pointer", source_exists and not pointer_only, False, pointer_only))

    actual_bytes: int | None = args.source.stat().st_size if source_exists else None
    checks.append(
        Check(
            "exact_byte_length",
            actual_bytes == int(truth["expectedBytes"]),
            int(truth["expectedBytes"]),
            actual_bytes,
        )
    )

    actual_sha: str | None = None
    if source_exists and not pointer_only and actual_bytes == int(truth["expectedBytes"]):
        actual_sha = sha256_file(args.source)
    checks.append(
        Check(
            "exact_sha256",
            actual_sha == truth["expectedSha256"],
            truth["expectedSha256"],
            actual_sha,
        )
    )

    raster_metadata: dict[str, Any] | None = None
    rasterio_error: str | None = None
    if source_exists and not pointer_only and actual_sha == truth["expectedSha256"]:
        try:
            import rasterio  # type: ignore

            with rasterio.open(args.source) as dataset:
                raster_metadata = {
                    "driver": dataset.driver,
                    "crs": dataset.crs.to_string() if dataset.crs else None,
                    "grid": [dataset.height, dataset.width],
                    "dtype": dataset.dtypes[0] if dataset.count else None,
                    "nodata": dataset.nodata,
                    "transform": [
                        dataset.transform.a,
                        dataset.transform.b,
                        dataset.transform.c,
                        dataset.transform.d,
                        dataset.transform.e,
                        dataset.transform.f,
                    ],
                    "bounds": [
                        dataset.bounds.left,
                        dataset.bounds.bottom,
                        dataset.bounds.right,
                        dataset.bounds.top,
                    ],
                    "blockShape": list(dataset.block_shapes[0]) if dataset.block_shapes else None,
                    "overviews": dataset.overviews(1) if dataset.count else [],
                    "count": dataset.count,
                }
        except Exception as exc:  # pragma: no cover, report exact environment failure
            rasterio_error = f"{type(exc).__name__}: {exc}"

    checks.append(
        Check(
            "raster_metadata_readable",
            raster_metadata is not None,
            True,
            raster_metadata is not None,
            rasterio_error,
        )
    )

    if raster_metadata is not None:
        checks.extend(
            [
                Check("driver", raster_metadata["driver"] == truth["driver"], truth["driver"], raster_metadata["driver"]),
                Check("crs", raster_metadata["crs"] == truth["crs"], truth["crs"], raster_metadata["crs"]),
                Check("grid", raster_metadata["grid"] == truth["grid"], truth["grid"], raster_metadata["grid"]),
                Check("dtype", raster_metadata["dtype"] == truth["dtype"], truth["dtype"], raster_metadata["dtype"]),
                Check("nodata", raster_metadata["nodata"] == truth["nodata"], truth["nodata"], raster_metadata["nodata"]),
                Check(
                    "transform",
                    list_close(raster_metadata["transform"], truth["transform"]),
                    truth["transform"],
                    raster_metadata["transform"],
                ),
                Check(
                    "bounds",
                    list_close(raster_metadata["bounds"], truth["bounds"]),
                    truth["bounds"],
                    raster_metadata["bounds"],
                ),
                Check(
                    "block_shape",
                    raster_metadata["blockShape"] == truth["blockShape"],
                    truth["blockShape"],
                    raster_metadata["blockShape"],
                ),
                Check(
                    "overviews",
                    raster_metadata["overviews"] == truth["overviews"],
                    truth["overviews"],
                    raster_metadata["overviews"],
                ),
                Check("single_band", raster_metadata["count"] == 1, 1, raster_metadata["count"]),
            ]
        )

    retired = truth_doc.get("retiredTruth", {})
    checks.append(
        Check(
            "retired_qingjiang_not_selected",
            truth.get("expectedSha256") != retired.get("sha256")
            and "QINGJIANG" not in args.source.name.upper(),
            True,
            {
                "selectedName": args.source.name,
                "selectedSha256": truth.get("expectedSha256"),
                "retiredSha256": retired.get("sha256"),
            },
        )
    )

    ready = bool(checks) and all(check.passed for check in checks)
    report = {
        "schema": "wenzhou_v060_truth_preflight@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "source": args.source.as_posix(),
        "truthManifest": args.truth_manifest.as_posix(),
        "readyForPyramid": ready,
        "checksPassed": sum(1 for check in checks if check.passed),
        "checksTotal": len(checks),
        "checks": [asdict(check) for check in checks],
        "rasterMetadata": raster_metadata,
        "hardRules": {
            "oldQingjiangTruthUsed": False,
            "syntheticGapFill": False,
            "interpolatedElevationNodes": False,
            "fallback30m": False,
        },
    }

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if ready else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"preflight failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
