#!/usr/bin/env python3
"""Compile exact 2048 × 2048 native-pixel Yangshuo DEM windows for v3.2."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

EXPECTED_SOURCE_SHA = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
EXPECTED_SOURCE_BYTES = 124_348_471

CANDIDATES = {
    "A": {
        "name": "阳朔县城北侧漓江峰丛谷地",
        "role": "gold-reference-calibration",
        "window": [6983, 14506, 2048, 2048],
        "bounds": [437150.0, 2731925.0, 462750.0, 2757525.0],
        "centerWgs84": [110.504749, 24.816544],
    },
    "C": {
        "name": "兴坪南侧九马画山漓江贴水峡谷段",
        "role": "river-and-cliff-calibration",
        "window": [6955, 13988, 2048, 2048],
        "bounds": [436800.0, 2738400.0, 462400.0, 2764000.0],
        "centerWgs84": [110.501051, 24.875008],
    },
    "D": {
        "name": "相公山至兴坪第一湾",
        "role": "tower-wall-calibration",
        "window": [6996, 13629, 2048, 2048],
        "bounds": [437312.5, 2742887.5, 462912.5, 2768487.5],
        "centerWgs84": [110.505964, 24.915551],
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def compile_assets(source: Path, output: Path) -> dict:
    if not source.is_file():
        raise FileNotFoundError(source)
    if source.stat().st_size != EXPECTED_SOURCE_BYTES:
        raise RuntimeError(f"source byte mismatch: {source.stat().st_size}")
    source_sha = sha256(source)
    if source_sha != EXPECTED_SOURCE_SHA:
        raise RuntimeError(f"source SHA256 mismatch: {source_sha}")

    output.mkdir(parents=True, exist_ok=True)
    index = {
        "schema": "guilin-yangshuo-native-assets/v3.2.0",
        "source": {
            "releaseTag": "guilin-v070-raw-mosaic-v001",
            "asset": "guilin_raw_union_12_5m.tif",
            "bytes": EXPECTED_SOURCE_BYTES,
            "sha256": EXPECTED_SOURCE_SHA,
            "crs": "EPSG:32649",
            "pixelSpacingMeters": 12.5,
        },
        "grid": [2048, 2048],
        "extentMeters": [25600.0, 25600.0],
        "resampling": False,
        "gapFill": False,
        "truthMutationCount": 0,
        "candidates": {},
    }

    with rasterio.open(source) as dataset:
        if (dataset.width, dataset.height) != (17408, 18867):
            raise RuntimeError(f"unexpected source grid: {dataset.width} × {dataset.height}")
        if dataset.crs is None or dataset.crs.to_epsg() != 32649:
            raise RuntimeError(f"unexpected CRS: {dataset.crs}")
        if abs(dataset.res[0] - 12.5) > 1e-6 or abs(dataset.res[1] - 12.5) > 1e-6:
            raise RuntimeError(f"unexpected source resolution: {dataset.res}")

        for candidate_id, spec in CANDIDATES.items():
            col, row, width, height = spec["window"]
            array = dataset.read(1, window=Window(col, row, width, height), boundless=False)
            if array.shape != (2048, 2048):
                raise RuntimeError(f"{candidate_id}: unexpected crop shape {array.shape}")
            valid = np.isfinite(array) & (array != 0) & (array > -1000) & (array < 10000)
            valid_fraction = float(valid.mean())
            if valid_fraction < 0.995:
                raise RuntimeError(f"{candidate_id}: valid fraction {valid_fraction:.8f}")

            directory = output / candidate_id
            directory.mkdir(parents=True, exist_ok=True)
            height_path = directory / "height_i16.bin"
            array.astype("<i2", copy=False).tofile(height_path)
            if height_path.stat().st_size != 2048 * 2048 * 2:
                raise RuntimeError(f"{candidate_id}: height bytes mismatch")

            manifest = {
                "schema": "guilin-yangshuo-native-candidate/v3.2.0",
                "id": candidate_id,
                **spec,
                "grid": [2048, 2048],
                "pixelSpacingMeters": 12.5,
                "widthMeters": 25600.0,
                "heightMeters": 25600.0,
                "validFraction": valid_fraction,
                "minimumElevationMeters": float(array[valid].min()),
                "maximumElevationMeters": float(array[valid].max()),
                "dataType": "int16-little-endian",
                "nodataValue": 0,
                "heightFile": "height_i16.bin",
                "heightBytes": height_path.stat().st_size,
                "heightSha256": sha256(height_path),
                "sourceSha256": EXPECTED_SOURCE_SHA,
                "macroDeltaMeters": 0.0,
                "microDeltaMeters": 0.0,
                "truthMutationCount": 0,
                "resampling": False,
                "gapFill": False,
            }
            (directory / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            index["candidates"][candidate_id] = manifest
            print(json.dumps({
                "candidate": candidate_id,
                "validFraction": valid_fraction,
                "minimumElevationMeters": manifest["minimumElevationMeters"],
                "maximumElevationMeters": manifest["maximumElevationMeters"],
                "heightSha256": manifest["heightSha256"],
            }, ensure_ascii=False))

    (output / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    checksum_lines = []
    for path in sorted(output.rglob("*")):
        if path.is_file():
            checksum_lines.append(f"{sha256(path)}  {path.relative_to(output).as_posix()}")
    (output / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    return index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    compile_assets(args.source, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
