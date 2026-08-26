#!/usr/bin/env python3
"""Unit and local integration tests for the Kanmen UHSLC receiver."""

from __future__ import annotations

import csv
import importlib.util
import io
import tempfile
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/download_kanmen_uhslc.py"
SPEC = importlib.util.spec_from_file_location("download_kanmen_uhslc", SCRIPT)
assert SPEC and SPEC.loader
uhslc = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(uhslc)


class FakeResponse:
    def __init__(
        self,
        data: bytes,
        *,
        status: int,
        headers: dict[str, str],
        fail_after_first_read: bool = False,
    ) -> None:
        self._stream = io.BytesIO(data)
        self.status = status
        self.headers = headers
        self._fail = fail_after_first_read
        self._reads = 0

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def getcode(self) -> int:
        return self.status

    def geturl(self) -> str:
        return "https://example.test/final"

    def read(self, size: int = -1) -> bytes:
        self._reads += 1
        if self._fail and self._reads > 1:
            raise OSError("simulated interrupted transfer")
        if self._fail:
            return self._stream.read(3)
        return self._stream.read(size)


def window_config() -> dict[str, object]:
    return {
        "preferredStartUtc": "2024-09-01T00:00:00Z",
        "preferredEndExclusiveUtc": "2024-10-06T00:00:00Z",
        "durationDays": 35,
        "minimumCompletenessFraction": 1.0,
        "windowSelectionPolicy": "prefer_configured_then_latest_complete",
    }


class DownloadTests(unittest.TestCase):
    def test_interrupted_download_resumes_with_valid_content_range(self) -> None:
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            if len(requests) == 1:
                return FakeResponse(
                    b"abcdef",
                    status=200,
                    headers={"Content-Length": "6"},
                    fail_after_first_read=True,
                )
            self.assertEqual(request.get_header("Range"), "bytes=3-")
            return FakeResponse(
                b"def",
                status=206,
                headers={"Content-Length": "3", "Content-Range": "bytes 3-5/6"},
            )

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "source.nc"
            receipt = uhslc.download_https(
                "https://example.test/source.nc",
                destination,
                opener=opener,
                sleeper=lambda _: None,
            )
            self.assertEqual(destination.read_bytes(), b"abcdef")
            self.assertEqual(receipt["attemptCount"], 2)
            self.assertTrue(receipt["resumed"])

    def test_range_ignored_restarts_without_appending(self) -> None:
        calls = 0

        def opener(request, timeout):
            nonlocal calls
            calls += 1
            if calls == 1:
                return FakeResponse(
                    b"abcdef",
                    status=200,
                    headers={"Content-Length": "6"},
                    fail_after_first_read=True,
                )
            self.assertEqual(request.get_header("Range"), "bytes=3-")
            return FakeResponse(b"abcdef", status=200, headers={"Content-Length": "6"})

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "source.nc"
            receipt = uhslc.download_https(
                "https://example.test/source.nc",
                destination,
                opener=opener,
                sleeper=lambda _: None,
            )
            self.assertEqual(destination.read_bytes(), b"abcdef")
            self.assertFalse(receipt["resumed"])

    def test_retry_count_is_finite(self) -> None:
        calls = 0

        def opener(request, timeout):
            nonlocal calls
            calls += 1
            raise urllib.error.URLError("blocked")

        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "after 3 attempts"):
                uhslc.download_https(
                    "https://example.test/source.nc",
                    Path(directory) / "source.nc",
                    attempts=3,
                    opener=opener,
                    sleeper=lambda _: None,
                )
        self.assertEqual(calls, 3)

    def test_html_response_is_rejected(self) -> None:
        def opener(request, timeout):
            return FakeResponse(
                b"<!doctype html><title>proxy error</title>",
                status=200,
                headers={"Content-Length": "41", "Content-Type": "text/html"},
            )

        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "Downloaded source is HTML"):
                uhslc.download_https(
                    "https://example.test/source.nc",
                    Path(directory) / "source.nc",
                    attempts=1,
                    opener=opener,
                    sleeper=lambda _: None,
                )


