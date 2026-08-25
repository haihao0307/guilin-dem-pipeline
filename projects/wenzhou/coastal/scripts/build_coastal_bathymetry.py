#!/usr/bin/env python3
"""Build full-buffer and truth-AOI GEBCO bathymetry quality layers.

The official GEBCO subset is preserved across the entire buffered coastal
forcing domain. The archived 12.5 m land DEM and its marine mask are never
modified. A second bathymetry layer is clipped to the archived marine mask for
coastline comparison and conflict QA.
"""

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
INDIRECT_TID_CODES = set(range(40, 49))
UNKNOWN_TID_CODES = {70, 71, 72}
TID_CODE_DEFINITIONS = {
    0: "land",
    10: "singlebeam",
    11: "multibeam",
    12: "seismic",
    13: "isolated_sounding",
    14: "enc_sounding",
    15: "lidar",
    16: "optical_light_sensor",
    17: "combination_of_direct_measurements",
    40: "satellite_gravity_guided_prediction",
    41: "computer_algorithm_interpolation",
    42: "digital_bathymetric_contours",
    43: "digital_enc_bathymetric_contours",
    44: "mixed_measured_and_derived_gridded_bathymetry",
    45: "flight_gravity_prediction",
    46: "grounded_iceberg_draft_estimate",
    47: "grounded_argo_float",
    48: "animal_borne_logger",
    70: "pre_generated_mixed_source_grid",
    71: "unknown_source",
    72: "steering_point",
}


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


def reproject_array(
    source_path: Path,
    role: str,
    transform: Any,
    width: int,
    height: int,
    dtype: str,
    nodata: float | int,
    resampling: Any,
) -> np.ndarray:
    import rasterio
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


def write_cog(
    path: Path,
    array: np.ndarray,
    transform: Any,
    crs: str,
    nodata: float | int,
    resampling: str,
    tags: dict[str, str],
) -> None:
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


def stats(values: np.ndarray) -> dict[str, Any]:
    if values.size == 0:
        return {
            "count": 0,
            "minimumMeters": None,
            "maximumMeters": None,
            "percentilesMeters": {},
        }
    return {
        "count": int(values.size),
        "minimumMeters": float(np.min(values)),
        "maximumMeters": float(np.max(values)),
        "meanMeters": float(np.mean(values)),
        "percentilesMeters": {
            "p01": float(np.percentile(values, 1)),
            "p05": float(np.percentile(values, 5)),
            "p50": float(np.percentile(values, 50)),
            "p95": float(np.percentile(values, 95)),
            "p99": float(np.percentile(values, 99)),
        },
    }


def histogram(values: np.ndarray) -> dict[str, Any]:
    counts = Counter(int(value) for value in values.tolist())
    return {
        str(code): {
            "count": count,
            "definition": TID_CODE_DEFINITIONS.get(code, "unrecognised_code"),
        }
        for code, count in sorted(counts.items())
    }


