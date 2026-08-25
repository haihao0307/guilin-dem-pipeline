#!/usr/bin/env python3
"""Acquire and validate the official Kanmen UHSLC hourly research-quality record.

The script reads the dedicated Kanmen station dataset instead of scanning the
large global ERDDAP table. The selected source values remain in their published
millimetre reference datum. A second series with the window mean removed is
provided for phase and tidal-range comparison before an absolute datum transform
has been verified.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[4]
POINTS_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/tide_points_v100.json"
STATION_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/kanmen_station_metadata_v100.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/gauges/kanmen"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/coastal/reports"
ACQUISITION_REPORT = REPORT_ROOT / "KANMEN_UHSLC_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "KANMEN_UHSLC_QA.json"

DATASET_ID = "h632a"
SOURCE_URL = "https://uhslc.soest.hawaii.edu/opendap/rqds/pacific/hourly/h632a.nc"
SOURCE_DAS_URL = f"{SOURCE_URL}.das"
SOURCE_DDS_URL = f"{SOURCE_URL}.dds"
DIRECT_CSV_URL = "https://uhslc.soest.hawaii.edu/data/csv/rqds/pacific/hourly/h632a.csv"
EXPECTED_UHSLC_ID = 632
EXPECTED_RECORD_ID = 6321
EXPECTED_VERSION = "A"
EXPECTED_GLOSS_ID = 94
EXPECTED_SSC_ID = "kanm"
EXPECTED_QUALITY = 4
FILL_VALUE = -32767


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
        temp_path = Path(temporary.name)
    try:
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    atomic_write(
        path,
        (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def fetch_text(url: str) -> tuple[bytes, dict[str, Any]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "WenzhouCoastalPipeline/1.0",
            "Accept": "text/plain,application/octet-stream,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        content = response.read()
        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"UHSLC metadata endpoint returned HTTP {status}: {url}")
        if not content:
            raise RuntimeError(f"UHSLC metadata endpoint returned no bytes: {url}")
        prefix = content[:256].lstrip().lower()
        if b"<html" in prefix or b"<!doctype" in prefix:
            raise RuntimeError(f"UHSLC metadata endpoint returned HTML: {url}")
        return content, {
            "requestUrl": url,
            "httpStatus": status,
            "contentType": response.headers.get("Content-Type", ""),
            "contentLengthHeader": response.headers.get("Content-Length"),
            "lastModified": response.headers.get("Last-Modified"),
            "etag": response.headers.get("ETag"),
        }


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
        return b"".join(bytes(item) for item in flat).decode("utf-8", errors="replace").strip("\x00 ")
    if array.dtype.kind == "U":
        return "".join(str(item) for item in flat).strip("\x00 ")
    values: list[Any] = []
    for item in flat:
        if isinstance(item, np.generic):
            item = item.item()
        if isinstance(item, bytes):
            item = item.decode("utf-8", errors="replace").strip("\x00 ")
        values.append(item)
    return values


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


def expected_timestamps(start: datetime, end_exclusive: datetime) -> list[datetime]:
    values: list[datetime] = []
    current = start
    while current < end_exclusive:
        values.append(current)
        current += timedelta(hours=1)
    return values


def datetime64_to_utc(value: np.datetime64) -> datetime:
    seconds = value.astype("datetime64[s]").astype(np.int64)
    return datetime.fromtimestamp(int(seconds), tz=timezone.utc)


def get_station_metadata(dataset: Any) -> dict[str, Any]:
    required = [
        "latitude",
        "longitude",
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
        "latitude": float_scalar(dataset["latitude"].values, "latitude"),
        "longitude": float_scalar(dataset["longitude"].values, "longitude"),
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


def station_quality(dataset: Any, selected_indices: np.ndarray) -> np.ndarray:
    if "quality" not in dataset.variables:
        raise RuntimeError("Kanmen station dataset lacks the quality variable")
    quality = dataset["quality"]
    if "time" in quality.dims:
        time_axis = quality.dims.index("time")
        indexers: dict[str, Any] = {"time": selected_indices}
        for dimension in quality.dims:
            if dimension != "time":
                indexers[dimension] = 0
        values = np.asarray(quality.isel(**indexers).values).reshape(-1)
        if values.size != selected_indices.size:
            raise RuntimeError(
                f"Time-varying quality returned {values.size} values for {selected_indices.size} timestamps"
            )
        return values.astype("int16")
    scalar = integer_scalar(quality.values, "quality")
    return np.full(selected_indices.size, scalar, dtype="int16")


def load_station_window(start: datetime, end_exclusive: datetime) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        import xarray as xr
    except ImportError as exc:
        raise RuntimeError("xarray is required for the UHSLC station OPeNDAP record") from exc

    start64 = np.datetime64(start.replace(tzinfo=None), "s")
    end64 = np.datetime64(end_exclusive.replace(tzinfo=None), "s")
    with xr.open_dataset(SOURCE_URL, engine="pydap", decode_times=True) as dataset:
        if "time" not in dataset.variables or "sea_level" not in dataset.variables:
            raise RuntimeError("Kanmen station dataset lacks time or sea_level")
        times = np.asarray(dataset["time"].values).astype("datetime64[s]")
        selected_indices = np.flatnonzero((times >= start64) & (times < end64))
        if selected_indices.size == 0:
            raise RuntimeError(
                f"Kanmen station dataset contains no samples from {iso_z(start)} to {iso_z(end_exclusive)}"
            )
        if not np.array_equal(
            selected_indices,
            np.arange(selected_indices[0], selected_indices[-1] + 1),
        ):
            raise RuntimeError("Kanmen selected time indices are not contiguous")

        sea_level = dataset["sea_level"]
        indexers: dict[str, Any] = {"time": selected_indices}
        for dimension in sea_level.dims:
            if dimension != "time":
                indexers[dimension] = 0
        sea_values = np.asarray(sea_level.isel(**indexers).values).reshape(-1)
        if sea_values.size != selected_indices.size:
            raise RuntimeError(
                f"Sea-level selection returned {sea_values.size} values for {selected_indices.size} timestamps"
            )
        quality_values = station_quality(dataset, selected_indices)
        metadata = get_station_metadata(dataset)
        source_attributes = {key: str(value) for key, value in dataset.attrs.items()}
        variable_attributes = {
            name: {key: str(value) for key, value in dataset[name].attrs.items()}
            for name in ("time", "sea_level", "quality")
            if name in dataset.variables
        }

    records: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    for offset, source_index in enumerate(selected_indices.tolist()):
        timestamp = datetime64_to_utc(times[source_index])
        sea_value = sea_values[offset]
        quality_value = quality_values[offset]
        if np.ma.is_masked(sea_value) or not np.isfinite(float(sea_value)):
            invalid.append({"time": iso_z(timestamp), "reason": "masked_or_nonfinite_sea_level"})
            continue
        sea_level_mm = int(round(float(sea_value)))
        if sea_level_mm == FILL_VALUE:
            invalid.append({"time": iso_z(timestamp), "reason": "uhslc_fill_value"})
            continue
        records.append(
            {
                "time": timestamp,
                "sourceIndex": int(source_index),
                "seaLevelMillimeters": sea_level_mm,
                "quality": int(quality_value),
                **metadata,
            }
        )

    source = {
        "datasetUrl": SOURCE_URL,
        "directCsvCompanionUrl": DIRECT_CSV_URL,
        "selectedSourceIndexStart": int(selected_indices[0]),
        "selectedSourceIndexEndInclusive": int(selected_indices[-1]),
        "selectedSourceIndexCount": int(selected_indices.size),
        "datasetTimeCount": int(times.size),
        "datasetTimeStartUtc": iso_z(datetime64_to_utc(times[0])),
        "datasetTimeEndUtc": iso_z(datetime64_to_utc(times[-1])),
        "stationMetadata": metadata,
        "datasetAttributes": source_attributes,
        "variableAttributes": variable_attributes,
        "invalidSourceSamples": invalid,
    }
    return records, source


def normalize_records(
    records: list[dict[str, Any]],
    start: datetime,
    end_exclusive: datetime,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records.sort(key=lambda item: item["time"])
    expected = expected_timestamps(start, end_exclusive)
    expected_set = set(expected)
    observed_times = [item["time"] for item in records]
    observed_set = set(observed_times)
    duplicate_count = len(observed_times) - len(observed_set)
    missing = sorted(expected_set - observed_set)
    unexpected = sorted(observed_set - expected_set)

    cadence_anomalies: list[dict[str, Any]] = []
    for previous, current in zip(observed_times, observed_times[1:]):
        delta = current - previous
        if delta != timedelta(hours=1):
            cadence_anomalies.append(
                {
                    "previous": iso_z(previous),
                    "current": iso_z(current),
                    "deltaSeconds": int(delta.total_seconds()),
                }
            )

    sea_levels = [item["seaLevelMillimeters"] for item in records]
    if not sea_levels:
        raise RuntimeError("Kanmen selected window contains no valid sea-level observations")
    window_mean_mm = float(sum(sea_levels)) / float(len(sea_levels))
    for item in records:
        item["seaLevelMetersRelativeReferenceDatum"] = item["seaLevelMillimeters"] / 1000.0
        item["seaLevelMetersWindowMeanRemoved"] = (
            item["seaLevelMillimeters"] - window_mean_mm
        ) / 1000.0

    quality_histogram = Counter(item["quality"] for item in records)
    identities = {
        "stationNames": sorted({item["stationName"] for item in records}),
        "stationCountries": sorted({item["stationCountry"] for item in records}),
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
    completeness = len(observed_set & expected_set) / len(expected_set) if expected_set else 0.0
    identity_passed = (
        identities["stationNames"] == ["Kanmen"]
        and identities["recordIds"] == [EXPECTED_RECORD_ID]
        and identities["uhslcIds"] == [EXPECTED_UHSLC_ID]
        and identities["versions"] == [EXPECTED_VERSION]
        and identities["glossIds"] == [EXPECTED_GLOSS_ID]
        and identities["sscIds"] == [EXPECTED_SSC_ID]
    )
    quality_passed = set(quality_histogram) == {EXPECTED_QUALITY}
    time_passed = duplicate_count == 0 and not unexpected and observed_times == sorted(observed_times)
    coverage_passed = completeness >= 0.95

    qa = {
        "expectedSampleCount": len(expected),
        "validSampleCount": len(records),
        "uniqueTimestampCount": len(observed_set),
        "duplicateTimestampCount": duplicate_count,
        "missingTimestampCount": len(missing),
        "missingTimestamps": [iso_z(item) for item in missing],
        "unexpectedTimestampCount": len(unexpected),
        "unexpectedTimestamps": [iso_z(item) for item in unexpected],
        "cadenceAnomalyCount": len(cadence_anomalies),
        "cadenceAnomalies": cadence_anomalies,
        "completenessFraction": completeness,
        "qualityHistogram": {str(key): value for key, value in sorted(quality_histogram.items())},
        "identity": identities,
        "identityPassed": identity_passed,
        "qualityPassed": quality_passed,
        "timePassed": time_passed,
        "coveragePassed": coverage_passed,
        "windowMeanMillimeters": window_mean_mm,
        "minimumMillimeters": min(sea_levels),
        "maximumMillimeters": max(sea_levels),
        "rangeMillimeters": max(sea_levels) - min(sea_levels),
        "absoluteDatumTransformApplied": False,
        "comparisonSeries": "seaLevelMetersWindowMeanRemoved",
    }
    qa["passed"] = (
        identity_passed
        and quality_passed
        and time_passed
        and coverage_passed
    )
    return records, qa


def write_source_csv(path: Path, records: list[dict[str, Any]]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
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


def write_normalized_csv(path: Path, records: list[dict[str, Any]]) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "time_utc",
            "sea_level_mm_relative_reference_datum",
            "sea_level_m_relative_reference_datum",
            "sea_level_m_window_mean_removed",
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
                item["seaLevelMillimeters"],
                f"{item['seaLevelMetersRelativeReferenceDatum']:.6f}",
                f"{item['seaLevelMetersWindowMeanRemoved']:.6f}",
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


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def main() -> int:
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_acquisition@1.1.0",
        "generatedAtUtc": generated,
        "dataset": "JASL/UHSLC Research Quality Tide Gauge Data hourly",
        "datasetId": DATASET_ID,
        "sourceMode": "dedicated station OPeNDAP record",
        "sourceUrl": SOURCE_URL,
        "station": "Kanmen",
        "uhslcId": EXPECTED_UHSLC_ID,
        "recordId": EXPECTED_RECORD_ID,
        "version": EXPECTED_VERSION,
        "passed": False,
    }
    qa_report: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_qa@1.1.0",
        "generatedAtUtc": generated,
        "passed": False,
    }

    try:
        points = json.loads(POINTS_PATH.read_text(encoding="utf-8"))
        station_metadata = json.loads(STATION_PATH.read_text(encoding="utf-8"))
        observation_window = points["observationWindow"]
        start_text = observation_window["startUtc"]
        end_text = observation_window["endExclusiveUtc"]
        start = parse_utc(start_text)
        end_exclusive = parse_utc(end_text)
        if end_exclusive <= start:
            raise RuntimeError("Kanmen observation end must be later than start")

        das_content, das_transfer = fetch_text(SOURCE_DAS_URL)
        dds_content, dds_transfer = fetch_text(SOURCE_DDS_URL)
        records, source_evidence = load_station_window(start, end_exclusive)
        normalized, qa = normalize_records(records, start, end_exclusive)

        stem = (
            f"KANMEN_UHSLC_RQDS_{start.strftime('%Y%m%dT%H%M%SZ')}_"
            f"{end_exclusive.strftime('%Y%m%dT%H%M%SZ')}"
        )
        source_csv_path = DATA_ROOT / f"{stem}_SOURCE_VALUES.csv"
        normalized_path = DATA_ROOT / f"{stem}_NORMALIZED.csv"
        source_evidence_path = DATA_ROOT / f"{stem}_OPENDAP_REQUEST.json"
        das_path = DATA_ROOT / f"{DATASET_ID}.das"
        dds_path = DATA_ROOT / f"{DATASET_ID}.dds"

        write_source_csv(source_csv_path, normalized)
        write_normalized_csv(normalized_path, normalized)
        write_json(
            source_evidence_path,
            {
                "schema": "wenzhou_kanmen_opendap_request@1.0.0",
                "generatedAtUtc": generated,
                "datasetUrl": SOURCE_URL,
                "dasUrl": SOURCE_DAS_URL,
                "ddsUrl": SOURCE_DDS_URL,
                "directCsvCompanionUrl": DIRECT_CSV_URL,
                "requestedWindow": {
                    "startUtc": start_text,
                    "endExclusiveUtc": end_text,
                },
                **source_evidence,
            },
        )
        atomic_write(das_path, das_content)
        atomic_write(dds_path, dds_content)

        files = [
            file_record(source_csv_path, "materialized_official_source_values"),
            file_record(normalized_path, "mean_removed_comparison_series"),
            file_record(source_evidence_path, "opendap_request_and_source_identity"),
            file_record(das_path, "official_opendap_das"),
            file_record(dds_path, "official_opendap_dds"),
        ]
        acquisition.update(
            {
                "passed": True,
                "requestedWindow": {
                    "startUtc": start_text,
                    "endExclusiveUtc": end_text,
                },
                "opendapMetadataRequests": {
                    "das": das_transfer,
                    "dds": dds_transfer,
                },
                "sourceEvidence": source_evidence,
                "files": files,
                "stationMetadata": station_metadata,
            }
        )
        qa_report.update(qa)
        qa_report["sourceInvalidSamples"] = source_evidence["invalidSourceSamples"]
        qa_report["sourceInvalidSampleCount"] = len(source_evidence["invalidSourceSamples"])
        qa_report["files"] = files
        qa_report["referenceDatumPolicy"] = station_metadata["datumPolicy"]
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
