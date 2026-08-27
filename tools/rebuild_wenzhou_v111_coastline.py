#!/usr/bin/env python3
"""Rebuild the visible Wenzhou coastline without polygon closure chords.

The projected OSM source contains a small number of very long direct segments that
are useful for source topology bookkeeping but appear as straight cyan chords in
the 3D review scene. This script keeps the source file immutable, splits each
source part at direct segments longer than the review threshold, clips retained
runs to the authoritative DEM AOI, densifies them to <=25 m, and updates the
V1.1.1 manifest hashes.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Sequence

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson"
MANIFEST_PATH = ROOT / "web/wenzhou-v111/assets/hires/manifest.json"
OUTPUT = ROOT / "web/wenzhou-v111/assets/hires/coastline_truth_aoi_draped.json"
REPORT = ROOT / "projects/wenzhou/reports/WENZHOU_V111_COASTLINE_CHORD_FILTER.json"

EXPECTED_SOURCE_SHA = "5cfeb0465df59590c78c6b163f60ae8764731e1ea65e3adcbc5052813b299181"
MAX_SOURCE_SEGMENT_M = 2500.0
SAMPLE_STEP_M = 25.0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def geometry_parts(geometry: dict[str, Any]) -> Iterator[list[list[float]]]:
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if kind == "LineString" and isinstance(coordinates, list):
        yield coordinates
    elif kind == "MultiLineString" and isinstance(coordinates, list):
        for part in coordinates:
            if isinstance(part, list):
                yield part


def clean_points(points: Sequence[Sequence[float]]) -> list[list[float]]:
    output: list[list[float]] = []
    for point in points:
        if len(point) < 2:
            continue
        x, y = float(point[0]), float(point[1])
        if not (math.isfinite(x) and math.isfinite(y)):
            continue
        if not output or math.hypot(output[-1][0] - x, output[-1][1] - y) > 1e-6:
            output.append([x, y])
    return output


def split_long_direct_segments(points: Sequence[Sequence[float]]) -> tuple[list[list[list[float]]], list[dict[str, float]]]:
    clean = clean_points(points)
    runs: list[list[list[float]]] = []
    dropped: list[dict[str, float]] = []
    current: list[list[float]] = []
    for index, point in enumerate(clean):
        if not current:
            current = [point]
            continue
        previous = current[-1]
        length = math.hypot(point[0] - previous[0], point[1] - previous[1])
        if length > MAX_SOURCE_SEGMENT_M:
            if len(current) >= 2:
                runs.append(current)
            dropped.append({
                "fromX": previous[0],
                "fromY": previous[1],
                "toX": point[0],
                "toY": point[1],
                "lengthMeters": length,
            })
            current = [point]
        else:
            current.append(point)
    if len(current) >= 2:
        runs.append(current)
    return runs, dropped


def clip_segment(start: Sequence[float], end: Sequence[float], bounds: Sequence[float]) -> tuple[list[float], list[float]] | None:
    xmin, ymin, xmax, ymax = bounds
    x0, y0 = float(start[0]), float(start[1])
    x1, y1 = float(end[0]), float(end[1])
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - xmin), (dx, xmax - x0), (-dy, y0 - ymin), (dy, ymax - y0)):
        if abs(p) < 1e-12:
            if q < 0:
                return None
            continue
        ratio = q / p
        if p < 0:
            if ratio > t1:
                return None
            t0 = max(t0, ratio)
        else:
            if ratio < t0:
                return None
            t1 = min(t1, ratio)
    return [x0 + t0 * dx, y0 + t0 * dy], [x0 + t1 * dx, y0 + t1 * dy]


def clip_polyline(points: Sequence[Sequence[float]], bounds: Sequence[float]) -> list[list[list[float]]]:
    clean = clean_points(points)
    runs: list[list[list[float]]] = []
    current: list[list[float]] = []
    for index in range(1, len(clean)):
        clipped = clip_segment(clean[index - 1], clean[index], bounds)
        if clipped is None:
            if len(current) >= 2:
                runs.append(current)
            current = []
            continue
        first, second = clipped
        if not current or math.hypot(current[-1][0] - first[0], current[-1][1] - first[1]) > 1e-5:
            if len(current) >= 2:
                runs.append(current)
            current = [first]
        if math.hypot(current[-1][0] - second[0], current[-1][1] - second[1]) > 1e-6:
            current.append(second)
    if len(current) >= 2:
        runs.append(current)
    return runs


def densify(points: Sequence[Sequence[float]], maximum_step: float) -> list[list[float]]:
    clean = clean_points(points)
    if len(clean) < 2:
        return clean
    output = [clean[0]]
    for index in range(1, len(clean)):
        start, end = clean[index - 1], clean[index]
        length = math.hypot(end[0] - start[0], end[1] - start[1])
        steps = max(1, int(math.ceil(length / maximum_step)))
        for step in range(1, steps + 1):
            t = step / steps
            output.append([
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
            ])
    return output


def main() -> int:
    if sha256_file(SOURCE) != EXPECTED_SOURCE_SHA:
        raise RuntimeError("OSM coastline source SHA changed")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    bounds = manifest["truth"]["bounds"]
    origin = manifest["worldOriginProjected"]

    parts: list[dict[str, Any]] = []
    dropped_segments: list[dict[str, Any]] = []
    source_parts = 0
    source_vertices = 0
    sample_count = 0
    maximum_retained_source_segment = 0.0

    for feature_index, feature in enumerate(source.get("features", [])):
        properties = feature.get("properties") or {}
        for part_index, raw in enumerate(geometry_parts(feature.get("geometry") or {})):
            source_parts += 1
            source_vertices += len(raw)
            split_runs, dropped = split_long_direct_segments(raw)
            for item in dropped:
                dropped_segments.append({
                    "featureIndex": feature_index,
                    "partIndex": part_index,
                    "sourceId": properties.get("partId") or properties.get("osmId"),
                    **item,
                })
            for split_index, split_run in enumerate(split_runs):
                for index in range(1, len(split_run)):
                    maximum_retained_source_segment = max(
                        maximum_retained_source_segment,
                        math.hypot(
                            split_run[index][0] - split_run[index - 1][0],
                            split_run[index][1] - split_run[index - 1][1],
                        ),
                    )
                for run_index, clipped in enumerate(clip_polyline(split_run, bounds)):
                    dense = densify(clipped, SAMPLE_STEP_M)
                    if len(dense) < 2:
                        continue
                    sample_count += len(dense)
                    parts.append({
                        "id": properties.get("partId") or properties.get("osmId") or f"coast-{feature_index}-{part_index}-{split_index}-{run_index}",
                        "coords": [
                            [round(point[0] - origin[0], 2), 0.35, round(origin[1] - point[1], 2)]
                            for point in dense
                        ],
                    })

    payload = {
        "schema": "wenzhou_coastline_draped@1.1.2",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "crs": "EPSG:32651-local-centered",
        "sourceSha256": EXPECTED_SOURCE_SHA,
        "truthAoiClipped": True,
        "longDirectSourceSegmentsRemoved": True,
        "maximumAcceptedSourceSegmentMeters": MAX_SOURCE_SEGMENT_M,
        "maximumRetainedSourceSegmentMeters": round(maximum_retained_source_segment, 3),
        "maximumSampleSpacingMeters": SAMPLE_STEP_M,
        "sourcePartCount": source_parts,
        "sourceVertexCount": source_vertices,
        "droppedLongDirectSegmentCount": len(dropped_segments),
        "partCount": len(parts),
        "sampleCount": sample_count,
        "parts": parts,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    manifest["hydrology"]["coastlinePartCount"] = len(parts)
    manifest["hydrology"]["coastlineSampleCount"] = sample_count
    manifest["hydrology"]["coastlineMaximumAcceptedSourceSegmentMeters"] = MAX_SOURCE_SEGMENT_M
    manifest["hydrology"]["coastlineDroppedLongDirectSegmentCount"] = len(dropped_segments)
    for asset in manifest.get("assets", []):
        if asset.get("path") == "web/wenzhou-v111/assets/hires/coastline_truth_aoi_draped.json":
            asset["bytes"] = OUTPUT.stat().st_size
            asset["sha256"] = sha256_file(OUTPUT)
            asset["role"] = "coastline_truth_aoi_clipped_chord_filtered"
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "schema": "wenzhou_v111_coastline_chord_filter@1.1.2",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "passed": True,
        "sourceSha256": EXPECTED_SOURCE_SHA,
        "maximumAcceptedSourceSegmentMeters": MAX_SOURCE_SEGMENT_M,
        "maximumRetainedSourceSegmentMeters": round(maximum_retained_source_segment, 3),
        "droppedLongDirectSegmentCount": len(dropped_segments),
        "droppedLongDirectSegments": sorted(dropped_segments, key=lambda item: item["lengthMeters"], reverse=True)[:200],
        "partCount": len(parts),
        "sampleCount": sample_count,
        "outputBytes": OUTPUT.stat().st_size,
        "outputSha256": sha256_file(OUTPUT),
        "truthAoiClipped": True,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