def main() -> int:
    try:
        from rasterio.enums import Resampling
    except ImportError as exc:
        print(f"Required dependency missing: {exc}", file=sys.stderr)
        return 2

    report: dict[str, Any] = {
        "schema": "wenzhou_gebco_2026_qa@1.1.0",
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
        tid_valid_float = np.isfinite(tid_float) & (tid_float != 255.0)
        tid = np.full((height, width), 255, dtype="uint8")
        tid[tid_valid_float] = np.rint(tid_float[tid_valid_float]).astype("uint8")
        marine = reproject_marine_mask(marine_source, transform, width, height)

        valid_bathy = np.isfinite(bathy) & (bathy != -99999.0)
        valid_tid = tid != 255
        full_coverage = valid_bathy & valid_tid
        truth_marine = marine == 1
        truth_land = marine == 0
        truth_unknown = marine == 255

        full_buffer_bathy = np.where(valid_bathy, bathy, -99999.0).astype("float32")
        full_buffer_tid = np.where(valid_tid, tid, 255).astype("uint8")
        truth_marine_bathy = np.where(truth_marine & valid_bathy, bathy, -99999.0).astype("float32")

        conflict = np.full((height, width), 255, dtype="uint8")
        conflict[truth_land | truth_marine] = 0
        conflict[truth_marine & valid_bathy & (bathy > 0.0)] = 1
        conflict[truth_land & valid_bathy & (bathy <= 0.0)] = 2

        seabed_candidate = valid_bathy & (bathy <= 0.0) & valid_tid & (tid != 0)
        direct = seabed_candidate & np.isin(tid, list(DIRECT_TID_CODES))
        indirect = seabed_candidate & np.isin(tid, list(INDIRECT_TID_CODES))
        mixed_unknown = seabed_candidate & (
            np.isin(tid, list(UNKNOWN_TID_CODES))
            | (~np.isin(tid, list(DIRECT_TID_CODES | INDIRECT_TID_CODES | {0})))
        )
        shallow = seabed_candidate & (bathy > -20.0)

        uncertainty = np.full((height, width), 255, dtype="uint8")
        uncertainty[direct] = 0
        uncertainty[indirect] = 1
        uncertainty[mixed_unknown] = 2
        uncertainty[shallow] = 3
        uncertainty[truth_marine & valid_bathy & (bathy > 0.0)] = 4
        uncertainty[truth_land & valid_bathy & (bathy <= 0.0)] = 5

        full_bathy_path = DERIVED_ROOT / "WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif"
        truth_marine_path = DERIVED_ROOT / "WENZHOU_TRUTH_AOI_MARINE_BATHY_100M_EPSG32651_COG.tif"
        tid_path = DERIVED_ROOT / "WENZHOU_COASTAL_TID_100M_EPSG32651_COG.tif"
        uncertainty_path = DERIVED_ROOT / "WENZHOU_COASTAL_VERTICAL_DATUM_UNCERTAINTY_100M_COG.tif"
        conflict_path = DERIVED_ROOT / "WENZHOU_COASTAL_LAND_SEA_CONFLICT_100M_COG.tif"

        common_tags = {
            "SOURCE_DATASET": "GEBCO_2026",
            "SOURCE_RESOLUTION": "15 arc-second",
            "MODEL_ALIGNMENT_RESOLUTION": "100 m",
            "NATIVE_12_5M_BATHYMETRY_CLAIM": "false",
            "LAND_TRUTH_LFS_OID": config["truthDem"]["lfsOid"],
            "VERTICAL_REFERENCE_NOTE": "GEBCO assumes MSL; shallow source datums may differ",
        }
        write_cog(
            full_bathy_path,
            full_buffer_bathy,
            transform,
            "EPSG:32651",
            -99999.0,
            "average",
            {
                **common_tags,
                "ROLE": "full_buffer_gebco_elevation_reference",
                "LAND_SEA_USE": "apply coastline or wet-dry mask downstream; values remain unmodified",
            },
        )
        write_cog(
            truth_marine_path,
            truth_marine_bathy,
            transform,
            "EPSG:32651",
            -99999.0,
            "average",
            {
                **common_tags,
                "ROLE": "archived_truth_aoi_marine_masked_bathymetry",
                "MASK_SOURCE": "WENZHOU_QINGJIANG_marine_mask_COG.tif",
            },
        )
        write_cog(
            tid_path,
            full_buffer_tid,
            transform,
            "EPSG:32651",
            255,
            "nearest",
            {
                **common_tags,
                "ROLE": "full_buffer_gebco_type_identifier",
                "TID_CODES": "0 land; 10-17 direct; 40-48 indirect; 70-72 unknown or mixed",
            },
        )
        write_cog(
            uncertainty_path,
            uncertainty,
            transform,
            "EPSG:32651",
            255,
            "nearest",
            {
                **common_tags,
                "ROLE": "source_and_vertical_datum_uncertainty",
                "VALUES": (
                    "0=direct seabed;1=indirect seabed;2=mixed or unknown seabed;"
                    "3=shallow datum review;4=truth marine GEBCO positive;"
                    "5=truth land GEBCO nonpositive;255=not classified"
                ),
            },
        )
        write_cog(
            conflict_path,
            conflict,
            transform,
            "EPSG:32651",
            255,
            "nearest",
            {
                **common_tags,
                "ROLE": "archived_truth_mask_vs_gebco_conflict",
                "VALUES": "0=no conflict;1=truth marine GEBCO positive;2=truth land GEBCO nonpositive;255=outside truth mask",
            },
        )

        outputs = [
            inspect_output(path)
            for path in (
                full_bathy_path,
                truth_marine_path,
                tid_path,
                uncertainty_path,
                conflict_path,
            )
        ]
        structure_passed = all(
            item["crs"] == "EPSG:32651"
            and item["resolution"] == [spacing, spacing]
            and item["imageStructure"].get("LAYOUT") == "COG"
            and item["imageStructure"].get("COMPRESSION") == "DEFLATE"
            for item in outputs
        )

        full_values = bathy[valid_bathy]
        candidate_values = bathy[seabed_candidate]
        truth_marine_values = bathy[truth_marine & valid_bathy]
        positive_truth_marine = truth_marine & valid_bathy & (bathy > 0.0)
        nonpositive_truth_land = truth_land & valid_bathy & (bathy <= 0.0)
        open_boundary = np.zeros((height, width), dtype=bool)
        open_boundary[0, :] = True
        open_boundary[-1, :] = True
        open_boundary[:, 0] = True
        open_boundary[:, -1] = True

        report.update(
            {
                "passed": (
                    structure_passed
                    and int(valid_bathy.sum()) == width * height
                    and int(valid_tid.sum()) == width * height
                    and candidate_values.size > 0
                    and int((open_boundary & valid_bathy).sum()) == int(open_boundary.sum())
                ),
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
                    "cellCount": width * height,
                    "bounds": aligned_bounds,
                    "fullBufferBathymetryCoveragePercent": 100.0 * float(valid_bathy.sum()) / float(width * height),
                    "fullBufferTidCoveragePercent": 100.0 * float(valid_tid.sum()) / float(width * height),
                    "openBoundaryValidCells": int((open_boundary & valid_bathy).sum()),
                    "openBoundaryCellCount": int(open_boundary.sum()),
                },
                "fullBufferElevation": stats(full_values),
                "preliminaryNonpositiveSeabedReference": {
                    **stats(candidate_values),
                    "definition": "GEBCO elevation <= 0 m and TID != land; final sea mask pending coastline and wet-dry topology",
                },
                "truthAoiMarineMaskComparison": {
                    **stats(truth_marine_values),
                    "truthMarineCells": int(truth_marine.sum()),
                    "truthLandCells": int(truth_land.sum()),
                    "outsideTruthMaskCells": int(truth_unknown.sum()),
                    "truthMarineGebcoPositiveCells": int(positive_truth_marine.sum()),
                    "truthLandGebcoNonpositiveCells": int(nonpositive_truth_land.sum()),
                },
                "tidHistogramFullBuffer": histogram(tid[valid_tid]),
                "tidHistogramPreliminarySeabed": histogram(tid[seabed_candidate]),
                "sourceQualityPreliminarySeabed": {
                    "directMeasurementCells": int(direct.sum()),
                    "indirectOrInterpolatedCells": int(indirect.sum()),
                    "mixedOrUnknownCells": int(mixed_unknown.sum()),
                    "shallowDatumReviewCells": int(shallow.sum()),
                },
                "outputs": outputs,
            }
        )
        if not report["passed"]:
            report["error"] = "derived_full_buffer_bathymetry_qa_failed"
    except Exception as exc:
        report["error"] = type(exc).__name__
        report["detail"] = str(exc)

    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    QA_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
