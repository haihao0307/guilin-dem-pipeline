#!/usr/bin/env python3
"""Acquire and validate the official Kanmen UHSLC hourly research-quality record."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]
POINTS_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/tide_points_v100.json"
STATION_PATH = REPO_ROOT / "projects/wenzhou/coastal/config/kanmen_station_metadata_v100.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/coastal/data/gauges/kanmen"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/coastal/reports"
ACQUISITION_REPORT = REPORT_ROOT / "KANMEN_UHSLC_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "KANMEN_UHSLC_QA.json"

DATASET_ID = "global_hourly_rqds"
BASE_URL = f"https://uhslc.soest.hawaii.edu/erddap/tabledap/{DATASET_ID}"
VARIABLES = [
    "time",
    "sea_level",
    "quality",
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
EXPECTED_UHSLC_ID = 632
EXPECTED_RECORD_ID = 6321
EXPECTED_VERSION = "A"
EXPECTED_GLOSS_ID = 94
EXPECTED_SSC_ID = "kanm"
EXPECTED_QUALITY = 4
FILL_VALUE = -32767


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


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


def build_query(start: str, end_exclusive: str) -> str:
    selections = ",".join(VARIABLES)
    constraints = [
        f"uhslc_id={EXPECTED_UHSLC_ID}",
        f"record_id={EXPECTED_RECORD_ID}",
        f'version="{EXPECTED_VERSION}"',
        f"time>={start}",
        f"time<{end_exclusive}",
        'orderBy("time")',
    ]
    raw_query = selections + "&" + "&".join(constraints)
    return urllib.parse.quote(raw_query, safe=",=&<>():")


def fetch(url: str) -> tuple[bytes, dict[str, Any]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "WenzhouCoastalPipeline/1.0",
            "Accept": "text/csv,text/plain,application/octet-stream,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        content = response.read()
        status = getattr(response, "status", 200)
        content_type = response.headers.get("Content-Type", "")
        if status != 200:
            raise RuntimeError(f"UHSLC ERDDAP returned HTTP {status}: {url}")
        prefix = content[:256].lstrip().lower()
        if b"<html" in prefix or b"<!doctype" in prefix:
            raise RuntimeError(f"UHSLC endpoint returned HTML instead of data: {content_type}")
        if not content:
            raise RuntimeError("UHSLC endpoint returned an empty response")
        metadata = {
            "requestUrl": url,
            "httpStatus": status,
            "contentType": content_type,
            "contentLengthHeader": response.headers.get("Content-Length"),
            "lastModified": response.headers.get("Last-Modified"),
            "etag": response.headers.get("ETag"),
        }
        return content, metadata


def parse_csv_response(content: bytes) -> tuple[list[str], list[str], list[dict[str, str]]]:
    text = content.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 3:
        raise RuntimeError(f"UHSLC CSV contained fewer than three rows: {len(rows)}")
    header = [item.strip() for item in rows[0]]
    units = [item.strip() for item in rows[1]]
    if header != VARIABLES:
        raise RuntimeError(f"Unexpected UHSLC CSV header: {header}")
    if len(units) != len(header):
        raise RuntimeError(f"UHSLC CSV units row length mismatch: {units}")
    records: list[dict[str, str]] = []
    for row_number, row in enumerate(rows[2:], start=3):
        if not row or all(not item.strip() for item in row):
            continue
        if len(row) != len(header):
            raise RuntimeError(
                f"UHSLC CSV row {row_number} has {len(row)} values, expected {len(header)}"
            )
        records.append(dict(zip(header, [item.strip() for item in row], strict=True)))
    if not records:
        raise RuntimeError("UHSLC CSV contained no observation records")
    return header, units, records


def integer(value: str, field: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer in field {field}: {value!r}") from exc


def floating(value: str, field: str) -> float:
    try:
        return float(value)
    except ValueError as exc:
        raise RuntimeError(f"Invalid float in field {field}: {value!r}") from exc


def expected_timestamps(start: datetime, end_exclusive: datetime) -> list[datetime]:
    values: list[datetime] = []
    current = start
    while current < end_exclusive:
        values.append(current)
        current += timedelta(hours=1)
    return values


def normalize_records(
    records: list[dict[str, str]],
    start: datetime,
    end_exclusive: datetime,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    invalid_rows: list[dict[str, Any]] = []
    for row_index, record in enumerate(records, start=1):
        try:
            timestamp = parse_utc(record["time"])
            sea_level_mm = integer(record["sea_level"], "sea_level")
            quality = integer(record["quality"], "quality")
            latitude = floating(record["latitude"], "latitude")
            longitude = floating(record["longitude"], "longitude")
            row = {
                "time": timestamp,
                "seaLevelMillimeters": sea_level_mm,
                "quality": quality,
                "latitude": latitude,
                "longitude": longitude,
                "stationName": record["station_name"],
                "stationCountry": record["station_country"],
                "stationCountryCode": integer(
                    record["station_country_code"], "station_country_code"
                ),
                "recordId": integer(record["record_id"], "record_id"),
                "uhslcId": integer(record["uhslc_id"], "uhslc_id"),
                "version": record["version"],
                "glossId": integer(record["gloss_id"], "gloss_id"),
                "sscId": record["ssc_id"],
                "referenceDatum": record["reference_datum"],
            }
            if sea_level_mm == FILL_VALUE:
                raise RuntimeError("sea_level is the UHSLC fill value")
            if not (start <= timestamp < end_exclusive):
                raise RuntimeError("timestamp is outside the requested observation window")
            normalized.append(row)
        except Exception as exc:
            invalid_rows.append(
                {
                    "rowIndex": row_index,
                    "error": type(exc).__name__,
                    "detail": str(exc),
                    "record": record,
                }
            )

    normalized.sort(key=lambda item: item["time"])
    expected = expected_timestamps(start, end_exclusive)
    expected_set = set(expected)
    observed_times = [item["time"] for item in normalized]
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

    sea_levels = [item["seaLevelMillimeters"] for item in normalized]
    window_mean_mm = sum(sea_levels) / len(sea_levels) if sea_levels else math.nan
    for item in normalized:
        item["seaLevelMetersRelativeReferenceDatum"] = item["seaLevelMillimeters"] / 1000.0
        item["seaLevelMetersWindowMeanRemoved"] = (
            item["seaLevelMillimeters"] - window_mean_mm
        ) / 1000.0

    quality_histogram = Counter(item["quality"] for item in normalized)
    references = sorted({item["referenceDatum"] for item in normalized})
    coordinate_pairs = sorted(
        {(round(item["longitude"], 6), round(item["latitude"], 6)) for item in normalized}
    )
    identities = {
        "stationNames": sorted({item["stationName"] for item in normalized}),
        "stationCountries": sorted({item["stationCountry"] for item in normalized}),
        "recordIds": sorted({item["recordId"] for item in normalized}),
        "uhslcIds": sorted({item["uhslcId"] for item in normalized}),
        "versions": sorted({item["version"] for item in normalized}),
        "glossIds": sorted({item["glossId"] for item in normalized}),
        "sscIds": sorted({item["sscId"] for item in normalized}),
        "referenceDatums": references,
        "coordinatePairs": coordinate_pairs,
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
        "observedRowCount": len(records),
        "validSampleCount": len(normalized),
        "invalidRowCount": len(invalid_rows),
        "invalidRows": invalid_rows,
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
        "minimumMillimeters": min(sea_levels) if sea_levels else None,
        "maximumMillimeters": max(sea_levels) if sea_levels else None,
        "rangeMillimeters": max(sea_levels) - min(sea_levels) if sea_levels else None,
        "absoluteDatumTransformApplied": False,
        "comparisonSeries": "seaLevelMetersWindowMeanRemoved",
    }
    qa["passed"] = (
        bool(normalized)
        and not invalid_rows
        and identity_passed
        and quality_passed
        and time_passed
        and coverage_passed
    )
    return normalized, qa


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


def main() -> int:
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_acquisition@1.0.0",
        "generatedAtUtc": generated,
        "dataset": "JASL/UHSLC Research Quality Tide Gauge Data hourly",
        "datasetId": DATASET_ID,
        "station": "Kanmen",
        "uhslcId": EXPECTED_UHSLC_ID,
        "recordId": EXPECTED_RECORD_ID,
        "version": EXPECTED_VERSION,
        "passed": False,
    }
    qa_report: dict[str, Any] = {
        "schema": "wenzhou_kanmen_uhslc_qa@1.0.0",
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

        query = build_query(start_text, end_text)
        data_url = f"{BASE_URL}.csv?{query}"
        metadata_url = f"{BASE_URL}.das"
        raw_content, transfer = fetch(data_url)
        das_content, das_transfer = fetch(metadata_url)

        header, units, records = parse_csv_response(raw_content)
        normalized, qa = normalize_records(records, start, end_exclusive)
        raw_name = (
            f"KANMEN_UHSLC_RQDS_{start.strftime('%Y%m%dT%H%M%SZ')}_"
            f"{end_exclusive.strftime('%Y%m%dT%H%M%SZ')}.csv"
        )
        raw_path = DATA_ROOT / raw_name
        normalized_path = DATA_ROOT / raw_name.replace(".csv", "_NORMALIZED.csv")
        das_path = DATA_ROOT / f"{DATASET_ID}.das"
        atomic_write(raw_path, raw_content)
        atomic_write(das_path, das_content)
        write_normalized_csv(normalized_path, normalized)

        acquisition.update(
            {
                "passed": True,
                "request": transfer,
                "metadataRequest": das_transfer,
                "requestedWindow": {
                    "startUtc": start_text,
                    "endExclusiveUtc": end_text,
                },
                "variables": header,
                "unitsRow": units,
                "raw": {
                    "path": str(raw_path.relative_to(REPO_ROOT)),
                    "bytes": raw_path.stat().st_size,
                    "sha256": sha256_file(raw_path),
                },
                "normalized": {
                    "path": str(normalized_path.relative_to(REPO_ROOT)),
                    "bytes": normalized_path.stat().st_size,
                    "sha256": sha256_file(normalized_path),
                    "absoluteDatumTransformApplied": False,
                },
                "datasetMetadata": {
                    "path": str(das_path.relative_to(REPO_ROOT)),
                    "bytes": das_path.stat().st_size,
                    "sha256": sha256_file(das_path),
                },
                "stationMetadata": station_metadata,
            }
        )
        qa_report.update(qa)
        qa_report["rawSha256"] = acquisition["raw"]["sha256"]
        qa_report["normalizedSha256"] = acquisition["normalized"]["sha256"]
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
