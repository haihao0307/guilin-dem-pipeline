#!/usr/bin/env python3
"""Acquire or ingest official GEBCO_2026 grid and TID files with fail closed QA."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/coastal_domain_v100.json"
RAW_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/raw/gebco_2026"
REPORT_PATH = REPO_ROOT / "projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json"
OFFICIAL_HOSTS = {
    "download.gebco.net",
    "dap.ceda.ac.uk",
    "data.ceda.ac.uk",
    "www.bodc.ac.uk",
    "bodc.ac.uk",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_name(value: str) -> str:
    name = Path(urllib.parse.urlparse(value).path).name if value.startswith("https://") else Path(value).name
    return name or "download.bin"


def download_https(url: str, destination: Path) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in OFFICIAL_HOSTS:
        raise RuntimeError(f"Source URL is outside the official allowlist: {url}")

    last_error: Exception | None = None
    for attempt in range(1, 6):
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "WenzhouCoastalPipeline/1.0 contact=repository-controller"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response, destination.open("wb") as output:
                content_type = response.headers.get("Content-Type", "")
                if "text/html" in content_type.lower():
                    raise RuntimeError(f"Official endpoint returned HTML instead of data: {content_type}")
                shutil.copyfileobj(response, output, length=8 * 1024 * 1024)
                return {
                    "url": url,
                    "httpStatus": getattr(response, "status", None),
                    "contentType": content_type,
                    "contentLengthHeader": response.headers.get("Content-Length"),
                    "attempts": attempt,
                }
        except Exception as exc:
            last_error = exc
            destination.unlink(missing_ok=True)
            if attempt < 5:
                time.sleep(min(2**attempt, 20))
    raise RuntimeError(f"Download failed after retries: {last_error}")


def materialize(source: str, role: str, workspace: Path) -> tuple[Path, dict[str, Any]]:
    destination = workspace / safe_name(source)
    if source.startswith("https://"):
        transfer = download_https(source, destination)
        transfer["sourceType"] = "official_https"
    else:
        source_path = Path(source).expanduser().resolve()
        if not source_path.is_file():
            raise FileNotFoundError(f"Source file is unavailable: {source_path}")
        shutil.copy2(source_path, destination)
        transfer = {
            "sourceType": "local_manual_official_download",
            "sourcePath": str(source_path),
        }

    if destination.stat().st_size < 1024:
        preview = destination.read_bytes()[:256]
        raise RuntimeError(f"Downloaded file is unexpectedly small: {destination.stat().st_size} bytes, prefix={preview!r}")

    transfer.update(
        {
            "role": role,
            "materializedPath": str(destination),
            "bytes": destination.stat().st_size,
            "sha256": sha256_file(destination),
        }
    )
    return destination, transfer


def safe_extract_member(archive: Path, role: str, workspace: Path) -> Path:
    with zipfile.ZipFile(archive) as package:
        candidates: list[zipfile.ZipInfo] = []
        for member in package.infolist():
            normalized = Path(member.filename)
            if member.is_dir() or normalized.is_absolute() or ".." in normalized.parts:
                continue
            lower = normalized.name.lower()
            if not lower.endswith((".tif", ".tiff", ".nc")):
                continue
            is_tid = "tid" in lower or "type_identifier" in lower
            if role == "tid" and is_tid:
                candidates.append(member)
            elif role == "grid" and not is_tid:
                candidates.append(member)
        if len(candidates) != 1:
            names = [item.filename for item in candidates]
            raise RuntimeError(f"Expected exactly one {role} raster in {archive.name}, found {names}")
        member = candidates[0]
        target = workspace / f"extracted_{role}_{Path(member.filename).name}"
        with package.open(member) as source_handle, target.open("wb") as target_handle:
            shutil.copyfileobj(source_handle, target_handle, length=8 * 1024 * 1024)
        return target


def extract_if_needed(path: Path, role: str, workspace: Path) -> Path:
    if zipfile.is_zipfile(path):
        return safe_extract_member(path, role, workspace)
    return path


def inspect_geotiff(path: Path) -> dict[str, Any]:
    try:
        import rasterio
    except ImportError as exc:
        raise RuntimeError(f"rasterio is required to inspect GeoTIFF sources: {exc}") from exc
    with rasterio.open(path) as dataset:
        return {
            "format": "GeoTIFF",
            "driver": dataset.driver,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "width": dataset.width,
            "height": dataset.height,
            "count": dataset.count,
            "dtypes": list(dataset.dtypes),
            "nodata": dataset.nodata,
            "resolution": [abs(dataset.res[0]), abs(dataset.res[1])],
            "bounds": [dataset.bounds.left, dataset.bounds.bottom, dataset.bounds.right, dataset.bounds.top],
            "tags": dataset.tags(),
            "imageStructure": dataset.tags(ns="IMAGE_STRUCTURE"),
        }


def inspect_netcdf(path: Path, role: str) -> dict[str, Any]:
    try:
        import xarray as xr
    except ImportError as exc:
        raise RuntimeError(f"xarray is required to inspect NetCDF sources: {exc}") from exc
    with xr.open_dataset(path, decode_cf=True) as dataset:
        variable_names = list(dataset.data_vars)
        coordinate_names = list(dataset.coords)
        longitude_name = next((name for name in coordinate_names if name.lower() in {"lon", "longitude"}), None)
        latitude_name = next((name for name in coordinate_names if name.lower() in {"lat", "latitude"}), None)
        if not longitude_name or not latitude_name:
            raise RuntimeError(f"NetCDF lacks longitude or latitude coordinates: {coordinate_names}")
        longitude = dataset[longitude_name]
        latitude = dataset[latitude_name]
        candidates = [
            name
            for name in variable_names
            if (role == "tid" and ("tid" in name.lower() or "identifier" in name.lower()))
            or (role == "grid" and name.lower() in {"elevation", "z", "height", "height_above_mean_sea_level"})
        ]
        return {
            "format": "NetCDF",
            "variables": variable_names,
            "coordinates": coordinate_names,
            "selectedCandidates": candidates,
            "longitudeRange": [float(longitude.min()), float(longitude.max())],
            "latitudeRange": [float(latitude.min()), float(latitude.max())],
            "dimensions": {name: int(size) for name, size in dataset.sizes.items()},
            "attributes": {key: str(value) for key, value in dataset.attrs.items()},
        }


def inspect_source(path: Path, role: str) -> dict[str, Any]:
    lower = path.name.lower()
    if lower.endswith((".tif", ".tiff")):
        return inspect_geotiff(path)
    if lower.endswith(".nc"):
        return inspect_netcdf(path, role)
    raise RuntimeError(f"Unsupported GEBCO source format: {path.name}")


def covers_domain(metadata: dict[str, Any], expected_bounds: list[float]) -> bool:
    if metadata["format"] == "GeoTIFF":
        west, south, east, north = metadata["bounds"]
    else:
        west, east = metadata["longitudeRange"]
        south, north = metadata["latitudeRange"]
    exp_west, exp_south, exp_east, exp_north = expected_bounds
    return west <= exp_west and south <= exp_south and east >= exp_east and north >= exp_north


def atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=destination.parent) as temporary:
        temp_path = Path(temporary.name)
    try:
        shutil.copy2(source, temp_path)
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--grid-source", required=True, help="Official HTTPS URL or local official download")
    parser.add_argument("--tid-source", required=True, help="Official HTTPS URL or local official download")
    parser.add_argument("--expected-grid-sha256")
    parser.add_argument("--expected-tid-sha256")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    expected_bounds = config["domains"]["bathymetryAndTideBoundaryWgs84"]["bounds"]
    report: dict[str, Any] = {
        "schema": "wenzhou_gebco_2026_acquisition@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "dataset": "GEBCO_2026 Grid and TID Grid",
        "requestedBoundsWgs84": expected_bounds,
        "passed": False,
        "sources": [],
    }

    try:
        with tempfile.TemporaryDirectory(prefix="wenzhou-gebco-") as temporary_directory:
            workspace = Path(temporary_directory)
            grid_package, grid_transfer = materialize(args.grid_source, "grid", workspace)
            tid_package, tid_transfer = materialize(args.tid_source, "tid", workspace)
            report["sources"].extend([grid_transfer, tid_transfer])

            if args.expected_grid_sha256 and grid_transfer["sha256"] != args.expected_grid_sha256.lower():
                raise RuntimeError("Grid package SHA256 does not match the declared receipt")
            if args.expected_tid_sha256 and tid_transfer["sha256"] != args.expected_tid_sha256.lower():
                raise RuntimeError("TID package SHA256 does not match the declared receipt")

            grid_raster = extract_if_needed(grid_package, "grid", workspace)
            tid_raster = extract_if_needed(tid_package, "tid", workspace)
            grid_metadata = inspect_source(grid_raster, "grid")
            tid_metadata = inspect_source(tid_raster, "tid")
            if not covers_domain(grid_metadata, expected_bounds):
                raise RuntimeError("GEBCO grid does not cover the configured coastal domain")
            if not covers_domain(tid_metadata, expected_bounds):
                raise RuntimeError("GEBCO TID grid does not cover the configured coastal domain")

            RAW_ROOT.mkdir(parents=True, exist_ok=True)
            grid_archive_target = RAW_ROOT / f"official_grid_source_{grid_package.name}"
            tid_archive_target = RAW_ROOT / f"official_tid_source_{tid_package.name}"
            atomic_copy(grid_package, grid_archive_target)
            atomic_copy(tid_package, tid_archive_target)

            grid_suffix = grid_raster.suffix.lower()
            tid_suffix = tid_raster.suffix.lower()
            grid_target = RAW_ROOT / f"GEBCO_2026_GRID_SOURCE{grid_suffix}"
            tid_target = RAW_ROOT / f"GEBCO_2026_TID_SOURCE{tid_suffix}"
            atomic_copy(grid_raster, grid_target)
            atomic_copy(tid_raster, tid_target)

            report.update(
                {
                    "passed": True,
                    "versionConfirmed": "GEBCO_2026",
                    "grid": {
                        "path": str(grid_target.relative_to(REPO_ROOT)),
                        "bytes": grid_target.stat().st_size,
                        "sha256": sha256_file(grid_target),
                        "metadata": grid_metadata,
                    },
                    "tid": {
                        "path": str(tid_target.relative_to(REPO_ROOT)),
                        "bytes": tid_target.stat().st_size,
                        "sha256": sha256_file(tid_target),
                        "metadata": tid_metadata,
                    },
                }
            )
    except Exception as exc:
        report["error"] = type(exc).__name__
        report["detail"] = str(exc)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