class WindowTests(unittest.TestCase):
    def test_latest_exact_window_is_selected(self) -> None:
        start = np.datetime64("1997-10-01T00:00:00", "s")
        times = start + np.arange(2200, dtype="timedelta64[h]")
        sea = np.arange(times.size, dtype="float64")
        quality = np.full(times.size, 4.0)
        selected = uhslc.select_window(times, sea, quality, window_config())
        self.assertTrue(selected["fallbackUsed"])
        self.assertTrue(selected["selectedWindow"]["passed"])
        self.assertEqual(selected["selectedWindow"]["validSampleCount"], 840)
        expected_end = uhslc.datetime64_to_utc(times[-1]) + timedelta(hours=1)
        self.assertEqual(selected["selectedEndExclusive"], expected_end)

    def test_bad_quality_at_tail_moves_to_previous_complete_window(self) -> None:
        start = np.datetime64("1997-10-01T00:00:00", "s")
        times = start + np.arange(1700, dtype="timedelta64[h]")
        sea = np.arange(times.size, dtype="float64")
        quality = np.full(times.size, 4.0)
        quality[-1] = 3
        selected = uhslc.select_window(times, sea, quality, window_config())
        self.assertEqual(
            selected["selectedEndExclusive"],
            uhslc.datetime64_to_utc(times[-1]),
        )
        self.assertEqual(selected["selectedWindow"]["validSampleCount"], 840)

    def test_fewer_than_840_valid_hours_fails(self) -> None:
        start = np.datetime64("1997-01-01T00:00:00", "s")
        times = start + np.arange(839, dtype="timedelta64[h]")
        sea = np.ones(times.size)
        quality = np.full(times.size, 4.0)
        with self.assertRaisesRegex(RuntimeError, "fewer than the required 840"):
            uhslc.select_window(times, sea, quality, window_config())

    def test_duplicate_timestamp_does_not_count_toward_840(self) -> None:
        start = np.datetime64("1997-01-01T00:00:00", "s")
        times = start + np.arange(840, dtype="timedelta64[h]")
        times[-1] = times[-2]
        sea = np.ones(times.size)
        quality = np.full(times.size, 4.0)
        with self.assertRaisesRegex(RuntimeError, "fewer than the required 840"):
            uhslc.select_window(times, sea, quality, window_config())

    def test_normalization_preserves_source_datum_and_removes_only_mean(self) -> None:
        start = datetime(1997, 1, 1, tzinfo=timezone.utc)
        metadata = {
            "stationName": "Kanmen",
            "stationCountry": "China",
            "stationCountryCode": 156,
            "recordId": 6321,
            "uhslcId": 632,
            "version": "A",
            "glossId": 94,
            "sscId": "kanm",
            "referenceDatum": "station zero",
            "longitude": 121.2817,
            "latitude": 28.0883,
        }
        records = [
            {
                "time": start + timedelta(hours=index),
                "sourceIndex": index,
                "seaLevelMillimeters": 3000 + index,
                "quality": 4,
                **metadata,
            }
            for index in range(840)
        ]
        normalized, qa = uhslc.normalize_records(records, start, start + timedelta(days=35))
        self.assertTrue(qa["passed"])
        self.assertFalse(qa["absoluteDatumTransformApplied"])
        self.assertEqual({item["referenceDatum"] for item in normalized}, {"station zero"})
        self.assertAlmostEqual(
            sum(item["seaLevelMetersWindowMeanRemoved"] for item in normalized),
            0.0,
            places=12,
        )


class OfficialFileIntegrationTests(unittest.TestCase):
    def test_official_static_file_identity_and_latest_window(self) -> None:
        if not uhslc.NETCDF_PATH.is_file():
            self.skipTest("official h632a.nc has not been downloaded in this worktree")
        times, sea, quality, metadata = uhslc.load_station_arrays(uhslc.NETCDF_PATH)
        uhslc.validate_station_identity(metadata["stationMetadata"])
        self.assertEqual(times.size, 201616)
        selected = uhslc.select_window(times, sea, quality, window_config())
        self.assertEqual(
            uhslc.iso_z(selected["selectedStart"]),
            "1997-11-26T16:00:00Z",
        )
        self.assertEqual(
            uhslc.iso_z(selected["selectedEndExclusive"]),
            "1997-12-31T16:00:00Z",
        )
        self.assertTrue(uhslc.window_is_exactly_complete(selected["selectedWindow"]))

    def test_generated_csvs_are_distinct_truthful_series(self) -> None:
        acquisition_path = uhslc.ACQUISITION_REPORT
        if not acquisition_path.is_file():
            self.skipTest("Kanmen acquisition has not run in this worktree")
        import json

        acquisition = json.loads(acquisition_path.read_text(encoding="utf-8"))
        if not acquisition.get("passed"):
            self.skipTest("Kanmen acquisition report is not passed")
        source_item = next(
            item for item in acquisition["files"]
            if item["role"] == "materialized_official_source_values"
        )
        mean_item = next(
            item for item in acquisition["files"]
            if item["role"] == "window_mean_removed_comparison_series"
        )
        with (uhslc.REPO_ROOT / source_item["path"]).open(newline="", encoding="utf-8") as handle:
            source_rows = list(csv.DictReader(handle))
        with (uhslc.REPO_ROOT / mean_item["path"]).open(newline="", encoding="utf-8") as handle:
            mean_rows = list(csv.DictReader(handle))
        self.assertEqual(len(source_rows), 840)
        self.assertEqual(len(mean_rows), 840)
        self.assertTrue(all(row["reference_datum"] == "station zero" for row in source_rows))
        self.assertTrue(
            all(row["absolute_datum_transform_applied"] == "false" for row in mean_rows)
        )
        self.assertAlmostEqual(
            sum(float(row["sea_level_m_window_mean_removed"]) for row in mean_rows),
            0.0,
            places=9,
        )


if __name__ == "__main__":
    unittest.main()
