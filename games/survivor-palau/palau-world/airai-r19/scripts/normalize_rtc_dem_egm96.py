#!/usr/bin/env python3
"""R19 Palau RTC DEM vertical normalization and explicit common-grid derivation.

This script never edits source archives or source GeoTIFFs. It reverses the ASF
MapReady EGM96-to-ellipsoid adjustment using the NGA EGM96 15-minute grid:

    H_EGM96 = h_ASF_RTC_ELLIPSOID - N_EGM96

It then creates a derived union grid anchored to the F0130 pixel lattice. F0130
is copied exactly. F0140 is bilinearly resampled only where F0130 has no valid
sample. NoData is never filled.

The stored posting is 12.5 m, but the source elevation information is SRTMGL1
nominal 30 m. Outputs must not be described as native 12.5 m terrain truth.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject

NODATA = -9999.0


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_frame(source_path: Path, geoid_path: Path, output_path: Path) -> dict:
    with rasterio.open(source_path) as source, rasterio.open(geoid_path) as geoid:
        source_values = source.read(1)
        source_valid = source_values != source.nodata
        undulation = np.full(source_values.shape, np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(geoid, 1),
            destination=undulation,
            src_transform=geoid.transform,
            src_crs=geoid.crs,
            dst_transform=source.transform,
            dst_crs=source.crs,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
            num_threads=4,
        )
        valid = source_valid & np.isfinite(undulation)
        orthometric = np.full(source_values.shape, NODATA, dtype=np.float32)
        orthometric[valid] = source_values[valid].astype(np.float32) - undulation[valid]

        profile = source.profile.copy()
        profile.update(
            dtype="float32",
            nodata=NODATA,
            tiled=True,
            blockxsize=512,
            blockysize=512,
            compress="DEFLATE",
            predictor=3,
            zlevel=6,
            BIGTIFF="IF_SAFER",
        )
        with rasterio.open(output_path, "w", **profile) as destination:
            destination.write(orthometric, 1)
            destination.update_tags(
                PRODUCT="R19 derived orthometric EGM96 terrain reference",
                SOURCE_FILE=source_path.name,
                SOURCE_SHA256=file_sha256(source_path),
                SOURCE_DEM="SRTMGL1 nominal 30 m, ASF June 2015 v1.1 corrections",
                STORED_POSTING="12.5 m",
                VERTICAL_OPERATION="H_EGM96 = h_ASF_RTC_ELLIPSOID - N_EGM96",
                GEOID_FILE=geoid_path.name,
                GEOID_SHA256=file_sha256(geoid_path),
                NATIVE_12_5M="false",
                NO_DATA_FILLED="false",
            )

        values = orthometric[valid]
        near_sea = values[np.abs(values) <= 5]
        return {
            "sourceFilename": source_path.name,
            "sourceSha256": file_sha256(source_path),
            "derivedFilename": output_path.name,
            "derivedSha256": file_sha256(output_path),
            "derivedBytes": output_path.stat().st_size,
            "width": source.width,
            "height": source.height,
            "crs": str(source.crs),
            "transform": list(source.transform)[:6],
            "bounds": list(source.bounds),
            "validCells": int(valid.sum()),
            "sourceNoDataCells": int((~source_valid).sum()),
            "geoidRangeM": [float(np.nanmin(undulation[valid])), float(np.nanmax(undulation[valid]))],
            "orthometricRangeM": [float(values.min()), float(values.max())],
            "orthometricPercentilesM": {
                "p01": float(np.percentile(values, 1)),
                "p50": float(np.percentile(values, 50)),
                "p99": float(np.percentile(values, 99)),
            },
            "nearSeaAbsLe5M": {
                "cellCount": int(near_sea.size),
                "medianM": float(np.median(near_sea)),
                "p05M": float(np.percentile(near_sea, 5)),
                "p95M": float(np.percentile(near_sea, 95)),
            },
        }


def build_canonical(f0130_path: Path, f0140_path: Path, output_path: Path, mask_path: Path) -> dict:
    with rasterio.open(f0130_path) as south, rasterio.open(f0140_path) as north:
        if south.crs != north.crs:
            raise RuntimeError(f"CRS mismatch: {south.crs} != {north.crs}")
        resolution = float(south.transform.a)
        if not math.isclose(resolution, float(north.transform.a), rel_tol=0, abs_tol=1e-9):
            raise RuntimeError("Stored pixel spacing differs between frames")

        left = min(south.bounds.left, north.bounds.left)
        bottom = min(south.bounds.bottom, north.bounds.bottom)
        right = max(south.bounds.right, north.bounds.right)
        top = max(south.bounds.top, north.bounds.top)
        anchor_x = south.transform.c
        anchor_y = south.transform.f
        canonical_left = anchor_x - math.ceil((anchor_x - left) / resolution) * resolution
        canonical_top = anchor_y + math.ceil((top - anchor_y) / resolution) * resolution
        canonical_right = anchor_x + math.ceil((right - anchor_x) / resolution) * resolution
        canonical_bottom = anchor_y - math.ceil((anchor_y - bottom) / resolution) * resolution
        width = int(round((canonical_right - canonical_left) / resolution))
        height = int(round((canonical_top - canonical_bottom) / resolution))
        transform = Affine(resolution, 0, canonical_left, 0, -resolution, canonical_top)

        canonical = np.full((height, width), NODATA, dtype=np.float32)
        reproject(
            source=rasterio.band(north, 1),
            destination=canonical,
            src_transform=north.transform,
            src_crs=north.crs,
            src_nodata=NODATA,
            dst_transform=transform,
            dst_crs=south.crs,
            dst_nodata=NODATA,
            resampling=Resampling.bilinear,
            num_threads=4,
        )
        provenance = np.zeros((height, width), dtype=np.uint8)
        provenance[canonical != NODATA] = 2

        south_values = south.read(1)
        column = int(round((south.bounds.left - canonical_left) / resolution))
        row = int(round((canonical_top - south.bounds.top) / resolution))
        canonical_window = canonical[row : row + south.height, column : column + south.width]
        provenance_window = provenance[row : row + south.height, column : column + south.width]
        south_valid = south_values != NODATA
        overlap = south_valid & (canonical_window != NODATA)
        canonical_window[south_valid] = south_values[south_valid]
        provenance_window[south_valid & ~overlap] = 1
        provenance_window[overlap] = 3

        profile = south.profile.copy()
        profile.update(
            width=width,
            height=height,
            transform=transform,
            dtype="float32",
            nodata=NODATA,
            tiled=True,
            blockxsize=512,
            blockysize=512,
            compress="DEFLATE",
            predictor=3,
            zlevel=6,
            BIGTIFF="IF_SAFER",
        )
        with rasterio.open(output_path, "w", **profile) as destination:
            destination.write(canonical, 1)
            destination.update_tags(
                PRODUCT="R19 canonical derived Palau orthometric terrain reference",
                GRID_AUTHORITY="F0130 pixel lattice",
                OVERLAP_POLICY="F0130 exact-copy priority; F0140 only outside valid F0130 coverage",
                SOURCE_RESOLUTION="SRTMGL1 nominal 30 m",
                STORED_POSTING="12.5 m",
                NATIVE_12_5M="false",
                NO_DATA_FILLED="false",
            )
        mask_profile = profile.copy()
        mask_profile.update(dtype="uint8", nodata=0, predictor=1)
        with rasterio.open(mask_path, "w", **mask_profile) as destination:
            destination.write(provenance, 1)
            destination.update_tags(CODES="0=NoData,1=F0130_only,2=F0140_resampled_only,3=overlap_F0130_priority")

        valid = canonical != NODATA
        values = canonical[valid]
        return {
            "derivedFilename": output_path.name,
            "derivedSha256": file_sha256(output_path),
            "derivedBytes": output_path.stat().st_size,
            "provenanceMaskFilename": mask_path.name,
            "provenanceMaskSha256": file_sha256(mask_path),
            "provenanceMaskBytes": mask_path.stat().st_size,
            "crs": str(south.crs),
            "transform": list(transform)[:6],
            "bounds": [canonical_left, canonical_bottom, canonical_right, canonical_top],
            "width": width,
            "height": height,
            "validCells": int(valid.sum()),
            "noDataCells": int((~valid).sum()),
            "orthometricRangeM": [float(values.min()), float(values.max())],
            "orthometricPercentilesM": {
                "p01": float(np.percentile(values, 1)),
                "p50": float(np.percentile(values, 50)),
                "p99": float(np.percentile(values, 99)),
            },
            "provenanceCounts": {str(code): int((provenance == code).sum()) for code in range(4)},
            "gridAuthority": "F0130 pixel lattice",
            "overlapPolicy": "F0130 exact-copy priority; F0140 bilinearly resampled only outside valid F0130 coverage",
            "native12_5m": False,
            "sourceDemResolution": "SRTMGL1 nominal 30 m",
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--f0130", type=Path, required=True)
    parser.add_argument("--f0140", type=Path, required=True)
    parser.add_argument("--egm96", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    for path in (args.f0130, args.f0140, args.egm96):
        if not path.is_file():
            parser.error(f"missing input: {path}")
    args.out_dir.mkdir(parents=True, exist_ok=True)

    south_output = args.out_dir / "F0130_ORTHOMETRIC_EGM96_12_5M_POSTING_SRTM30_SOURCE.tif"
    north_output = args.out_dir / "F0140_ORTHOMETRIC_EGM96_12_5M_POSTING_SRTM30_SOURCE.tif"
    south = normalize_frame(args.f0130, args.egm96, south_output)
    north = normalize_frame(args.f0140, args.egm96, north_output)
    canonical = build_canonical(
        south_output,
        north_output,
        args.out_dir / "PALAU_R19_ORTHOMETRIC_EGM96_CANONICAL_F0130_GRID_12_5M_POSTING_SRTM30_SOURCE.tif",
        args.out_dir / "PALAU_R19_CANONICAL_PROVENANCE_MASK.tif",
    )
    receipt = {
        "schema": "kaopu.survivor-palau.r19-vertical-normalization/1.0",
        "operation": "H_EGM96 = h_ASF_RTC_ELLIPSOID - N_EGM96",
        "geoid": {
            "filename": args.egm96.name,
            "bytes": args.egm96.stat().st_size,
            "sha256": file_sha256(args.egm96),
        },
        "sources": {"F0130": south, "F0140": north, "canonical": canonical},
        "visualBuildAllowed": False,
        "interactive3D": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (args.out_dir / "R19_VERTICAL_NORMALIZATION_RECEIPT.generated.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
