#!/usr/bin/env python3
from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

SOURCE_MANIFEST_SCHEMA = "wenzhou-r3.5-osm-browser-bundle/r2"
DEFAULT_TOLERANCES_M = (5.0, 20.0, 80.0, 200.0)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_array(path: Path, typecode: str) -> array.array:
    a = array.array(typecode)
    with path.open("rb") as f:
        a.fromfile(f, path.stat().st_size // a.itemsize)
    if sys.byteorder != "little":
        a.byteswap()
    return a


def write_array(path: Path, typecode: str, values) -> dict:
    a = array.array(typecode, values)
    if sys.byteorder != "little":
        a.byteswap()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        a.tofile(f)
    return {"path": path.name, "bytes": path.stat().st_size, "sha256": sha256_file(path)}


def point_segment_distance_sq(px, py, ax, ay, bx, by) -> float:
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    if denom <= 1e-18:
        return wx * wx + wy * wy
    t = (wx * vx + wy * vy) / denom
    if t <= 0.0:
        dx, dy = px - ax, py - ay
    elif t >= 1.0:
        dx, dy = px - bx, py - by
    else:
        qx, qy = ax + t * vx, ay + t * vy
        dx, dy = px - qx, py - qy
    return dx * dx + dy * dy


def metric_xy(xy: array.array, vertex_index: int, west: float, south: float, sx: float, sy: float):
    i = vertex_index * 2
    return west + xy[i] * sx, south + xy[i + 1] * sy


def dp_interval(xy, start, end, tolerance_sq, west, south, sx, sy, keep: set[int]):
    if end <= start + 1:
        return
    stack = [(start, end)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = metric_xy(xy, a, west, south, sx, sy)
        bx, by = metric_xy(xy, b, west, south, sx, sy)
        max_d2 = -1.0
        max_i = -1
        for i in range(a + 1, b):
            px, py = metric_xy(xy, i, west, south, sx, sy)
            d2 = point_segment_distance_sq(px, py, ax, ay, bx, by)
            if d2 > max_d2:
                max_d2, max_i = d2, i
        if max_d2 > tolerance_sq:
            keep.add(max_i)
            stack.append((a, max_i))
            stack.append((max_i, b))


def verify_interval_error(xy, kept, west, south, sx, sy) -> float:
    max_d2 = 0.0
    for ka, kb in zip(kept, kept[1:]):
        ax, ay = metric_xy(xy, ka, west, south, sx, sy)
        bx, by = metric_xy(xy, kb, west, south, sx, sy)
        for i in range(ka + 1, kb):
            px, py = metric_xy(xy, i, west, south, sx, sy)
            max_d2 = max(max_d2, point_segment_distance_sq(px, py, ax, ay, bx, by))
    return math.sqrt(max_d2)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tolerances-m", nargs="*", type=float, default=list(DEFAULT_TOLERANCES_M))
    args = ap.parse_args()

    manifest_path = args.osm_dir / "osm-context.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != SOURCE_MANIFEST_SCHEMA:
        raise RuntimeError(f"unexpected source schema: {manifest.get('schema')}")
    if any(manifest.get(k) is not False for k in ("canonicalTruth", "surveyGradeGeometry", "individualPhysicalTruth", "productionReady")):
        raise RuntimeError("R3.5 source truth boundary changed")
    overview = next((p for p in manifest["patches"] if p["id"] == "overview"), None)
    if not overview:
        raise RuntimeError("overview patch missing")
    if overview["buildings"]["boundaryPartCount"] != 0:
        raise RuntimeError("overview must remain road-only")

    xy_path = args.osm_dir / Path(overview["files"]["roadXY"]["path"]).name
    parts_path = args.osm_dir / Path(overview["files"]["roadParts"]["path"]).name
    if sha256_file(xy_path) != overview["files"]["roadXY"]["sha256"]:
        raise RuntimeError("source overview road XY SHA mismatch")
    if sha256_file(parts_path) != overview["files"]["roadParts"]["sha256"]:
        raise RuntimeError("source overview road parts SHA mismatch")

    xy = read_array(xy_path, "H")
    parts = read_array(parts_path, "I")
    if len(xy) % 2 or len(parts) % 4:
        raise RuntimeError("source binary shape mismatch")
    source_vertex_count = len(xy) // 2
    if source_vertex_count != overview["roads"]["vertexCount"]:
        raise RuntimeError("source vertex count mismatch")
    if len(parts) // 4 != overview["roads"]["partCount"]:
        raise RuntimeError("source part count mismatch")

    bounds = [float(v) for v in overview["bounds"]]
    west, south, east, north = bounds
    sx = (east - west) / 65535.0
    sy = (north - south) / 65535.0

    # Count each quantized coordinate at most once per road part. A position shared
    # by multiple parts is treated as a topological junction and must survive every level.
    part_occurrence = Counter()
    source_segments = 0
    for p in range(0, len(parts), 4):
        start, count = int(parts[p]), int(parts[p + 1])
        if count < 2 or start < 0 or start + count > source_vertex_count:
            raise RuntimeError(f"invalid source part at {p // 4}: start={start} count={count}")
        source_segments += count - 1
        seen = set()
        for vi in range(start, start + count):
            key = (int(xy[vi * 2]), int(xy[vi * 2 + 1]))
            seen.add(key)
        for key in seen:
            part_occurrence[key] += 1
    junction_keys = {key for key, n in part_occurrence.items() if n > 1}

    args.out.mkdir(parents=True, exist_ok=True)
    levels = []
    for tolerance in sorted(set(float(t) for t in args.tolerances_m)):
        if not math.isfinite(tolerance) or tolerance <= 0:
            raise RuntimeError(f"invalid tolerance {tolerance}")
        tol2 = tolerance * tolerance
        out_xy = []
        out_parts = []
        max_error = 0.0
        retained_forced_occurrences = 0
        source_forced_occurrences = 0
        retained_endpoints = 0
        out_segments = 0

        for p in range(0, len(parts), 4):
            start, count, code, flags = map(int, parts[p:p + 4])
            local_forced = [0, count - 1]
            for j in range(1, count - 1):
                vi = start + j
                key = (int(xy[vi * 2]), int(xy[vi * 2 + 1]))
                if key in junction_keys:
                    local_forced.append(j)
                    source_forced_occurrences += 1
            local_forced = sorted(set(local_forced))
            keep_local = set(local_forced)
            for a_local, b_local in zip(local_forced, local_forced[1:]):
                dp_interval(xy, start + a_local, start + b_local, tol2, west, south, sx, sy, keep_local_global := set())
                for gi in keep_local_global:
                    keep_local.add(gi - start)
            kept_local = sorted(keep_local)
            if kept_local[0] != 0 or kept_local[-1] != count - 1:
                raise RuntimeError("endpoint preservation failed")
            retained_endpoints += 2
            retained_forced_occurrences += sum(1 for j in local_forced[1:-1] if j in keep_local)
            kept_global = [start + j for j in kept_local]
            max_error = max(max_error, verify_interval_error(xy, kept_global, west, south, sx, sy))
            out_start = len(out_xy) // 2
            for vi in kept_global:
                out_xy.extend((int(xy[vi * 2]), int(xy[vi * 2 + 1])))
            out_parts.extend((out_start, len(kept_global), code, flags))
            out_segments += len(kept_global) - 1

        if max_error > tolerance + 1e-6:
            raise RuntimeError(f"measured error {max_error} exceeds tolerance {tolerance}")
        if retained_forced_occurrences != source_forced_occurrences:
            raise RuntimeError("junction preservation failed")
        if len(out_parts) != len(parts):
            raise RuntimeError("part metadata cardinality changed")
        out_vertex_count = len(out_xy) // 2
        label = (str(int(tolerance)) if tolerance.is_integer() else str(tolerance).replace('.', 'p')) + "m"
        xy_meta = write_array(args.out / f"overview.roads.{label}.xy.u16le", "H", out_xy)
        parts_meta = write_array(args.out / f"overview.roads.{label}.parts.u32le", "I", out_parts)
        levels.append({
            "id": label,
            "toleranceM": tolerance,
            "measuredMaxPlanarDeviationM": max_error,
            "partCount": len(out_parts) // 4,
            "vertexCount": out_vertex_count,
            "segmentCount": out_segments,
            "vertexRetentionRatio": out_vertex_count / source_vertex_count,
            "segmentRetentionRatio": out_segments / source_segments,
            "junctionPositionsPreserved": len(junction_keys),
            "junctionOccurrencesPreserved": retained_forced_occurrences,
            "endpointOccurrencesPreserved": retained_endpoints,
            "coordinatesInvented": False,
            "files": {"roadXY": xy_meta, "roadParts": parts_meta},
        })

    report = {
        "schema": "wenzhou-r3.7-multiscale-road-conductor-experiment/r1",
        "sourceManifestSchema": manifest["schema"],
        "sourceManifestSha256": sha256_file(manifest_path),
        "sourceReleaseAssetSha256": manifest["sourceReleaseAssetSha256"],
        "sourceCorrectedReportSha256": manifest["sourceCorrectedReportSha256"],
        "sourcePatch": "overview",
        "sourceBounds": bounds,
        "sourceQuantizationMaxStepM": overview["quantization"]["maxStepM"],
        "sourcePartCount": len(parts) // 4,
        "sourceVertexCount": source_vertex_count,
        "sourceSegmentCount": source_segments,
        "junctionPositionCount": len(junction_keys),
        "algorithm": "topology-forced Douglas-Peucker over original quantized vertices only",
        "semanticBoundary": {
            "canonicalTruth": False,
            "surveyGradeGeometry": False,
            "individualPhysicalTruth": False,
            "productionReady": False,
            "displayConductorOnly": True,
            "exactSourceRemainsAuthoritative": True,
            "coordinatesInvented": False,
            "endpointsForced": True,
            "crossPartSharedPositionsForced": True,
        },
        "levels": levels,
    }
    report_path = args.out / "multiscale-overview-roads-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "passed": True,
        "sourceVertexCount": source_vertex_count,
        "sourceSegmentCount": source_segments,
        "junctionPositionCount": len(junction_keys),
        "levels": [{k: level[k] for k in ("id", "toleranceM", "measuredMaxPlanarDeviationM", "vertexCount", "segmentCount", "vertexRetentionRatio", "segmentRetentionRatio")} for level in levels],
        "reportSha256": sha256_file(report_path),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
