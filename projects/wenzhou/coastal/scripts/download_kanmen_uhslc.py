#!/usr/bin/env python3
"""Download and validate the official static Kanmen UHSLC record.

Only UHSLC record 6321, station 632, version A is accepted. The complete
official NetCDF is downloaded first and all array access is local. Published
sea levels remain relative to the UHSLC ``reference_datum``. A separate
window-mean-removed series is produced solely for tidal shape comparison.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import re
import sys
import tempfile
import time as time_module
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
POINTS_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/tide_points_v100.json"
STATION_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/kanmen_station_metadata_v100.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/gauges/kanmen"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/coastal/reports"
ACQUISITION_REPORT = REPORT_ROOT / "KANMEN_UHSLC_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "KANMEN_UHSLC_QA.json"

DATASET_ID = "h632a"
SOURCE_URL = "https://uhslc.soest.hawaii.edu/data/netcdf/rqds/pacific/hourly/h632a.nc"
METADATA_URL = "https://uhslc.soest.hawaii.edu/rqds/metadata_yaml/632Ameta.yaml"
ERDDAP_SECONDARY_URL = (
    "https://uhslc.soest.hawaii.edu/erddap/tabledap/global_hourly_rqds.csv"
)
NETCDF_PATH = DATA_ROOT / "h632a.nc"
METADATA_PATH = DATA_ROOT / "632Ameta.yaml"

EXPECTED_STATION_NAME = "Kanmen"
EXPECTED_UHSLC_ID = 632
EXPECTED_RECORD_ID = 6321
EXPECTED_VERSION = "A"
EXPECTED_GLOSS_ID = 94
EXPECTED_SSC_ID = "kanm"
EXPECTED_QUALITY = 4
EXPECTED_DURATION_DAYS = 35
EXPECTED_SAMPLE_COUNT = EXPECTED_DURATION_DAYS * 24
FILL_VALUE = -32767


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def np_datetime(value: datetime) -> np.datetime64:
    return np.datetime64(value.astimezone(timezone.utc).replace(tzinfo=None), "s")


def datetime64_to_utc(value: np.datetime64) -> datetime:
    seconds = value.astype("datetime64[s]").astype(np.int64)
    return datetime.fromtimestamp(int(seconds), tz=timezone.utc)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temporary:
        temporary.write(content)
        temporary.flush()
        os.fsync(temporary.fileno())
        temporary_path = Path(temporary.name)
    try:
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    atomic_write(
        path,
        (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )


def _header(headers: Any, name: str) -> str | None:
    value = headers.get(name) if headers is not None else None
    return str(value) if value is not None else None


def _content_range(value: str | None) -> tuple[int, int, int | None] | None:
    if not value:
        return None
    match = re.fullmatch(r"bytes\s+(\d+)-(\d+)/(\d+|\*)", value.strip())
    if not match:
        return None
    return (
        int(match.group(1)),
        int(match.group(2)),
        None if match.group(3) == "*" else int(match.group(3)),
    )


def _validate_download(path: Path) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f"Downloaded source is empty: {path}")
    with path.open("rb") as handle:
        prefix = handle.read(512).lstrip().lower()
    if prefix.startswith(b"<html") or prefix.startswith(b"<!doctype"):
        raise RuntimeError(f"Downloaded source is HTML, not data: {path}")


def download_https(
    url: str,
    destination: Path,
    *,
    attempts: int = 4,
    timeout_seconds: int = 120,
    opener: Callable[..., Any] = urllib.request.urlopen,
    sleeper: Callable[[float], None] = time_module.sleep,
) -> dict[str, Any]:
    """Download atomically and resume an interrupted request on retry."""

    if urllib.parse.urlparse(url).scheme != "https":
        raise ValueError(f"Only HTTPS UHSLC sources are allowed: {url}")
    if attempts < 1:
        raise ValueError("attempts must be positive")

    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    # A partial is scoped to this invocation. This avoids appending a stale
    # prefix if UHSLC replaced the upstream object between workflow runs.
    partial.unlink(missing_ok=True)
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        offset = partial.stat().st_size if partial.exists() else 0
        headers = {
            "User-Agent": "WenzhouCoastalPipeline/2.0",
            "Accept": "application/octet-stream,text/yaml,text/plain,*/*",
        }
        if offset:
            headers["Range"] = f"bytes={offset}-"
        request = urllib.request.Request(url, headers=headers)

        try:
            with opener(request, timeout=timeout_seconds) as response:
                status = int(getattr(response, "status", response.getcode()))
                response_headers = response.headers
                content_range = _content_range(_header(response_headers, "Content-Range"))
                if offset and status == 206:
                    if content_range is None or content_range[0] != offset:
                        partial.unlink(missing_ok=True)
                        raise RuntimeError(
                            f"Invalid resume Content-Range for {url}: "
                            f"{_header(response_headers, 'Content-Range')!r}"
                        )
                    mode = "ab"
                elif status == 200:
                    # The origin may ignore Range. Truncate instead of corrupting
                    # the destination by appending a complete response.
                    mode = "wb"
                    offset = 0
                else:
                    raise RuntimeError(f"Unexpected HTTP {status} while downloading {url}")

                with partial.open(mode) as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
                    output.flush()
                    os.fsync(output.fileno())

                actual_bytes = partial.stat().st_size
                expected_total: int | None = None
                if content_range is not None:
                    expected_total = content_range[2]
                elif _header(response_headers, "Content-Length") is not None:
                    expected_total = offset + int(_header(response_headers, "Content-Length") or 0)
                if expected_total is not None and actual_bytes != expected_total:
                    raise RuntimeError(
                        f"Incomplete UHSLC download for {url}: {actual_bytes} of {expected_total} bytes"
                    )

                _validate_download(partial)
                os.replace(partial, destination)
                return {
                    "requestUrl": url,
                    "finalUrl": str(response.geturl()),
                    "httpStatus": status,
                    "contentType": _header(response_headers, "Content-Type"),
                    "contentLengthHeader": _header(response_headers, "Content-Length"),
                    "contentRange": _header(response_headers, "Content-Range"),
                    "etag": _header(response_headers, "ETag"),
                    "lastModified": _header(response_headers, "Last-Modified"),
                    "acceptRanges": _header(response_headers, "Accept-Ranges"),
                    "completedAtUtc": iso_z(utc_now()),
                    "attemptCount": attempt,
                    "resumed": status == 206,
                    "bytes": destination.stat().st_size,
                    "sha256": sha256_file(destination),
                }
        except (OSError, RuntimeError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt == attempts:
                break
            sleeper(min(2 ** (attempt - 1), 8))

    raise RuntimeError(
        f"UHSLC HTTPS download failed after {attempts} attempts: {url}: {last_error}"
    ) from last_error


def clean_scalar(value: Any) -> Any:
    array = np.asarray(value)
    if array.size == 0:
        return None
    if array.size == 1:
        item = array.reshape(-1)[0]
        if isinstance(item, np.generic):
            item = item.item()
        if isinstance(item, bytes):
            return item.decode("utf-8", errors="replace").strip("\x00 ")
        if isinstance(item, str):
            return item.strip("\x00 ")
        return item
    flat = array.reshape(-1)
    if array.dtype.kind == "S":
        return b"".join(bytes(item) for item in flat).decode(
            "utf-8", errors="replace"
        ).strip("\x00 ")
    if array.dtype.kind == "U":
        return "".join(str(item) for item in flat).strip("\x00 ")
    result: list[Any] = []
    for item in flat:
        if isinstance(item, np.generic):
            item = item.item()
        if isinstance(item, bytes):
            item = item.decode("utf-8", errors="replace").strip("\x00 ")
        result.append(item)
    return result


def integer_scalar(value: Any, label: str) -> int:
    scalar = clean_scalar(value)
    try:
        return int(scalar)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid integer metadata {label}: {scalar!r}") from exc


def float_scalar(value: Any, label: str) -> float:
    scalar = clean_scalar(value)
    try:
        return float(scalar)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid float metadata {label}: {scalar!r}") from exc


def text_scalar(value: Any, label: str) -> str:
    scalar = clean_scalar(value)
    if scalar is None:
        raise RuntimeError(f"Missing text metadata {label}")
    return str(scalar).strip()


def get_station_metadata(dataset: Any) -> dict[str, Any]:
    required = [
        "lat",
        "lon",
        "station_name",
        "station_country",
        "station_country_code",
        "record_id",
        "uhslc_id",
        "version",
        "gloss_id",
        "ssc_id",
        "reference_datum",
    ]
    missing = [name for name in required if name not in dataset.variables]
    if missing:
        raise RuntimeError(f"Kanmen station dataset lacks required variables: {missing}")
    return {
        "latitude": float_scalar(dataset["lat"].values, "lat"),
        "longitude": float_scalar(dataset["lon"].values, "lon"),
        "stationName": text_scalar(dataset["station_name"].values, "station_name"),
        "stationCountry": text_scalar(dataset["station_country"].values, "station_country"),
        "stationCountryCode": integer_scalar(
            dataset["station_country_code"].values, "station_country_code"
        ),
        "recordId": integer_scalar(dataset["record_id"].values, "record_id"),
        "uhslcId": integer_scalar(dataset["uhslc_id"].values, "uhslc_id"),
        "version": text_scalar(dataset["version"].values, "version"),
        "glossId": integer_scalar(dataset["gloss_id"].values, "gloss_id"),
        "sscId": text_scalar(dataset["ssc_id"].values, "ssc_id"),
        "referenceDatum": text_scalar(dataset["reference_datum"].values, "reference_datum"),
    }


def validate_station_identity(metadata: dict[str, Any]) -> None:
    expected = {
        "stationName": EXPECTED_STATION_NAME,
        "recordId": EXPECTED_RECORD_ID,
        "uhslcId": EXPECTED_UHSLC_ID,
        "version": EXPECTED_VERSION,
        "glossId": EXPECTED_GLOSS_ID,
        "sscId": EXPECTED_SSC_ID,
    }
    mismatches = {
        key: {"expected": value, "actual": metadata.get(key)}
        for key, value in expected.items()
        if metadata.get(key) != value
    }
    if mismatches:
        raise RuntimeError(f"Kanmen identity contract failed: {mismatches}")
    if not metadata.get("referenceDatum"):
        raise RuntimeError("Kanmen reference_datum is empty")


def validate_metadata_yaml(path: Path, station: dict[str, Any]) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as exc:
        raise RuntimeError("PyYAML is required to validate 632Ameta.yaml") from exc
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    location = payload.get("Location", {})
    expected = {"Station": "Kanmen-A", "JASL_Number": "632A"}
    mismatches = {
        key: {"expected": value, "actual": location.get(key)}
        for key, value in expected.items()
        if str(location.get(key)) != value
    }
    for key, station_key in (("Latitude", "latitude"), ("Longitude", "longitude")):
        if not math.isclose(float(location.get(key)), float(station[station_key]), abs_tol=1e-4):
            mismatches[key] = {
                "expected": station[station_key],
                "actual": location.get(key),
            }
    if str(payload.get("Units")).lower() != "millimeters":
        mismatches["Units"] = {"expected": "millimeters", "actual": payload.get("Units")}
    if mismatches:
        raise RuntimeError(f"Kanmen metadata YAML identity contract failed: {mismatches}")
    return {
        "station": location.get("Station"),
        "jaslNumber": location.get("JASL_Number"),
        "latitude": float(location.get("Latitude")),
        "longitude": float(location.get("Longitude")),
        "dateStart": payload.get("Time_Details", {}).get("Date_Start"),
        "dateEnd": payload.get("Time_Details", {}).get("Date_End"),
        "units": payload.get("Units"),
        "referenceLevel": payload.get("Reference_Level"),
    }


def time_axis_values(variable: Any, expected_count: int, label: str) -> np.ndarray:
    if "time" not in variable.dims:
        scalar = clean_scalar(variable.values)
        return np.full(expected_count, scalar)
    indexers = {dimension: 0 for dimension in variable.dims if dimension != "time"}
    values = np.asarray(variable.isel(**indexers).values).reshape(-1)
    if values.size != expected_count:
        raise RuntimeError(f"{label} returned {values.size} values for {expected_count} timestamps")
    return values


def load_station_arrays(
    source_path: Path,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    try:
        import xarray as xr
    except ImportError as exc:
        raise RuntimeError("xarray and h5netcdf are required for local UHSLC NetCDF access") from exc

    with xr.open_dataset(source_path, engine="h5netcdf", decode_times=True) as dataset:
        required = {
            "lat",
            "lon",
            "time",
            "sea_level",
            "quality",
            "record_id",
            "station_country",
            "station_country_code",
            "station_name",
            "uhslc_id",
            "version",
            "gloss_id",
            "ssc_id",
            "reference_datum",
        }
        missing = sorted(required - set(dataset.variables))
        if missing:
            raise RuntimeError(f"Kanmen station dataset lacks required variables: {missing}")
        times = np.asarray(dataset["time"].values).astype("datetime64[s]").reshape(-1)
        if times.size == 0 or np.isnat(times).any():
            raise RuntimeError("Kanmen station dataset contains empty or invalid timestamps")
        if np.any(times[1:] < times[:-1]):
            raise RuntimeError("Kanmen station dataset timestamps are not monotonic")
        sea_values = time_axis_values(dataset["sea_level"], times.size, "sea_level")
        quality_values = time_axis_values(dataset["quality"], times.size, "quality")
        station = get_station_metadata(dataset)
        structure = {
            "dimensions": {name: int(size) for name, size in dataset.sizes.items()},
            "variables": {
                name: {
                    "dimensions": list(dataset[name].dims),
                    "shape": [int(value) for value in dataset[name].shape],
                    "dtype": str(dataset[name].dtype),
                    "attributes": {key: str(value) for key, value in dataset[name].attrs.items()},
                }
                for name in sorted(required)
            },
            "globalAttributes": {key: str(value) for key, value in dataset.attrs.items()},
        }
    return (
        times,
        np.asarray(sea_values),
        np.asarray(quality_values),
        {"stationMetadata": station, "netcdfStructure": structure},
    )


def evaluate_window(
    times: np.ndarray,
    valid_mask: np.ndarray,
    start: datetime,
    end_exclusive: datetime,
) -> dict[str, Any]:
    start64 = np_datetime(start)
    end64 = np_datetime(end_exclusive)
    selected = (times >= start64) & (times < end64)
    selected_times = times[selected]
    valid_times = times[selected & valid_mask]
    unique_source = np.unique(selected_times)
    unique_valid = np.unique(valid_times)
    expected_count = int((end_exclusive - start).total_seconds() // 3600)
    expected_times = start64 + np.arange(expected_count, dtype="timedelta64[h]")
    missing = np.setdiff1d(expected_times, unique_valid)
    unexpected = np.setdiff1d(unique_source, expected_times)
    return {
        "startUtc": iso_z(start),
        "endExclusiveUtc": iso_z(end_exclusive),
        "expectedSampleCount": expected_count,
        "sourceSampleCount": int(selected_times.size),
        "uniqueSourceTimestampCount": int(unique_source.size),
        "validSampleCount": int(valid_times.size),
        "uniqueValidTimestampCount": int(unique_valid.size),
        "duplicateSourceTimestampCount": int(selected_times.size - unique_source.size),
        "duplicateValidTimestampCount": int(valid_times.size - unique_valid.size),
        "missingTimestampCount": int(missing.size),
        "unexpectedTimestampCount": int(unexpected.size),
        "completenessFraction": (
            float(unique_valid.size) / float(expected_count) if expected_count else 0.0
        ),
        "containsAnySourceSamples": bool(selected_times.size),
    }


def window_is_exactly_complete(evaluation: dict[str, Any]) -> bool:
    expected = int(evaluation["expectedSampleCount"])
    return (
        expected == EXPECTED_SAMPLE_COUNT
        and evaluation["sourceSampleCount"] == expected
        and evaluation["uniqueSourceTimestampCount"] == expected
        and evaluation["validSampleCount"] == expected
        and evaluation["uniqueValidTimestampCount"] == expected
        and evaluation["duplicateSourceTimestampCount"] == 0
        and evaluation["duplicateValidTimestampCount"] == 0
        and evaluation["missingTimestampCount"] == 0
        and evaluation["unexpectedTimestampCount"] == 0
        and math.isclose(evaluation["completenessFraction"], 1.0)
    )


def select_latest_complete_window(
    times: np.ndarray,
    valid_mask: np.ndarray,
    duration_days: int,
) -> tuple[datetime, datetime, dict[str, Any]]:
    duration_hours = duration_days * 24
    if duration_hours != EXPECTED_SAMPLE_COUNT:
        raise RuntimeError(f"Kanmen duration must be {EXPECTED_DURATION_DAYS} days")
    valid_times = np.unique(times[valid_mask].astype("datetime64[s]"))
    if valid_times.size < duration_hours:
        raise RuntimeError(
            f"Kanmen station has only {valid_times.size} valid unique hours, "
            f"fewer than the required {duration_hours}"
        )

    for right_index in range(valid_times.size - 1, duration_hours - 2, -1):
        end_time = valid_times[right_index] + np.timedelta64(1, "h")
        start_time = end_time - np.timedelta64(duration_hours, "h")
        left_index = int(np.searchsorted(valid_times, start_time, side="left"))
        if right_index - left_index + 1 != duration_hours:
            continue
        start = datetime64_to_utc(start_time)
        end_exclusive = datetime64_to_utc(end_time)
        evaluation = evaluate_window(times, valid_mask, start, end_exclusive)
        if window_is_exactly_complete(evaluation):
            return start, end_exclusive, evaluation
    raise RuntimeError(
        f"No exact {duration_days}-day, {duration_hours}-sample Research Quality window "
        "exists in UHSLC 632 record 6321 version A"
    )


def select_window(
    times: np.ndarray,
    sea_values: np.ndarray,
    quality_values: np.ndarray,
    window_config: dict[str, Any],
) -> dict[str, Any]:
    duration_days = int(window_config["durationDays"])
    minimum = float(window_config["minimumCompletenessFraction"])
    policy = str(window_config["windowSelectionPolicy"])
    if policy != "prefer_configured_then_latest_complete":
        raise RuntimeError(f"Unsupported Kanmen window selection policy: {policy}")
    if duration_days != EXPECTED_DURATION_DAYS or not math.isclose(minimum, 1.0):
        raise RuntimeError("Kanmen window contract requires 35 days and completeness 1.0")

    sea_numeric = sea_values.astype("float64", copy=False)
    quality_numeric = quality_values.astype("float64", copy=False)
    valid_mask = np.isfinite(sea_numeric) & np.isfinite(quality_numeric)
    valid_mask &= sea_numeric != FILL_VALUE
    valid_mask &= quality_numeric == EXPECTED_QUALITY

    preferred_start = parse_utc(window_config["preferredStartUtc"])
    preferred_end = parse_utc(window_config["preferredEndExclusiveUtc"])
    if preferred_end - preferred_start != timedelta(days=duration_days):
        raise RuntimeError("Preferred Kanmen observation window does not match durationDays")
    preferred = evaluate_window(times, valid_mask, preferred_start, preferred_end)
    preferred["passed"] = window_is_exactly_complete(preferred)

    if preferred["passed"]:
        selected_start, selected_end, selected = preferred_start, preferred_end, preferred
        fallback_used = False
        reason = "preferred window is an exact 840-sample Research Quality window"
    else:
        selected_start, selected_end, selected = select_latest_complete_window(
            times, valid_mask, duration_days
        )
        fallback_used = True
        reason = (
            "preferred window is outside this record coverage"
            if not preferred["containsAnySourceSamples"]
            else "preferred window is not exact; selected latest exact complete window"
        )
    selected["passed"] = window_is_exactly_complete(selected)
    return {
        "policy": policy,
        "durationDays": duration_days,
        "minimumCompletenessFraction": minimum,
        "preferredWindow": preferred,
        "fallbackUsed": fallback_used,
        "selectionReason": reason,
        "selectedWindow": selected,
        "selectedStart": selected_start,
        "selectedEndExclusive": selected_end,
        "validMask": valid_mask,
    }


def materialize_selected_records(
    times: np.ndarray,
    sea_values: np.ndarray,
    quality_values: np.ndarray,
    metadata: dict[str, Any],
    selection: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], np.ndarray]:
    start64 = np_datetime(selection["selectedStart"])
    end64 = np_datetime(selection["selectedEndExclusive"])
    indices = np.flatnonzero((times >= start64) & (times < end64))
    records: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    valid_mask = selection["validMask"]
    for source_index in indices.tolist():
        timestamp = datetime64_to_utc(times[source_index])
        if not bool(valid_mask[source_index]):
            invalid.append(
                {
                    "time": iso_z(timestamp),
                    "sourceIndex": source_index,
                    "seaLevel": str(sea_values[source_index]),
                    "quality": str(quality_values[source_index]),
                    "reason": "fill_nonfinite_or_quality_not_4",
                }
            )
            continue
        sea_level = float(sea_values[source_index])
        if not sea_level.is_integer():
            raise RuntimeError(f"UHSLC millimeter source value is not integral at {iso_z(timestamp)}")
        records.append(
            {
                "time": timestamp,
                "sourceIndex": source_index,
                "seaLevelMillimeters": int(sea_level),
                "quality": int(float(quality_values[source_index])),
                **metadata,
            }
        )
    return records, invalid, indices


def normalize_records(
    records: list[dict[str, Any]],
    start: datetime,
    end_exclusive: datetime,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records.sort(key=lambda item: item["time"])
    expected = [start + timedelta(hours=index) for index in range(EXPECTED_SAMPLE_COUNT)]
    expected_set = set(expected)
    observed_times = [item["time"] for item in records]
    observed_set = set(observed_times)
    missing = sorted(expected_set - observed_set)
    unexpected = sorted(observed_set - expected_set)
    duplicate_count = len(observed_times) - len(observed_set)
    cadence_anomalies = [
        {
            "previous": iso_z(previous),
            "current": iso_z(current),
            "deltaSeconds": int((current - previous).total_seconds()),
        }
        for previous, current in zip(observed_times, observed_times[1:])
        if current - previous != timedelta(hours=1)
    ]
    if not records:
        raise RuntimeError("Selected Kanmen window contains no valid observations")

    sea_levels = [int(item["seaLevelMillimeters"]) for item in records]
    window_mean_mm = float(sum(sea_levels)) / float(len(sea_levels))
    for item in records:
        item["seaLevelMetersWindowMeanRemoved"] = (
            item["seaLevelMillimeters"] - window_mean_mm
        ) / 1000.0

    quality_histogram = Counter(item["quality"] for item in records)
    identities = {
        "stationNames": sorted({item["stationName"] for item in records}),
        "recordIds": sorted({item["recordId"] for item in records}),
        "uhslcIds": sorted({item["uhslcId"] for item in records}),
        "versions": sorted({item["version"] for item in records}),
        "glossIds": sorted({item["glossId"] for item in records}),
        "sscIds": sorted({item["sscId"] for item in records}),
        "referenceDatums": sorted({item["referenceDatum"] for item in records}),
        "coordinatePairs": sorted(
            {
                (round(item["longitude"], 6), round(item["latitude"], 6))
                for item in records
            }
        ),
    }
    identity_passed = (
        identities["stationNames"] == [EXPECTED_STATION_NAME]
        and identities["recordIds"] == [EXPECTED_RECORD_ID]
        and identities["uhslcIds"] == [EXPECTED_UHSLC_ID]
        and identities["versions"] == [EXPECTED_VERSION]
        and identities["glossIds"] == [EXPECTED_GLOSS_ID]
        and identities["sscIds"] == [EXPECTED_SSC_ID]
    )
    quality_passed = quality_histogram == Counter({EXPECTED_QUALITY: EXPECTED_SAMPLE_COUNT})
    time_passed = (
        len(records) == EXPECTED_SAMPLE_COUNT
        and duplicate_count == 0
        and not missing
        and not unexpected
        and not cadence_anomalies
        and observed_times == expected
    )
    qa = {
        "selectedWindow": {"startUtc": iso_z(start), "endExclusiveUtc": iso_z(end_exclusive)},
        "expectedSampleCount": EXPECTED_SAMPLE_COUNT,
        "validSampleCount": len(records),
        "uniqueTimestampCount": len(observed_set),
        "duplicateTimestampCount": duplicate_count,
        "missingTimestampCount": len(missing),
        "missingTimestamps": [iso_z(item) for item in missing],
        "unexpectedTimestampCount": len(unexpected),
        "unexpectedTimestamps": [iso_z(item) for item in unexpected],
        "cadenceAnomalyCount": len(cadence_anomalies),
        "cadenceAnomalies": cadence_anomalies,
        "completenessFraction": len(observed_set & expected_set) / EXPECTED_SAMPLE_COUNT,
        "minimumCompletenessFraction": 1.0,
        "qualityHistogram": {str(key): value for key, value in sorted(quality_histogram.items())},
        "identity": identities,
        "identityPassed": identity_passed,
        "qualityPassed": quality_passed,
        "timePassed": time_passed,
        "coveragePassed": time_passed,
        "windowMeanMillimeters": window_mean_mm,
        "minimumMillimeters": min(sea_levels),
        "maximumMillimeters": max(sea_levels),
        "rangeMillimeters": max(sea_levels) - min(sea_levels),
        "sourceDatum": identities["referenceDatums"],
        "absoluteDatumTransformApplied": False,
        "comparisonSeries": "seaLevelMetersWindowMeanRemoved",
    }
    qa["passed"] = identity_passed and quality_passed and time_passed
    return records, qa


def write_source_csv(path: Path, records: list[dict[str, Any]]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        [
            "time_utc",
            "source_time_index",
            "sea_level_mm_relative_reference_datum",
            "quality",
            "longitude",
            "latitude",
            "record_id",
            "uhslc_id",
            "version",
            "gloss_id",
            "ssc_id",
            "reference_datum",
        ]
    )
    for item in records:
        writer.writerow(
            [
                iso_z(item["time"]),
                item["sourceIndex"],
                item["seaLevelMillimeters"],
                item["quality"],
                f"{item['longitude']:.6f}",
                f"{item['latitude']:.6f}",
                item["recordId"],
                item["uhslcId"],
                item["version"],
                item["glossId"],
                item["sscId"],
                item["referenceDatum"],
            ]
        )
    atomic_write(path, buffer.getvalue().encode("utf-8"))


def write_mean_removed_csv(path: Path, records: list[dict[str, Any]]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        [
            "time_utc",
            "sea_level_m_window_mean_removed",
            "quality",
            "record_id",
            "uhslc_id",
            "version",
            "reference_datum",
            "absolute_datum_transform_applied",
        ]
    )
    for item in records:
        writer.writerow(
            [
                iso_z(item["time"]),
                f"{item['seaLevelMetersWindowMeanRemoved']:.12f}",
                item["quality"],
                item["recordId"],
                item["uhslcId"],
                item["version"],
                item["referenceDatum"],
                "false",
            ]
        )
    atomic_write(path, buffer.getvalue().encode("utf-8"))


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def main() -> int:
    generated = iso_z(utc_now())
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_acquisition@2.0.0",
        "generatedAtUtc": generated,
        "dataset": "JASL/UHSLC Research Quality Tide Gauge Data hourly",
        "datasetId": DATASET_ID,
        "sourceMode": "official_static_station_netcdf_local_read",
        "sourceUrl": SOURCE_URL,
        "metadataUrl": METADATA_URL,
        "erddapSecondaryUrl": ERDDAP_SECONDARY_URL,
        "remoteOpendapArrayAccess": False,
        "station": EXPECTED_STATION_NAME,
        "uhslcId": EXPECTED_UHSLC_ID,
        "recordId": EXPECTED_RECORD_ID,
        "version": EXPECTED_VERSION,
        "absoluteDatumTransformApplied": False,
        "passed": False,
    }
    qa_report: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_qa@2.0.0",
        "generatedAtUtc": generated,
        "absoluteDatumTransformApplied": False,
        "passed": False,
    }

    try:
        points = json.loads(POINTS_PATH.read_text(encoding="utf-8"))
        station_config = json.loads(STATION_PATH.read_text(encoding="utf-8"))
        window_config = points["observationWindow"]
        netcdf_transfer = download_https(SOURCE_URL, NETCDF_PATH)
        metadata_transfer = download_https(METADATA_URL, METADATA_PATH)
        acquisition["transfers"] = {
            "netcdf": netcdf_transfer,
            "metadataYaml": metadata_transfer,
        }

        times, sea_values, quality_values, source_metadata = load_station_arrays(NETCDF_PATH)
        station_identity = source_metadata["stationMetadata"]
        validate_station_identity(station_identity)
        yaml_identity = validate_metadata_yaml(METADATA_PATH, station_identity)
        selection = select_window(times, sea_values, quality_values, window_config)
        records, invalid_samples, selected_indices = materialize_selected_records(
            times, sea_values, quality_values, station_identity, selection
        )
        normalized, qa = normalize_records(
            records, selection["selectedStart"], selection["selectedEndExclusive"]
        )
        if invalid_samples or selected_indices.size != EXPECTED_SAMPLE_COUNT:
            raise RuntimeError(
                f"Selected Kanmen source slice is not exact: {selected_indices.size} positions, "
                f"{len(invalid_samples)} invalid"
            )
        if not qa["passed"]:
            raise RuntimeError("Selected Kanmen window failed exact identity, time, or quality QA")

        start = selection["selectedStart"]
        end_exclusive = selection["selectedEndExclusive"]
        stem = (
            f"KANMEN_UHSLC_RQDS_{start.strftime('%Y%m%dT%H%M%SZ')}_"
            f"{end_exclusive.strftime('%Y%m%dT%H%M%SZ')}"
        )
        source_csv_path = DATA_ROOT / f"{stem}_SOURCE_VALUES.csv"
        mean_removed_path = DATA_ROOT / f"{stem}_MEAN_REMOVED.csv"
        write_source_csv(source_csv_path, normalized)
        write_mean_removed_csv(mean_removed_path, normalized)

        files = [
            file_record(NETCDF_PATH, "official_static_station_netcdf"),
            file_record(METADATA_PATH, "official_station_metadata_yaml"),
            file_record(source_csv_path, "materialized_official_source_values"),
            file_record(mean_removed_path, "window_mean_removed_comparison_series"),
        ]
        acquisition.update(
            {
                "passed": True,
                "windowSelectionPolicy": selection["policy"],
                "preferredWindow": selection["preferredWindow"],
                "fallbackUsed": selection["fallbackUsed"],
                "selectionReason": selection["selectionReason"],
                "selectedWindow": {
                    "startUtc": iso_z(start),
                    "endExclusiveUtc": iso_z(end_exclusive),
                    "durationDays": selection["durationDays"],
                    "intervalMinutes": 60,
                    "expectedSampleCount": EXPECTED_SAMPLE_COUNT,
                    "validSampleCount": qa["validSampleCount"],
                    "completenessFraction": qa["completenessFraction"],
                },
                "datasetCoverage": {
                    "timeStartUtc": iso_z(datetime64_to_utc(times[0])),
                    "timeEndInclusiveUtc": iso_z(datetime64_to_utc(times[-1])),
                    "availableEndExclusiveUtc": iso_z(
                        datetime64_to_utc(times[-1]) + timedelta(hours=1)
                    ),
                    "timeCount": int(times.size),
                },
                "sourceStationMetadata": station_identity,
                "metadataYamlIdentity": yaml_identity,
                "netcdfStructure": source_metadata["netcdfStructure"],
                "selectedSourceIndexStart": int(selected_indices[0]),
                "selectedSourceIndexEndInclusive": int(selected_indices[-1]),
                "selectedSourceIndexCount": int(selected_indices.size),
                "invalidSelectedSampleCount": 0,
                "files": files,
                "stationMetadataContract": station_config,
            }
        )
        qa_report.update(qa)
        qa_report.update(
            {
                "windowSelectionPolicy": selection["policy"],
                "preferredWindow": selection["preferredWindow"],
                "fallbackUsed": selection["fallbackUsed"],
                "selectionReason": selection["selectionReason"],
                "sourceInvalidSampleCount": 0,
                "sourceInvalidSamples": [],
                "qualityContract": {
                    "datasetClass": "Research Quality Data Set",
                    "requiredQualityCode": EXPECTED_QUALITY,
                    "requiredSampleCount": EXPECTED_SAMPLE_COUNT,
                },
                "files": files,
                "referenceDatumPolicy": station_config["datumPolicy"],
            }
        )
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa_report["error"] = "kanmen_uhslc_acquisition_or_qa_failed"
        qa_report["detail"] = str(exc)

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ACQUISITION_REPORT, acquisition)
    write_json(QA_REPORT, qa_report)
    print(json.dumps({"acquisition": acquisition, "qa": qa_report}, ensure_ascii=False, indent=2))
    return 0 if acquisition["passed"] and qa_report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
