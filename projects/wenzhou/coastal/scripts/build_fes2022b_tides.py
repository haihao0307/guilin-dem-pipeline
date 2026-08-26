#!/usr/bin/env python3
"""Build real FES2022b predictions and complex-harmonic exports."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


REPO_ROOT = Path(__file__).resolve().parents[4]
PROJECT_ROOT = REPO_ROOT / "projects/wenzhou/coastal"
DOMAIN_PATH = PROJECT_ROOT / "config/coastal_domain_v100.json"
POINTS_PATH = PROJECT_ROOT / "config/tide_points_v100.json"
KANMEN_ACQUISITION = PROJECT_ROOT / "reports/KANMEN_UHSLC_ACQUISITION.json"
STAGE_A_RECEIPT = PROJECT_ROOT / "reports/STAGE_A_UPLOAD_RECEIPT.json"
BOUNDARY_RASTER = PROJECT_ROOT / "data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif"
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "data/tides/fes2022b"
DEFAULT_REPORT_ROOT = PROJECT_ROOT / "reports"
CONFIG_REPOSITORY_PATH = "projects/wenzhou/coastal/config/fes2022b_native_v100.yaml"
EXPECTED_BOUNDARY_COUNT = 8118
EXPECTED_POINT_COUNT = 6
EXPECTED_CONSTITUENT_COUNT = 34
EXPECTED_POINT_SAMPLES = 3360
ROUND_TRIP_TOLERANCE_METERS = 1e-4


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def file_record(path: Path, role: str, repository_path: str | None = None) -> dict[str, Any]:
    return {
        "role": role,
        "path": repository_path or str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def normalize_constituent(value: object) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value).split(".")[-1]).upper()


def resolve_config_path(value: str, config_path: Path) -> Path:
    expanded = os.path.expandvars(value)
    if "$" in expanded:
        raise RuntimeError(f"Unresolved environment variable in FES path: {value}")
    path = Path(expanded).expanduser()
    return path.resolve() if path.is_absolute() else (config_path.parent / path).resolve()


def inspect_config(config_path: Path) -> dict[str, Any]:
    """Support one LGP file while retaining the existing cartesian layout."""
    try:
        import yaml
    except ImportError as exc:
        raise RuntimeError("PyYAML is required to inspect the FES configuration") from exc
    payload = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    tide = payload.get("tide") if isinstance(payload, dict) else None
    if not isinstance(tide, dict):
        raise RuntimeError("FES configuration lacks a tide model")
    if isinstance(tide.get("lgp"), dict):
        block = tide["lgp"]
        if not block.get("path"):
            raise RuntimeError("FES LGP configuration lacks path")
        return {
            "kind": "native_non_structured",
            "configuration": payload,
            "files": {"native_grid": resolve_config_path(str(block["path"]), config_path)},
            "constituents": [str(item) for item in block.get("constituents", [])],
        }
    if isinstance(tide.get("cartesian"), dict):
        block = tide["cartesian"]
        paths = block.get("paths")
        if not isinstance(paths, dict) or not paths:
            raise RuntimeError("FES cartesian configuration lacks paths")
        return {
            "kind": "cartesian",
            "configuration": payload,
            "files": {
                normalize_constituent(key): resolve_config_path(str(value), config_path)
                for key, value in paths.items()
            },
            "constituents": [str(item) for item in paths],
        }
    raise RuntimeError("FES configuration must contain tide.lgp or tide.cartesian")


def report_source_variant(
    config_info: dict[str, Any], source_manifest: dict[str, Any], requested_variant: str
) -> str:
    if config_info["kind"] == "native_non_structured":
        return "native_non_structured"
    if requested_variant == "cartesian" and config_info["kind"] == "cartesian":
        return "cartesian"
    raise RuntimeError("Unsupported FES source-variant and configuration combination")


def portable_config_reference(config_path: Path, config_info: dict[str, Any]) -> str:
    if config_info["kind"] == "native_non_structured":
        return CONFIG_REPOSITORY_PATH
    try:
        return str(config_path.relative_to(REPO_ROOT))
    except ValueError:
        return "${FES2022B_CONFIG}"


def verify_source_manifest(
    manifest_path: Path | None, config_info: dict[str, Any]
) -> dict[str, Any]:
    for path in config_info["files"].values():
        if not path.is_file():
            raise FileNotFoundError(f"FES source file is missing: {path}")
    if config_info["kind"] == "native_non_structured":
        if manifest_path is None or not manifest_path.is_file():
            raise RuntimeError("A runtime native-grid source manifest is required")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        source = config_info["files"]["native_grid"]
        if manifest.get("rawSourceCommitted") is not False:
            raise RuntimeError("Native source manifest must state rawSourceCommitted=false")
        if source.stat().st_size != int(manifest.get("sourceBytes", -1)):
            raise RuntimeError("Native source byte count differs from its manifest")
        if sha256_file(source) != manifest.get("sourceSha256"):
            raise RuntimeError("Native source SHA256 differs from its manifest")
        if int(manifest.get("netcdf", {}).get("constituentCount", -1)) != 34:
            raise RuntimeError("Native source manifest does not prove 34 constituents")
        return manifest

    files = []
    for constituent, path in sorted(config_info["files"].items()):
        files.append(
            {
                "constituent": constituent,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    bundle_sha256 = hashlib.sha256(
        json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schema": "wenzhou_fes2022b_cartesian_runtime_manifest@1.0.0",
        "dataset": "FES2022b ocean tide",
        "sourceVariant": "cartesian",
        "rawSourceCommitted": False,
        "sourceSha256": bundle_sha256,
        "sourceBytes": sum(item["bytes"] for item in files),
        "constituents": list(config_info["constituents"]),
        "files": files,
    }


def unit_to_meter_factor(value: str) -> tuple[str, float]:
    unit = value.strip().lower().replace(" ", "").replace("_", "")
    if unit in {"cm", "centimeter", "centimeters", "centimetre", "centimetres"}:
        return "centimeter", 0.01
    if unit in {"m", "meter", "meters", "metre", "metres"}:
        return "meter", 1.0
    if unit in {"mm", "millimeter", "millimeters", "millimetre", "millimetres"}:
        return "millimeter", 0.001
    raise RuntimeError(f"Unsupported FES amplitude unit: {value!r}")


def unit_to_degree_factor(value: str) -> tuple[str, float]:
    unit = value.strip().lower().replace(" ", "").replace("_", "")
    if unit in {"degree", "degrees", "deg"}:
        return "degree", 1.0
    if unit in {"radian", "radians", "rad"}:
        return "radian", 180.0 / np.pi
    raise RuntimeError(f"Unsupported FES phase unit: {value!r}")


def detect_model_unit(config_info: dict[str, Any]) -> tuple[str, float, dict[str, Any]]:
    try:
        import netCDF4
    except ImportError as exc:
        raise RuntimeError("netCDF4 is required to inspect FES units") from exc
    payload = config_info["configuration"]
    if config_info["kind"] == "native_non_structured":
        block = payload["tide"]["lgp"]
        constituents = list(block.get("constituents", []))
        if not constituents:
            raise RuntimeError("Native FES configuration has no constituents")
        expected = str(block["amplitude"]).format(constituent=constituents[0])
        source = config_info["files"]["native_grid"]
        with netCDF4.Dataset(source, "r") as dataset:
            matches = [name for name in dataset.variables if name.lower() == expected.lower()]
            if len(matches) != 1:
                raise RuntimeError(f"Cannot resolve native amplitude variable {expected!r}")
            variable = dataset.variables[matches[0]]
            raw_unit = str(getattr(variable, "units", ""))
            model_unit, factor = unit_to_meter_factor(raw_unit)
            return model_unit, factor, {
                "source": f"NetCDF variable {matches[0]}",
                "rawUnit": raw_unit,
                "attributes": {
                    name: str(variable.getncattr(name)) for name in variable.ncattrs()
                },
            }
    block = payload["tide"]["cartesian"]
    variable_name = str(block.get("amplitude", "amplitude"))
    source = next(iter(config_info["files"].values()))
    with netCDF4.Dataset(source, "r") as dataset:
        if variable_name not in dataset.variables:
            raise RuntimeError(f"Cartesian amplitude variable {variable_name!r} is absent")
        variable = dataset.variables[variable_name]
        raw_unit = str(getattr(variable, "units", ""))
        model_unit, factor = unit_to_meter_factor(raw_unit)
        return model_unit, factor, {
            "source": f"NetCDF variable {variable_name}",
            "rawUnit": raw_unit,
            "attributes": {
                name: str(variable.getncattr(name)) for name in variable.ncattrs()
            },
        }


def detect_phase_unit(config_info: dict[str, Any]) -> tuple[str, float, dict[str, Any]]:
    try:
        import netCDF4
    except ImportError as exc:
        raise RuntimeError("netCDF4 is required to inspect FES phase units") from exc
    payload = config_info["configuration"]
    if config_info["kind"] == "native_non_structured":
        block = payload["tide"]["lgp"]
        constituents = list(block.get("constituents", []))
        if not constituents:
            raise RuntimeError("Native FES configuration has no constituents")
        expected = str(block["phase"]).format(constituent=constituents[0])
        source = config_info["files"]["native_grid"]
    else:
        block = payload["tide"]["cartesian"]
        expected = str(block.get("phase", "phase"))
        source = next(iter(config_info["files"].values()))
    with netCDF4.Dataset(source, "r") as dataset:
        matches = [name for name in dataset.variables if name.lower() == expected.lower()]
        if len(matches) != 1:
            raise RuntimeError(f"Cannot resolve phase variable {expected!r}")
        variable = dataset.variables[matches[0]]
        raw_unit = str(getattr(variable, "units", ""))
        phase_unit, factor = unit_to_degree_factor(raw_unit)
        return phase_unit, factor, {
            "source": f"NetCDF variable {matches[0]}",
            "rawUnit": raw_unit,
            "attributes": {
                name: str(variable.getncattr(name)) for name in variable.ncattrs()
            },
        }


def load_prediction_window() -> tuple[np.ndarray, dict[str, Any], dict[str, Any]]:
    acquisition = json.loads(KANMEN_ACQUISITION.read_text(encoding="utf-8"))
    if acquisition.get("passed") is not True:
        raise RuntimeError("Kanmen UHSLC acquisition has not passed")
    selected = acquisition["selectedWindow"]
    if int(selected["durationDays"]) != 35:
        raise RuntimeError("Kanmen selected window is not 35 days")
    points = json.loads(POINTS_PATH.read_text(encoding="utf-8"))
    if int(points["predictionWindow"]["intervalMinutes"]) != 15:
        raise RuntimeError("FES interval must be 15 minutes")
    start = np.datetime64(str(selected["startUtc"]).replace("Z", ""), "s")
    end = np.datetime64(str(selected["endExclusiveUtc"]).replace("Z", ""), "s")
    if end - start != np.timedelta64(35, "D"):
        raise RuntimeError("Kanmen selected window is not exactly 35 days")
    dates = np.arange(start, end, np.timedelta64(15, "m"))
    if dates.size != EXPECTED_POINT_SAMPLES:
        raise RuntimeError(f"FES window has {dates.size} samples, expected 3360")
    return dates, points, acquisition


def boundary_coordinates() -> dict[str, np.ndarray]:
    try:
        import rasterio
        from pyproj import Transformer
    except ImportError as exc:
        raise RuntimeError("rasterio and pyproj are required for boundary extraction") from exc
    receipt = json.loads(STAGE_A_RECEIPT.read_text(encoding="utf-8"))
    relative = str(BOUNDARY_RASTER.relative_to(REPO_ROOT))
    item = next(entry for entry in receipt["files"] if entry["path"] == relative)
    if BOUNDARY_RASTER.stat().st_size != item["bytes"] or sha256_file(BOUNDARY_RASTER) != item["sha256"]:
        raise RuntimeError("Frozen Stage A boundary raster differs from its receipt")
    with rasterio.open(BOUNDARY_RASTER) as dataset:
        if (dataset.width, dataset.height) != (2090, 1971):
            raise RuntimeError("Frozen coastal grid is not 2090 x 1971")
        rows = np.concatenate(
            (
                np.zeros(dataset.width, dtype="int32"),
                np.arange(1, dataset.height - 1, dtype="int32"),
                np.arange(1, dataset.height - 1, dtype="int32"),
                np.full(dataset.width, dataset.height - 1, dtype="int32"),
            )
        )
        columns = np.concatenate(
            (
                np.arange(dataset.width, dtype="int32"),
                np.zeros(dataset.height - 2, dtype="int32"),
                np.full(dataset.height - 2, dataset.width - 1, dtype="int32"),
                np.arange(dataset.width, dtype="int32"),
            )
        )
        pairs = np.stack((rows, columns), axis=1)
        if rows.size != EXPECTED_BOUNDARY_COUNT or np.unique(pairs, axis=0).shape[0] != rows.size:
            raise RuntimeError("Open boundary does not contain exactly 8118 unique cells")
        values = dataset.read(1)[rows, columns]
        valid = np.isfinite(values)
        if dataset.nodata is not None:
            valid &= values != dataset.nodata
        if not bool(valid.all()):
            raise RuntimeError("Frozen open boundary contains invalid bathymetry")
        xs, ys = dataset.transform * (
            columns.astype("float64") + 0.5,
            rows.astype("float64") + 0.5,
        )
        transformer = Transformer.from_crs(dataset.crs, "EPSG:4326", always_xy=True)
        longitudes, latitudes = transformer.transform(xs, ys)
    return {
        "boundary_index": np.arange(EXPECTED_BOUNDARY_COUNT, dtype="int32"),
        "row": rows,
        "column": columns,
        "x_epsg32651": np.asarray(xs, dtype="float64"),
        "y_epsg32651": np.asarray(ys, dtype="float64"),
        "longitude": np.asarray(longitudes, dtype="float64"),
        "latitude": np.asarray(latitudes, dtype="float64"),
    }


def interpolate_harmonics(
    model: Any,
    longitudes: np.ndarray,
    latitudes: np.ndarray,
    identifiers: list[str],
    meter_factor: float,
) -> dict[str, Any]:
    raw, flags = model.interpolate(longitudes, latitudes)
    normalized = {normalize_constituent(name): np.asarray(value) for name, value in raw.items()}
    if set(normalized) != {normalize_constituent(name) for name in identifiers}:
        raise RuntimeError("model.interpolate() did not return the loaded 34-constituent set")
    complex_values = np.stack(
        [normalized[normalize_constituent(name)] for name in identifiers], axis=1
    )
    flags = np.asarray(flags, dtype="int8")
    defined_matrix = np.isfinite(complex_values.real) & np.isfinite(complex_values.imag)
    location_defined = defined_matrix.all(axis=1) & (flags != 0)
    status = np.full(flags.shape, "undefined", dtype=object)
    status[location_defined & (flags > 0)] = "interpolated"
    status[location_defined & (flags < 0)] = "extrapolated"
    amplitudes = np.abs(complex_values).astype("float64") * meter_factor
    phases = np.mod(np.angle(complex_values, deg=True), 360.0).astype("float64")
    amplitudes[~defined_matrix] = np.nan
    phases[~defined_matrix] = np.nan
    return {
        "complexSourceUnit": complex_values,
        "amplitudeMeters": amplitudes,
        "phaseDegrees": phases,
        "constituentDefined": defined_matrix,
        "qualityFlags": flags,
        "status": status,
    }


def harmonic_extraction_contract(
    harmonics: dict[str, Any], location_count: int, constituent_count: int
) -> bool:
    expected_matrix = (location_count, constituent_count)
    complex_values = np.asarray(harmonics["complexSourceUnit"])
    amplitudes = np.asarray(harmonics["amplitudeMeters"])
    phases = np.asarray(harmonics["phaseDegrees"])
    defined = np.asarray(harmonics["constituentDefined"], dtype=bool)
    flags = np.asarray(harmonics["qualityFlags"])
    statuses = np.asarray(harmonics["status"])
    complex_finite = np.isfinite(complex_values.real) & np.isfinite(complex_values.imag)
    scalar_finite = np.isfinite(amplitudes) & np.isfinite(phases)
    return bool(
        complex_values.shape == expected_matrix
        and amplitudes.shape == expected_matrix
        and phases.shape == expected_matrix
        and defined.shape == expected_matrix
        and flags.shape == (location_count,)
        and statuses.shape == (location_count,)
        and np.array_equal(defined, complex_finite)
        and np.array_equal(defined, scalar_finite)
    )


def write_harmonics_netcdf(
    path: Path,
    dimension: str,
    locations: dict[str, np.ndarray],
    identifiers: list[str],
    harmonics: dict[str, Any],
    source_amplitude_unit: str,
    meter_factor: float,
    source_phase_unit: str,
    degree_factor: float,
    source_sha256: str,
    source_variant: str,
) -> None:
    try:
        import netCDF4
    except ImportError as exc:
        raise RuntimeError("netCDF4 is required to write FES harmonics") from exc
    path.parent.mkdir(parents=True, exist_ok=True)
    with netCDF4.Dataset(path, "w", format="NETCDF4") as dataset:
        dataset.createDimension(dimension, len(harmonics["qualityFlags"]))
        dataset.createDimension("constituent", len(identifiers))
        dataset.dataset = "FES2022b ocean tide"
        dataset.source_variant = source_variant
        dataset.source_sha256 = source_sha256
        dataset.raw_source_committed = "false"
        dataset.absolute_datum_transform_applied = "false"
        dataset.source_amplitude_unit = source_amplitude_unit
        dataset.source_amplitude_to_meter_factor = meter_factor
        dataset.source_phase_unit = source_phase_unit
        dataset.source_phase_to_degree_factor = degree_factor
        names = dataset.createVariable("constituent_name", str, ("constituent",))
        names[:] = np.asarray(identifiers, dtype=object)
        for name, values in locations.items():
            values = np.asarray(values)
            if values.dtype.kind in "iu":
                variable = dataset.createVariable(name, "i4", (dimension,))
            elif values.dtype.kind == "f":
                variable = dataset.createVariable(name, "f8", (dimension,))
            else:
                variable = dataset.createVariable(name, str, (dimension,))
                values = values.astype(object)
            variable[:] = values
        amplitude = dataset.createVariable(
            "amplitude_m", "f8", (dimension, "constituent"), zlib=True, complevel=6
        )
        phase = dataset.createVariable(
            "phase_degrees", "f8", (dimension, "constituent"), zlib=True, complevel=6
        )
        real = dataset.createVariable(
            "complex_real_source_unit", "f8", (dimension, "constituent"), zlib=True
        )
        imaginary = dataset.createVariable(
            "complex_imag_source_unit", "f8", (dimension, "constituent"), zlib=True
        )
        defined = dataset.createVariable(
            "constituent_defined", "i1", (dimension, "constituent"), zlib=True
        )
        quality = dataset.createVariable("pyfes_quality_flag", "i1", (dimension,))
        status = dataset.createVariable("interpolation_status", str, (dimension,))
        amplitude.units = "m"
        phase.units = "degrees"
        real.units = source_amplitude_unit
        imaginary.units = source_amplitude_unit
        quality.comment = "positive interpolated; negative extrapolated; zero undefined"
        amplitude[:] = harmonics["amplitudeMeters"]
        phase[:] = harmonics["phaseDegrees"]
        real[:] = harmonics["complexSourceUnit"].real
        imaginary[:] = harmonics["complexSourceUnit"].imag
        defined[:] = harmonics["constituentDefined"].astype("int8")
        quality[:] = harmonics["qualityFlags"]
        status[:] = harmonics["status"].astype(object)


def extrema_indices(values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if values.size < 3:
        return np.array([], dtype=int), np.array([], dtype=int)
    highs = np.where((values[1:-1] > values[:-2]) & (values[1:-1] >= values[2:]))[0] + 1
    lows = np.where((values[1:-1] < values[:-2]) & (values[1:-1] <= values[2:]))[0] + 1
    return highs, lows


def daily_ranges(dates: np.ndarray, values: np.ndarray) -> list[dict[str, Any]]:
    samples_per_window = 96
    if dates.shape != values.shape or dates.size % samples_per_window:
        raise RuntimeError("Tide series cannot be partitioned into complete 24-hour windows")
    if dates.size > 1 and not bool(
        np.all(np.diff(dates) == np.timedelta64(15, "m"))
    ):
        raise RuntimeError("Tide series is not on an exact 15-minute cadence")
    records: list[dict[str, Any]] = []
    for start in range(0, dates.size, samples_per_window):
        stop = start + samples_per_window
        sample = np.asarray(values[start:stop], dtype="float64")
        finite = np.isfinite(sample)
        complete = bool(finite.all())
        records.append(
            {
                "windowIndex": start // samples_per_window,
                "windowStartUtc": f"{np.datetime_as_string(dates[start], unit='s')}Z",
                "windowEndExclusiveUtc": (
                    f"{np.datetime_as_string(dates[start] + np.timedelta64(1, 'D'), unit='s')}Z"
                ),
                "durationHours": 24,
                "sampleCount": int(sample.size),
                "finiteSampleCount": int(np.count_nonzero(finite)),
                "complete": complete,
                "minimumMeters": float(sample.min()) if complete else None,
                "maximumMeters": float(sample.max()) if complete else None,
                "rangeMeters": float(np.ptp(sample)) if complete else None,
            }
        )
    return records


def write_prediction_csv(
    path: Path,
    dates: np.ndarray,
    short_m: np.ndarray,
    equilibrium_long_m: np.ndarray,
    model_long_m: np.ndarray,
    total_m: np.ndarray,
    flags: np.ndarray,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "time_utc",
                "short_period_tide_m",
                "equilibrium_long_period_tide_m",
                "model_long_period_tide_m",
                "total_tide_m_model_msl_relative",
                "pyfes_quality_flag",
            ]
        )
        for date, short, equilibrium_long, model_long, total, flag in zip(
            dates,
            short_m,
            equilibrium_long_m,
            model_long_m,
            total_m,
            flags,
            strict=True,
        ):
            writer.writerow(
                [
                    f"{np.datetime_as_string(date, unit='s')}Z",
                    f"{float(short):.8f}",
                    f"{float(equilibrium_long):.8f}",
                    f"{float(model_long):.8f}",
                    f"{float(total):.8f}",
                    int(flag),
                ]
            )


def prediction_for_point(
    pyfes: Any,
    model: Any,
    dates: np.ndarray,
    longitude: float,
    latitude: float,
    settings: Any,
) -> dict[str, np.ndarray]:
    longitudes = np.full(dates.shape, longitude, dtype="float64")
    latitudes = np.full(dates.shape, latitude, dtype="float64")
    short_cm, long_cm, flags = pyfes.evaluate_tide(
        model, dates, longitudes, latitudes, settings=settings
    )
    equilibrium_long_cm = pyfes.evaluate_equilibrium_long_period(
        dates, latitudes, constituents=None, settings=settings
    )
    return {
        "shortMeters": np.asarray(short_cm, dtype="float64") * 0.01,
        "equilibriumLongMeters": np.asarray(
            equilibrium_long_cm, dtype="float64"
        )
        * 0.01,
        "modelLongMeters": np.asarray(long_cm, dtype="float64") * 0.01,
        "totalMeters": (np.asarray(short_cm) + np.asarray(long_cm)).astype("float64") * 0.01,
        "qualityFlags": np.asarray(flags, dtype="int8"),
    }


def constituent_tuples(
    harmonics: dict[str, Any], index: int, identifiers: list[str]
) -> dict[str, tuple[float, float]]:
    return {
        name: (
            float(harmonics["amplitudeMeters"][index, constituent_index] * 100.0),
            float(harmonics["phaseDegrees"][index, constituent_index]),
        )
        for constituent_index, name in enumerate(identifiers)
    }


def round_trip_error(
    pyfes: Any,
    model: Any,
    settings: Any,
    dates: np.ndarray,
    locations: list[dict[str, float]],
    harmonics: dict[str, Any],
    identifiers: list[str],
) -> dict[str, Any]:
    maximum_short_m = 0.0
    maximum_long_m = 0.0
    maximum_total_m = 0.0
    compared = 0
    for index, location in enumerate(locations):
        if harmonics["status"][index] == "undefined":
            continue
        values = constituent_tuples(harmonics, index, identifiers)
        reconstructed_short, reconstructed_long = pyfes.evaluate_tide_from_constituents(
            values, dates, float(location["latitude"]), settings=settings
        )
        direct_short, direct_long, flags = pyfes.evaluate_tide(
            model,
            dates,
            np.full(dates.shape, float(location["longitude"])),
            np.full(dates.shape, float(location["latitude"])),
            settings=settings,
        )
        reconstructed_short = np.asarray(reconstructed_short, dtype="float64")
        reconstructed_long = np.asarray(reconstructed_long, dtype="float64")
        direct_short = np.asarray(direct_short, dtype="float64")
        direct_long = np.asarray(direct_long, dtype="float64")
        valid = (
            (np.asarray(flags) != 0)
            & np.isfinite(reconstructed_short)
            & np.isfinite(reconstructed_long)
            & np.isfinite(direct_short)
            & np.isfinite(direct_long)
        )
        if valid.any():
            short_error_m = float(
                np.max(np.abs(reconstructed_short[valid] - direct_short[valid])) * 0.01
            )
            long_error_m = float(
                np.max(np.abs(reconstructed_long[valid] - direct_long[valid])) * 0.01
            )
            total_error_m = float(
                np.max(
                    np.abs(
                        (reconstructed_short[valid] + reconstructed_long[valid])
                        - (direct_short[valid] + direct_long[valid])
                    )
                )
                * 0.01
            )
            maximum_short_m = max(maximum_short_m, short_error_m)
            maximum_long_m = max(maximum_long_m, long_error_m)
            maximum_total_m = max(maximum_total_m, total_error_m)
            compared += int(valid.sum())
    return {
        "passed": compared > 0 and maximum_total_m <= ROUND_TRIP_TOLERANCE_METERS,
        "maximumErrorMeters": maximum_total_m if compared else None,
        "maximumShortPeriodErrorMeters": maximum_short_m if compared else None,
        "maximumModelLongPeriodErrorMeters": maximum_long_m if compared else None,
        "toleranceMeters": ROUND_TRIP_TOLERANCE_METERS,
        "comparedSampleCount": compared,
    }


def load_gauge_series(acquisition: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, str]:
    item = next(
        record
        for record in acquisition["files"]
        if record["role"]
        in {"window_mean_removed_comparison_series", "mean_removed_comparison_series"}
    )
    path = REPO_ROOT / item["path"]
    if path.stat().st_size != item["bytes"] or sha256_file(path) != item["sha256"]:
        raise RuntimeError("Kanmen mean-removed series differs from its report")
    dates: list[np.datetime64] = []
    values: list[float] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            dates.append(np.datetime64(row["time_utc"].replace("Z", ""), "s"))
            values.append(float(row["sea_level_m_window_mean_removed"]))
    return np.asarray(dates), np.asarray(values), str(item["path"])


def compare_gauge(
    gauge_dates: np.ndarray,
    gauge_values: np.ndarray,
    prediction_dates: np.ndarray,
    prediction_values: np.ndarray,
) -> dict[str, Any]:
    positions = np.searchsorted(prediction_dates, gauge_dates)
    aligned = (
        gauge_dates.size == 840
        and positions.size == 840
        and np.all(positions < prediction_dates.size)
        and np.array_equal(prediction_dates[positions], gauge_dates)
    )
    if not aligned:
        raise RuntimeError("Kanmen gauge times do not align with the FES window")
    model = np.asarray(prediction_values[positions], dtype="float64")
    gauge = np.asarray(gauge_values, dtype="float64")
    if not np.isfinite(model).all() or not np.isfinite(gauge).all():
        return {
            "gaugeShapeComparisonComputed": False,
            "phaseLagMinutes": None,
            "rangeBiasMeters": None,
            "meanRemovedRmseMeters": None,
            "absoluteDatumValidationPassed": False,
        }
    model -= model.mean()
    gauge -= gauge.mean()
    best_lag = 0
    best_correlation = -np.inf
    for lag in range(-24, 25):
        if lag < 0:
            left, right = model[-lag:], gauge[:lag]
        elif lag > 0:
            left, right = model[:-lag], gauge[lag:]
        else:
            left, right = model, gauge
        if left.size > 1 and np.std(left) and np.std(right):
            correlation = float(np.corrcoef(left, right)[0, 1])
            if correlation > best_correlation:
                best_correlation, best_lag = correlation, lag
    return {
        "gaugeShapeComparisonComputed": True,
        "phaseLagMinutes": best_lag * 60,
        "phaseLagConvention": "positive means gauge shape follows model shape",
        "phaseCorrelation": best_correlation,
        "rangeBiasMeters": float(np.ptp(model) - np.ptp(gauge)),
        "meanRemovedRmseMeters": float(np.sqrt(np.mean((model - gauge) ** 2))),
        "absoluteDatumValidationPassed": False,
    }


def histogram(values: np.ndarray) -> dict[str, int]:
    return {
        str(key): count
        for key, count in sorted(Counter(int(item) for item in values).items())
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=os.environ.get("FES2022B_CONFIG"))
    parser.add_argument(
        "--source-manifest", type=Path, default=os.environ.get("FES2022B_SOURCE_MANIFEST")
    )
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--report-root", type=Path, default=DEFAULT_REPORT_ROOT)
    parser.add_argument(
        "--variant", choices=("native", "cartesian", "extrapolated"), default="native"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    acquisition_path = args.report_root / "FES2022B_ACQUISITION.json"
    qa_path = args.report_root / "TIDAL_HARMONICS_QA.json"
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_fes2022b_acquisition@2.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "modelRole": "primary",
        "dataset": "FES2022b ocean tide",
        "requestedVariant": args.variant,
        "sourceVariant": "unvalidated",
        "rawSourceCommitted": False,
        "absoluteDatumTransformApplied": False,
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_tidal_harmonics_qa@2.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "stageBTideReady": False,
        "hydrodynamicSimulationPassed": False,
        "absoluteDatumValidationPassed": False,
        "absoluteDatumTransformApplied": False,
    }
    try:
        if args.config is None or not args.config.is_file():
            raise RuntimeError("FES2022B_CONFIG must resolve to a real PyFES YAML file")
        config_path = args.config.resolve()
        config_info = inspect_config(config_path)
        if args.variant == "extrapolated":
            raise RuntimeError(
                "Official extrapolated production is disabled until a 34-file AVISO "
                "ocean_tide_extrapolated manifest and mask_fes2022B.nc are inspected"
            )
        if args.variant == "native" and config_info["kind"] != "native_non_structured":
            raise RuntimeError("Native production requires one tide.lgp source file")
        if args.variant == "cartesian" and config_info["kind"] != "cartesian":
            raise RuntimeError("Cartesian production requires tide.cartesian source files")
        source_manifest = verify_source_manifest(args.source_manifest, config_info)
        source_variant = report_source_variant(config_info, source_manifest, args.variant)
        config_reference = portable_config_reference(config_path, config_info)
        model_unit, meter_factor, unit_evidence = detect_model_unit(config_info)
        phase_unit, degree_factor, phase_unit_evidence = detect_phase_unit(config_info)
        if model_unit != "centimeter" or meter_factor != 0.01:
            raise RuntimeError("FES2022b production requires source amplitudes proven to be centimeters")
        if phase_unit != "degree" or degree_factor != 1.0:
            raise RuntimeError("FES2022b production requires source phases proven to be degrees")
        dates, points_config, kanmen_acquisition = load_prediction_window()
        points = list(points_config["points"])
        if len(points) != EXPECTED_POINT_COUNT:
            raise RuntimeError("tide_points_v100.json does not contain exactly six points")

        try:
            import netCDF4
            import pyproj
            import pyfes
            import rasterio
            import yaml
        except ImportError as exc:
            raise RuntimeError("pyfes==2026.5.2 and its pinned runtime are required") from exc
        if getattr(pyfes, "__version__", None) != "2026.5.2":
            raise RuntimeError(f"PyFES {getattr(pyfes, '__version__', None)!r} is not 2026.5.2")
        bounds = tuple(
            json.loads(DOMAIN_PATH.read_text(encoding="utf-8"))["domains"]
            ["bathymetryAndTideBoundaryWgs84"]["bounds"]
        )
        configuration = pyfes.config.load(config_path, bbox=bounds)
        model = configuration.models.get("tide")
        if model is None:
            raise RuntimeError("PyFES configuration did not load a tide model")
        identifiers = list(model.identifiers())
        expected_source = (
            source_manifest["netcdf"]["constituents"]
            if config_info["kind"] == "native_non_structured"
            else source_manifest["constituents"]
        )
        expected = {normalize_constituent(item) for item in expected_source}
        if (
            len(identifiers) != EXPECTED_CONSTITUENT_COUNT
            or {normalize_constituent(item) for item in identifiers} != expected
        ):
            raise RuntimeError("Loaded PyFES model is not the inspected 34-constituent set")

        point_locations = {
            "point_id": np.asarray([item["id"] for item in points], dtype=object),
            "point_name": np.asarray([item["name"] for item in points], dtype=object),
            "point_role": np.asarray([item["role"] for item in points], dtype=object),
            "longitude": np.asarray([float(item["longitude"]) for item in points]),
            "latitude": np.asarray([float(item["latitude"]) for item in points]),
        }
        point_harmonics = interpolate_harmonics(
            model,
            point_locations["longitude"],
            point_locations["latitude"],
            identifiers,
            meter_factor,
        )
        boundary = boundary_coordinates()
        boundary_harmonics = interpolate_harmonics(
            model,
            boundary["longitude"],
            boundary["latitude"],
            identifiers,
            meter_factor,
        )
        constituent_extraction_passed = harmonic_extraction_contract(
            point_harmonics, len(points), len(identifiers)
        ) and harmonic_extraction_contract(
            boundary_harmonics, EXPECTED_BOUNDARY_COUNT, len(identifiers)
        )
        if not constituent_extraction_passed:
            raise RuntimeError(
                "Computed point or boundary harmonic arrays failed their extraction contract"
            )
        point_status = Counter(str(value) for value in point_harmonics["status"])
        boundary_status = Counter(str(value) for value in boundary_harmonics["status"])
        undefined_points = point_status["undefined"]
        undefined_boundary = boundary_status["undefined"]
        extrapolated_points = point_status["extrapolated"]
        extrapolated_boundary = boundary_status["extrapolated"]
        qa.update(
            {
                "sourceVariant": source_variant,
                "constituentCount": len(identifiers),
                "qualityFlagHistogram": {
                    "points": histogram(point_harmonics["qualityFlags"]),
                    "boundaryNodes": histogram(boundary_harmonics["qualityFlags"]),
                },
                "undefinedPointCount": undefined_points,
                "undefinedBoundaryNodeCount": undefined_boundary,
                "extrapolatedPointCount": extrapolated_points,
                "extrapolatedBoundaryNodeCount": extrapolated_boundary,
                "pointStatusHistogram": dict(sorted(point_status.items())),
                "boundaryStatusHistogram": dict(sorted(boundary_status.items())),
                "constituentAmplitudePhaseExtractionPassed": (
                    constituent_extraction_passed
                ),
            }
        )
        point_path = args.output_root / "WENZHOU_FES2022B_POINT_HARMONICS.nc"
        boundary_path = args.output_root / "WENZHOU_FES2022B_BOUNDARY_HARMONICS.nc"
        source_sha = str(source_manifest["sourceSha256"])
        write_harmonics_netcdf(
            point_path,
            "point",
            point_locations,
            identifiers,
            point_harmonics,
            str(unit_evidence["rawUnit"]),
            meter_factor,
            str(phase_unit_evidence["rawUnit"]),
            degree_factor,
            source_sha,
            config_info["kind"],
        )
        write_harmonics_netcdf(
            boundary_path,
            "boundary_node",
            boundary,
            identifiers,
            boundary_harmonics,
            str(unit_evidence["rawUnit"]),
            meter_factor,
            str(phase_unit_evidence["rawUnit"]),
            degree_factor,
            source_sha,
            config_info["kind"],
        )

        point_reports = []
        gauge_prediction = None
        for index, point in enumerate(points):
            prediction = prediction_for_point(
                pyfes,
                model,
                dates,
                float(point["longitude"]),
                float(point["latitude"]),
                configuration.settings,
            )
            csv_path = args.output_root / "predictions" / f"{point['id']}_fes2022b_15min.csv"
            write_prediction_csv(
                csv_path,
                dates,
                prediction["shortMeters"],
                prediction["equilibriumLongMeters"],
                prediction["modelLongMeters"],
                prediction["totalMeters"],
                prediction["qualityFlags"],
            )
            highs, lows = extrema_indices(prediction["totalMeters"])
            ranges = daily_ranges(dates, prediction["totalMeters"])
            complete_ranges = [item for item in ranges if item["complete"]]
            point_reports.append(
                {
                    "id": point["id"],
                    "name": point["name"],
                    "role": point["role"],
                    "longitude": float(point["longitude"]),
                    "latitude": float(point["latitude"]),
                    "interpolationStatus": str(point_harmonics["status"][index]),
                    "pyfesQualityFlag": int(point_harmonics["qualityFlags"][index]),
                    "sampleCount": int(dates.size),
                    "undefinedSampleCount": int(
                        np.count_nonzero(
                            (prediction["qualityFlags"] == 0)
                            | ~np.isfinite(prediction["totalMeters"])
                        )
                    ),
                    "highTideTimesUtc": [
                        f"{np.datetime_as_string(dates[item], unit='s')}Z" for item in highs
                    ],
                    "lowTideTimesUtc": [
                        f"{np.datetime_as_string(dates[item], unit='s')}Z" for item in lows
                    ],
                    "dailyRanges": ranges,
                    "representativeSpringWindow": max(
                        complete_ranges,
                        key=lambda item: item["rangeMeters"],
                        default=None,
                    ),
                    "representativeNeapWindow": min(
                        complete_ranges,
                        key=lambda item: item["rangeMeters"],
                        default=None,
                    ),
                    "file": file_record(
                        csv_path,
                        "fes2022b_point_prediction",
                        f"projects/wenzhou/coastal/data/tides/fes2022b/predictions/{csv_path.name}",
                    ),
                }
            )
            if point["id"] == "kanmen_gauge":
                gauge_prediction = prediction["totalMeters"]
        if gauge_prediction is None:
            raise RuntimeError("Kanmen gauge point is missing")

        diagnostic_settings = pyfes.FESSettings().with_compute_long_period_equilibrium(False)
        point_round_trip = round_trip_error(
            pyfes, model, diagnostic_settings, dates, points, point_harmonics, identifiers
        )
        boundary_indices = np.linspace(0, EXPECTED_BOUNDARY_COUNT - 1, 128, dtype=int)
        boundary_dates = dates[np.linspace(0, dates.size - 1, 8, dtype=int)]
        boundary_locations = [
            {
                "longitude": float(boundary["longitude"][index]),
                "latitude": float(boundary["latitude"][index]),
            }
            for index in boundary_indices
        ]
        sampled_harmonics = {
            key: value[boundary_indices]
            for key, value in boundary_harmonics.items()
            if isinstance(value, np.ndarray)
        }
        boundary_round_trip = round_trip_error(
            pyfes,
            model,
            diagnostic_settings,
            boundary_dates,
            boundary_locations,
            sampled_harmonics,
            identifiers,
        )
        if point_round_trip["comparedSampleCount"] == 0:
            raise RuntimeError("no_defined_point_samples_for_constituent_round_trip")
        if boundary_round_trip["comparedSampleCount"] == 0:
            raise RuntimeError("no_defined_boundary_samples_for_constituent_round_trip")
        maximum_error = max(
            float(point_round_trip["maximumErrorMeters"] or 0.0),
            float(boundary_round_trip["maximumErrorMeters"] or 0.0),
        )
        round_trip = {
            "passed": point_round_trip["passed"] and boundary_round_trip["passed"],
            "maximumErrorMeters": maximum_error,
            "toleranceMeters": ROUND_TRIP_TOLERANCE_METERS,
            "inferenceType": str(diagnostic_settings.inference_type).split(".")[-1],
            "computeLongPeriodEquilibrium": bool(
                diagnostic_settings.compute_long_period_equilibrium
            ),
            "pointComparison": point_round_trip,
            "boundarySampleComparison": boundary_round_trip,
            "boundarySampleNodeCount": int(boundary_indices.size),
        }
        if not round_trip["passed"]:
            raise RuntimeError(
                f"Constituent round-trip error {maximum_error} exceeds 1e-4 m"
            )
        gauge_dates, gauge_values, gauge_path = load_gauge_series(kanmen_acquisition)
        gauge_comparison = compare_gauge(gauge_dates, gauge_values, dates, gauge_prediction)

        stage_b_ready = (
            undefined_points == 0
            and undefined_boundary == 0
            and extrapolated_points == 0
            and extrapolated_boundary == 0
            and gauge_comparison["gaugeShapeComparisonComputed"]
            and round_trip["passed"]
        )
        outputs = [
            file_record(
                point_path,
                "point_harmonics",
                "projects/wenzhou/coastal/data/tides/fes2022b/WENZHOU_FES2022B_POINT_HARMONICS.nc",
            ),
            file_record(
                boundary_path,
                "open_boundary_harmonics",
                "projects/wenzhou/coastal/data/tides/fes2022b/WENZHOU_FES2022B_BOUNDARY_HARMONICS.nc",
            ),
            *[item["file"] for item in point_reports],
        ]
        acquisition.update(
            {
                "passed": True,
                "sourceVariant": source_variant,
                "constituentCount": len(identifiers),
                "constituents": identifiers,
                "sourceSha256": source_manifest["sourceSha256"],
                "sourceBytes": source_manifest["sourceBytes"],
                "sourceUrl": source_manifest.get("sourceUrl"),
                "sourceFinalUrl": source_manifest.get("transfer", {}).get("finalUrl"),
                "sourceHttpStatus": source_manifest.get("transfer", {}).get("httpStatus"),
                "sourceEtag": (
                    source_manifest.get("transfer", {})
                    .get("responseHeaders", {})
                    .get("etag")
                ),
                "sourceRetrievedAtUtc": source_manifest.get("retrievedAtUtc"),
                "sourceLastModified": source_manifest.get("sourceLastModified"),
                "sourceDirectory": source_manifest.get("sourceDirectory"),
                "sourceCatalog": source_manifest.get("catalog"),
                "sourceMetadata": source_manifest.get("netcdf", {}).get("globalAttributes"),
                "nativeGrid": source_manifest.get("netcdf", {}).get("nativeGrid"),
                "sourceNetcdfStructure": source_manifest.get("netcdf"),
                "sourcePyfesValidation": source_manifest.get("pyfesValidation"),
                "sourceFiles": source_manifest.get("files"),
                "doi": source_manifest.get("doi"),
                "licenseUrl": source_manifest.get("licenseUrl"),
                "licenseVersion": source_manifest.get("licenseVersion"),
                "pyfesVersion": pyfes.__version__,
                "pythonVersion": platform.python_version(),
                "numpyVersion": np.__version__,
                "netcdf4Version": netCDF4.__version__,
                "netcdfCLibraryVersion": netCDF4.__netcdf4libversion__,
                "hdf5LibraryVersion": netCDF4.__hdf5libversion__,
                "rasterioVersion": rasterio.__version__,
                "pyprojVersion": pyproj.__version__,
                "pyyamlVersion": yaml.__version__,
                "modelSourceUnit": model_unit,
                "sourceToMeterFactor": meter_factor,
                "unitEvidence": unit_evidence,
                "modelSourcePhaseUnit": phase_unit,
                "sourcePhaseToDegreeFactor": degree_factor,
                "phaseUnitEvidence": phase_unit_evidence,
                "configPath": config_reference,
                "configBytes": config_path.stat().st_size,
                "configSha256": sha256_file(config_path),
                "predictionWindow": {
                    "startUtc": kanmen_acquisition["selectedWindow"]["startUtc"],
                    "endExclusiveUtc": kanmen_acquisition["selectedWindow"]["endExclusiveUtc"],
                    "durationDays": 35,
                    "intervalMinutes": 15,
                    "samplesPerPoint": int(dates.size),
                },
                "predictionComponents": {
                    "shortPeriodTide": "first return value from pyfes.evaluate_tide()",
                    "modelLongPeriodTide": (
                        "second return value from pyfes.evaluate_tide(); residual equilibrium "
                        "plus loaded or inferred long-period model waves"
                    ),
                    "equilibriumLongPeriodTide": (
                        "pyfes.evaluate_equilibrium_long_period() with constituents=None; "
                        "pure astronomical diagnostic and not separately added to model total"
                    ),
                    "totalTide": "shortPeriodTide plus modelLongPeriodTide",
                },
                "outputs": outputs,
            }
        )
        qa.update(
            {
                "passed": stage_b_ready,
                "stageBTideReady": stage_b_ready,
                "modelRole": "primary",
                "dataset": "FES2022b ocean tide",
                "sourceVariant": source_variant,
                "constituentCount": len(identifiers),
                "rawSourceCommitted": False,
                "sourceSha256": source_manifest["sourceSha256"],
                "sourceBytes": source_manifest["sourceBytes"],
                "pyfesVersion": pyfes.__version__,
                "qualityFlagHistogram": {
                    "points": histogram(point_harmonics["qualityFlags"]),
                    "boundaryNodes": histogram(boundary_harmonics["qualityFlags"]),
                },
                "undefinedPointCount": undefined_points,
                "undefinedBoundaryNodeCount": undefined_boundary,
                "extrapolatedPointCount": extrapolated_points,
                "extrapolatedBoundaryNodeCount": extrapolated_boundary,
                "pointStatusHistogram": dict(sorted(point_status.items())),
                "boundaryStatusHistogram": dict(sorted(boundary_status.items())),
                "constituentAmplitudePhaseExtractionPassed": constituent_extraction_passed,
                "roundTrip": round_trip,
                "points": point_reports,
                "gaugeComparisonSource": gauge_path,
                **gauge_comparison,
                "outputFiles": outputs,
                "wetDryUse": "harmonic_water_level_preview_only",
            }
        )
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "fes2022b_acquisition_or_prediction_failed"
        qa["detail"] = str(exc)

    write_json(acquisition_path, acquisition)
    write_json(qa_path, qa)
    print(json.dumps({"acquisition": acquisition, "qa": qa}, ensure_ascii=False, indent=2))
    structurally_valid = (
        acquisition["passed"]
        and qa.get("constituentAmplitudePhaseExtractionPassed") is True
        and qa.get("roundTrip", {}).get("passed") is True
    )
    return 0 if structurally_valid else 2


if __name__ == "__main__":
    sys.exit(main())
