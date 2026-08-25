#!/usr/bin/env python3
"""Build independent 100 m coastal bathymetry, TID and uncertainty COG layers."""

from __future__ import annotations

import hashlib
import json
import math
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/coastal_domain_v100.json"
PREFLIGHT_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/PARENT_TRUTH_PREFLIGHT.json"
ACQUISITION_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json"
DERIVED_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/derived"
QA_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/GEBCO_2026_QA.json"

DIRECT_TID_CODES = set(range(10, 18))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_passed_report(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise RuntimeError(f"Required {label} report is missing: {path}")
    report = json.loads(path.read_text(encoding="utf-8"))
    if not report.get("passed"):
        raise RuntimeError(f"Required {label} report has not passed: {path}")
    return report


def choose_source_dataset(path: Path, role: str):
    import rasterio

    root = rasterio.open(path)
    if not root.subdatasets:
        return root
    subdatasets = root.subdatasets
    root.close()
    role_terms = {
        "grid": ("elevation", "height_above_mean_sea_level", "gebco_2026", "z"),
        "tid": ("tid", "type_identifier", "identifier"),
    }[role]
    matches = [item for item in subdatasets if any(term in item.lower() for term in role_terms)]
    if len(matches) != 1:
        raise RuntimeError(f"Unable to identify one {role} subdataset in {path.name}: {subdatasets}")
    return rasterio.open(matches[0])


def aligned_grid(bounds: list[float], spacing: float) -> tuple[Any, int, int, list[float]]:
    from rasterio.transform import from_origin

    left = math.floor(bounds[0] / spacing) * spacing
    bottom = math.floor(bounds[1] / spacing) * spacing
    right = math.ceil(bounds[2] / spacing) * spacing
    top = math.ceil(bounds[3] / spacing) * spacing
    width = int(round((right - left) / spacing))
    height = int(round((top - bottom) / spacing))
    return from_origin(left, top, spacing, spacing), width, height, [left, bottom, right, top]


def reproject_array(source_path: Path, role: str, transform: Any, width: int, height: int, dtype: str, nodata: float | int, resampling: Any) -> np.ndarray:
    from rasterio.warp import reproject

    destination = np.full((height, width), nodata, dtype=dtype)
    with choose_source_dataset(source_path, role) as source:
        reproject(
            source=rasterio.band(source, 1),
            destination=destination,
            src_transform=source.transform,
            src_crs=source.crs,
            src_nodata=source.nodata,
            dst_transform=transform,
            dst_crs="EPSG:32651",
            dst_nodata=nodata,
            resampling=resampling,
            num_threads=2,
        )
    return destination


def reproject_marine_mask(source_path: Path, transform: Any, width: int, height: int) -> np.ndarray:
    import rasterio
    from rasterio.warp import reproject

    destination = np.full((height, width), 255, dtype="uint8")
    with rasterio.open(source_path) as source:
        reproject(
            source=rasterio.band(source, 1),
            destination=destination,
            src_transform=source.transform,
            src_crs=source.crs,
            src_nodata=source.nodata,
            dst_transform=transform,
            dst_crs="EPSG:32651",
            dst_nodata=255,
            resampling=rasterio.enums.Resampling.nearest,
            num_threads=2,
        )
    return destination


def write_cog(path: Path, array: np.ndarray, transform: Any, crs: str, nodata: float | int, resampling: str, tags: dict[str, str]) -> None:
    import rasterio
    from rasterio.shutil import copy as raster_copy

    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="wenzhou-cog-") as temporary_directory:
        temporary = Path(temporary_directory) / "source.tif"
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
            "blockxsize": 512,
            "blockysize": 512,
            "compress": "DEFLATE",
            "predictor": 2 if np.issubdtype(array.dtype, np.integer) else 3,
            "BIGTIFF": "IF_SAFER",
        }
        with rasterio.open(temporary, "w", **profile) as dataset:
            dataset.write(array, 1)
            dataset.update_tags(**tags)
        try:
            raster_copy(
                temporary,
                path,
                driver="COG",
                compress="DEFLATE",
                blocksize=512,
                overview_resampling=resampling,
                BIGTIFF="IF_SAFER",
            )
        except Exception as exc:
            raise RuntimeError(f"GDAL COG driver failed for {path.name}: {exc}") from exc


def inspect_output(path: Path) -> dict[str, Any]:
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
            "bounds": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
            "blockShapes": [list(shape) for shape in dataset.block_shapes],
            "overviews": dataset.overviews(1),
            "imageStructure": dataset.tags(ns="IMAGE_STRUCTURE"),
            "tags": dataset.tags(),
        }


