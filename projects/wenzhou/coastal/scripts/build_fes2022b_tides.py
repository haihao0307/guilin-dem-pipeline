#!/usr/bin/env python3
"""Generate auditable FES2022b tide predictions for the Wenzhou coastal domain."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
DOMAIN_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/coastal_domain_v100.json"
POINTS_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/tide_points_v100.json"
OUTPUT_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/tides/fes2022b"
ACQUISITION_REPORT = REPO_ROOT / "projects/wenzhou/coastal/reports/FES2022B_ACQUISITION.json"
QA_REPORT = REPO_ROOT / "projects/wenzhou/coastal/reports/TIDAL_HARMONICS_QA.json"
MINIMUM_CONSTITUENTS = {"M2", "S2", "N2", "K2", "K1", "O1", "P1", "Q1", "M4", "MS4", "MN4"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_constituent(value: object) -> str:
    text = str(value).split(".")[-1]
    return re.sub(r"[^A-Za-z0-9]", "", text).upper()


def parse_config_paths(config_path: Path) -> dict[str, Path]:
    """Parse constituent file references from the official simple YAML layout."""
    pattern = re.compile(r"^\s{6,}([A-Za-z0-9_]+):\s*['\"]?([^#'\"]+\.(?:nc|nc\.xz))['\"]?\s*$")
    result: dict[str, Path] = {}
    for line in config_path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if not match:
            continue
        name = normalize_constituent(match.group(1))
        raw_path = os.path.expandvars(match.group(2).strip())
        candidate = Path(raw_path).expanduser()
        if not candidate.is_absolute():
            candidate = (config_path.parent / candidate).resolve()
        result[name] = candidate
    return result


def detect_model_unit(sample_path: Path, override: str | None) -> tuple[str, float, dict[str, Any]]:
    if override:
        unit = override.strip().lower()
        source = "FES2022B_MODEL_UNIT"
        metadata: dict[str, Any] = {}
    else:
        try:
            import xarray as xr
        except ImportError as exc:
            raise RuntimeError(
                "xarray is required for amplitude-unit inspection unless FES2022B_MODEL_UNIT is set"
            ) from exc
        with xr.open_dataset(sample_path, decode_cf=False) as dataset:
            amplitude_name = next(
                (name for name in dataset.data_vars if "amplitude" in name.lower()),
                None,
            )
            if amplitude_name is None:
                raise RuntimeError(f"No amplitude variable found in {sample_path}")
            variable = dataset[amplitude_name]
            unit = str(variable.attrs.get("units", "")).strip().lower()
            source = f"NetCDF variable {amplitude_name}"
            metadata = {
                "variable": amplitude_name,
                "attributes": {key: str(value) for key, value in variable.attrs.items()},
            }

    normalized = unit.replace(" ", "").replace("_", "")
    if normalized in {"cm", "centimeter", "centimeters", "centimetre", "centimetres"}:
        return "centimeter", 0.01, {"source": source, **metadata}
    if normalized in {"m", "meter", "meters", "metre", "metres"}:
        return "meter", 1.0, {"source": source, **metadata}
    if normalized in {"mm", "millimeter", "millimeters", "millimetre", "millimetres"}:
        return "millimeter", 0.001, {"source": source, **metadata}
    raise RuntimeError(f"Unsupported or missing FES model amplitude unit: {unit!r}")


def file_manifest(paths: dict[str, Path]) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    for constituent, path in sorted(paths.items()):
        if not path.is_file():
            raise FileNotFoundError(f"FES constituent file is missing: {constituent} -> {path}")
        manifest.append(
            {
                "constituent": constituent,
                "path": str(path),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return manifest


def date_vector(window: dict[str, Any]) -> np.ndarray:
    start_text = str(window["startUtc"]).replace("Z", "")
    start = np.datetime64(start_text, "s")
    end = start + np.timedelta64(int(window["durationDays"]), "D")
    step = np.timedelta64(int(window["intervalMinutes"]), "m")
    dates = np.arange(start, end, step)
    if dates.size == 0:
        raise RuntimeError("Tide prediction window produced no timestamps")
    return dates


def extrema_indices(values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if values.size < 3:
        return np.array([], dtype=int), np.array([], dtype=int)
    maxima = np.where((values[1:-1] > values[:-2]) & (values[1:-1] >= values[2:]))[0] + 1
    minima = np.where((values[1:-1] < values[:-2]) & (values[1:-1] <= values[2:]))[0] + 1
    return maxima, minima


def daily_ranges(dates: np.ndarray, values: np.ndarray) -> list[dict[str, Any]]:
    days = dates.astype("datetime64[D]")
    records: list[dict[str, Any]] = []
    for day in np.unique(days):
        mask = days == day
        sample = values[mask]
        if sample.size == 0 or not np.isfinite(sample).all():
            continue
        records.append(
            {
                "dateUtc": np.datetime_as_string(day, unit="D"),
                "minimumMeters": float(np.min(sample)),
                "maximumMeters": float(np.max(sample)),
                "rangeMeters": float(np.max(sample) - np.min(sample)),
            }
        )
    return records


def write_csv(
    path: Path,
    dates: np.ndarray,
    short_m: np.ndarray,
    long_m: np.ndarray,
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
                "long_period_tide_m",
                "total_tide_m_msl_relative",
                "pyfes_quality_flag",
            ]
        )
        for date, short_value, long_value, total_value, flag in zip(
            dates, short_m, long_m, total_m, flags, strict=True
        ):
            writer.writerow(
                [
                    f"{np.datetime_as_string(date, unit='s')}Z",
                    f"{float(short_value):.8f}",
                    f"{float(long_value):.8f}",
                    f"{float(total_value):.8f}",
                    int(flag),
                ]
            )


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default=os.environ.get("FES2022B_CONFIG"),
        help="Official FES2022b ocean_tide.yaml or ocean_tide_extrapolated.yaml",
    )
    parser.add_argument(
        "--variant",
        choices=("native", "extrapolated"),
        default=os.environ.get("FES2022B_VARIANT", "native"),
    )
    parser.add_argument(
        "--model-unit",
        default=os.environ.get("FES2022B_MODEL_UNIT"),
        help="Explicit cm, m or mm override when NetCDF units cannot be inspected",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    now = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_fes2022b_acquisition@1.0.0",
        "generatedAtUtc": now,
        "dataset": "FES2022b ocean tide",
        "software": "PyFES",
        "variant": args.variant,
        "passed": False,
        "credentialsChecked": ["FES2022B_CONFIG", "FES2022B_VARIANT", "FES2022B_MODEL_UNIT"],
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_tidal_harmonics_qa@1.0.0",
        "generatedAtUtc": now,
        "passed": False,
        "modelRole": "primary",
        "wetDryUse": "harmonic_water_level_wet_dry_preview",
    }

    try:
        if not args.config:
            raise RuntimeError(
                "FES2022B_CONFIG is required and must point to an official FES2022b configuration file"
            )
        config_path = Path(args.config).expanduser().resolve()
        if not config_path.is_file():
            raise FileNotFoundError(f"FES2022b configuration is unavailable: {config_path}")

        domain = json.loads(DOMAIN_PATH.read_text(encoding="utf-8"))
        points_config = json.loads(POINTS_PATH.read_text(encoding="utf-8"))
        bounds = tuple(domain["domains"]["bathymetryAndTideBoundaryWgs84"]["bounds"])
        referenced_files = parse_config_paths(config_path)
        if not referenced_files:
            raise RuntimeError("No FES constituent NetCDF paths were found in the configuration")
        missing_required_paths = sorted(MINIMUM_CONSTITUENTS - set(referenced_files))
        if missing_required_paths:
            raise RuntimeError(
                f"FES configuration lacks minimum constituents: {missing_required_paths}"
            )
        source_manifest = file_manifest(referenced_files)
        sample_path = referenced_files["M2"]
        model_unit, meter_factor, unit_evidence = detect_model_unit(sample_path, args.model_unit)

        try:
            import pyfes
        except ImportError as exc:
            raise RuntimeError(
                "PyFES is unavailable. Install the current official pyfes package before prediction"
            ) from exc

        configuration = pyfes.config.load(config_path, bbox=bounds)
        if "tide" not in configuration.models:
            raise RuntimeError("FES configuration did not load a tide model")
        model = configuration.models["tide"]
        identifiers = sorted(normalize_constituent(item) for item in model.identifiers())
        missing_loaded = sorted(MINIMUM_CONSTITUENTS - set(identifiers))
        if missing_loaded:
            raise RuntimeError(f"Loaded FES model lacks minimum constituents: {missing_loaded}")

        dates = date_vector(points_config["predictionWindow"])
        OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
        point_results: list[dict[str, Any]] = []
        all_defined = True
        any_extrapolated = False

        for point in points_config["points"]:
            longitude = float(point["longitude"])
            latitude = float(point["latitude"])
            lons = np.full(dates.shape, longitude, dtype="float64")
            lats = np.full(dates.shape, latitude, dtype="float64")
            short_raw, long_raw, flags = pyfes.evaluate_tide(
                model,
                dates,
                lons,
                lats,
                settings=configuration.settings,
            )
            short_m = np.asarray(short_raw, dtype="float64") * meter_factor
            long_m = np.asarray(long_raw, dtype="float64") * meter_factor
            flags = np.asarray(flags, dtype="int8")
            total_m = short_m + long_m

            undefined = (~np.isfinite(total_m)) | (flags == 0)
            extrapolated = flags < 0
            all_defined = all_defined and not bool(undefined.any())
            any_extrapolated = any_extrapolated or bool(extrapolated.any())

            csv_path = OUTPUT_ROOT / f"{point['id']}_fes2022b_15min.csv"
            write_csv(csv_path, dates, short_m, long_m, total_m, flags)
            maxima, minima = extrema_indices(total_m)
            ranges = daily_ranges(dates, total_m)
            spring_day = max(ranges, key=lambda item: item["rangeMeters"]) if ranges else None
            neap_day = min(ranges, key=lambda item: item["rangeMeters"]) if ranges else None

            point_results.append(
                {
                    "id": point["id"],
                    "name": point["name"],
                    "role": point["role"],
                    "longitude": longitude,
                    "latitude": latitude,
                    "csv": str(csv_path.relative_to(REPO_ROOT)),
                    "csvBytes": csv_path.stat().st_size,
                    "csvSha256": sha256_file(csv_path),
                    "sampleCount": int(total_m.size),
                    "undefinedSamples": int(undefined.sum()),
                    "interpolatedSamples": int((flags > 0).sum()),
                    "extrapolatedSamples": int(extrapolated.sum()),
                    "minimumMeters": float(np.nanmin(total_m)) if np.isfinite(total_m).any() else None,
                    "maximumMeters": float(np.nanmax(total_m)) if np.isfinite(total_m).any() else None,
                    "fullWindowRangeMeters": (
                        float(np.nanmax(total_m) - np.nanmin(total_m))
                        if np.isfinite(total_m).any()
                        else None
                    ),
                    "highTideCount": int(maxima.size),
                    "lowTideCount": int(minima.size),
                    "representativeSpringDay": spring_day,
                    "representativeNeapDay": neap_day,
                    "dailyRanges": ranges,
                    "stationCodes": point.get("codes"),
                }
            )

        acquisition.update(
            {
                "passed": True,
                "configPath": str(config_path),
                "configBytes": config_path.stat().st_size,
                "configSha256": sha256_file(config_path),
                "pyfesVersion": getattr(pyfes, "__version__", "unknown"),
                "modelUnit": model_unit,
                "meterFactor": meter_factor,
                "unitEvidence": unit_evidence,
                "loadedConstituents": identifiers,
                "sourceFiles": source_manifest,
                "bboxWgs84": list(bounds),
                "doi": "10.24400/527896/A01-2024.004",
            }
        )
        qa.update(
            {
                "passed": all_defined,
                "model": "FES2022b",
                "variant": args.variant,
                "outputUnit": "meter relative to model mean sea level",
                "minimumConstituentsPassed": True,
                "requiredConstituents": sorted(MINIMUM_CONSTITUENTS),
                "loadedConstituents": identifiers,
                "predictionWindow": points_config["predictionWindow"],
                "quality": {
                    "allPointsDefined": all_defined,
                    "containsExtrapolatedSamples": any_extrapolated,
                    "gaugeValidationPassed": False,
                    "gaugeValidationStatus": "pending IOC observation acquisition and datum normalization",
                    "constituentAmplitudePhaseExtractionPassed": False,
                    "constituentAmplitudePhaseStatus": "pending direct complex-constituent export",
                },
                "points": point_results,
            }
        )
        if not all_defined:
            qa["error"] = "undefined_fes_samples"
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "fes2022b_acquisition_or_prediction_failed"
        qa["detail"] = str(exc)

    write_json(ACQUISITION_REPORT, acquisition)
    write_json(QA_REPORT, qa)
    print(json.dumps({"acquisition": acquisition, "qa": qa}, ensure_ascii=False, indent=2))
    return 0 if acquisition["passed"] and qa["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