def main() -> int:
    try:
        import rasterio
        from rasterio.enums import Resampling
    except ImportError as exc:
        print(f"Required dependency missing: {exc}", file=sys.stderr)
        return 2

    report: dict[str, Any] = {
        "schema": "wenzhou_gebco_2026_qa@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "passed": False,
    }
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        preflight = load_passed_report(PREFLIGHT_PATH, "parent truth preflight")
        acquisition = load_passed_report(ACQUISITION_PATH, "GEBCO acquisition")

        grid_source = REPO_ROOT / acquisition["grid"]["path"]
        tid_source = REPO_ROOT / acquisition["tid"]["path"]
        marine_source = REPO_ROOT / "projects/wenzhou/archive/truth/evidence/WENZHOU_QINGJIANG_marine_mask_COG.tif"
        for required in (grid_source, tid_source, marine_source):
            if not required.is_file():
                raise FileNotFoundError(required)

        model = config["domains"]["coastalModelGrid"]
        bounds = config["domains"]["bathymetryAndTideBoundaryProjected"]["bounds"]
        spacing = float(model["pixelSpacingMeters"][0])
        transform, width, height, aligned_bounds = aligned_grid(bounds, spacing)

        bathy = reproject_array(
            grid_source,
            "grid",
            transform,
            width,
            height,
            "float32",
            -99999.0,
            Resampling.bilinear,
        )
        tid_float = reproject_array(
            tid_source,
            "tid",
            transform,
            width,
            height,
            "float32",
            255.0,
            Resampling.nearest,
        )
        tid = np.where(np.isfinite(tid_float), np.rint(tid_float), 255).astype("uint8")
        marine = reproject_marine_mask(marine_source, transform, width, height)

        valid_bathy = bathy != -99999.0
        marine_cells = marine == 1
        land_cells = marine == 0
        unknown_marine_mask = marine == 255

        coastal_bathy = np.where(marine_cells & valid_bathy, bathy, -99999.0).astype("float32")
        coastal_tid = np.where(marine_cells, tid, 255).astype("uint8")
        direct_measurement = np.isin(coastal_tid, list(DIRECT_TID_CODES))
        uncertainty = np.zeros((height, width), dtype="uint8")
        uncertainty[marine_cells & (~direct_measurement)] = 1
        uncertainty[marine_cells & valid_bathy & (bathy > -20.0)] = 1
        uncertainty[unknown_marine_mask] = 2

        bathy_path = DERIVED_ROOT / "WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif"
        tid_path = DERIVED_ROOT / "WENZHOU_COASTAL_TID_100M_EPSG32651_COG.tif"
        uncertainty_path = DERIVED_ROOT / "WENZHOU_COASTAL_VERTICAL_DATUM_UNCERTAINTY_100M_COG.tif"

        common_tags = {
            "SOURCE_DATASET": "GEBCO_2026",
            "SOURCE_RESOLUTION": "15 arc-second",
            "MODEL_ALIGNMENT_RESOLUTION": "100 m",
            "NATIVE_12_5M_BATHYMETRY_CLAIM": "false",
            "LAND_TRUTH_LFS_OID": config["truthDem"]["lfsOid"],
        }
        write_cog(bathy_path, coastal_bathy, transform, "EPSG:32651", -99999.0, "average", {**common_tags, "ROLE": "marine_only_bathymetry"})
        write_cog(tid_path, coastal_tid, transform, "EPSG:32651", 255, "nearest", {**common_tags, "ROLE": "GEBCO_type_identifier"})
        write_cog(
            uncertainty_path,
            uncertainty,
            transform,
            "EPSG:32651",
            255,
            "nearest",
            {
                **common_tags,
                "ROLE": "vertical_datum_and_source_uncertainty",
                "VALUES": "0=lower_uncertainty,1=review_required,2=land_sea_mask_unknown,255=nodata",
            },
        )

        marine_valid = coastal_bathy != -99999.0
        marine_values = coastal_bathy[marine_valid]
        tid_counts = Counter(int(value) for value in coastal_tid[coastal_tid != 255].tolist())
        anomalous_positive = marine_cells & valid_bathy & (bathy > 0.0)
        missing_bathy = marine_cells & (~valid_bathy)

        outputs = [inspect_output(path) for path in (bathy_path, tid_path, uncertainty_path)]
        structure_passed = all(
            item["crs"] == "EPSG:32651"
            and item["resolution"] == [spacing, spacing]
            and item["imageStructure"].get("LAYOUT") == "COG"
            and item["imageStructure"].get("COMPRESSION") == "DEFLATE"
            for item in outputs
        )
        report.update(
            {
                "passed": structure_passed and marine_values.size > 0 and int(missing_bathy.sum()) == 0,
                "parentTruthPreflight": {
                    "passed": preflight["passed"],
                    "truthDemSha256": config["truthDem"]["lfsOid"].removeprefix("sha256:"),
                    "landPixelsModified": 0,
                },
                "modelGrid": {
                    "crs": "EPSG:32651",
                    "spacingMeters": spacing,
                    "width": width,
                    "height": height,
                    "bounds": aligned_bounds,
                },
                "bathymetry": {
                    "validMarineCells": int(marine_values.size),
                    "missingMarineCells": int(missing_bathy.sum()),
                    "anomalousPositiveMarineCells": int(anomalous_positive.sum()),
                    "minimumMeters": float(np.min(marine_values)) if marine_values.size else None,
                    "maximumMeters": float(np.max(marine_values)) if marine_values.size else None,
                    "percentilesMeters": {
                        "p01": float(np.percentile(marine_values, 1)) if marine_values.size else None,
                        "p05": float(np.percentile(marine_values, 5)) if marine_values.size else None,
                        "p50": float(np.percentile(marine_values, 50)) if marine_values.size else None,
                        "p95": float(np.percentile(marine_values, 95)) if marine_values.size else None,
                        "p99": float(np.percentile(marine_values, 99)) if marine_values.size else None,
                    },
                },
                "tidHistogram": {str(code): count for code, count in sorted(tid_counts.items())},
                "sourceQuality": {
                    "directMeasurementCells": int((marine_cells & direct_measurement).sum()),
                    "indirectOrInterpolatedCells": int((marine_cells & (~direct_measurement) & (coastal_tid != 255)).sum()),
                    "unknownMaskCells": int(unknown_marine_mask.sum()),
                },
                "outputs": outputs,
            }
        )
        if not report["passed"]:
            report["error"] = "derived_bathymetry_qa_failed"
    except Exception as exc:
        report["error"] = type(exc).__name__
        report["detail"] = str(exc)

    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    QA_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
