#!/usr/bin/env python3
"""Build lightweight, patch-scoped R3.5 OSM mapped-object display evidence.

Input is the permanently archived R3.5 OSM evidence ZIP. Output is a browser
bundle keyed to the 17 already-verified R3.4 terrain/view patches.

Semantic boundary:
- OSM highway LineStrings -> mapped centerline-style display evidence only.
- OSM building/building:part MultiPolygons -> source polygon boundary lines only.
- Building boundaries are clipped as lines; patch-edge closure is never generated.
- No road physical width, building height, levels, roof or material is invented.
- Output is external mapped observation, not canonical/survey-grade truth.
"""
from __future__ import annotations

import argparse
import array
import gzip
import hashlib
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform

SOURCE_RELEASE_TAG = "wenzhou-r3.5-osm-object-evidence-20260910"
SOURCE_RELEASE_ASSET = "Wenzhou_R3_5_OSM_Object_Evidence_20260910.zip"
SOURCE_RELEASE_ASSET_SHA256 = "f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101"
CORRECTED_REPORT_ASSET = "OSM_OBJECT_EVIDENCE_REPORT_CORRECTED.json"
CORRECTED_REPORT_SHA256 = "d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364"
ALLOWED_MAJOR = {
    "motorway", "motorway_link", "trunk", "trunk_link", "primary",
    "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link",
}
ROAD_CLASS_CODE = {
    "motorway": 1, "motorway_link": 2, "trunk": 3, "trunk_link": 4,
    "primary": 5, "primary_link": 6, "secondary": 7, "secondary_link": 8,
    "tertiary": 9, "tertiary_link": 10, "residential": 11,
    "unclassified": 12, "service": 13, "living_street": 14,
    "track": 15, "path": 16, "footway": 17, "cycleway": 18,
    "pedestrian": 19, "steps": 20, "construction": 21,
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_array(path: Path, typecode: str, values: Iterable[int]) -> dict[str, Any]:
    a = array.array(typecode, values)
    if sys.byteorder != "little":
        a.byteswap()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as f:
        a.tofile(f)
    return {
        "path": "./data/osm/" + path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def quantize_xy(x: float, y: float, bounds: list[float]) -> tuple[int, int]:
    minx, miny, maxx, maxy = bounds
    sx = max(maxx - minx, 1e-9)
    sy = max(maxy - miny, 1e-9)
    qx = int(round((x - minx) / sx * 65535.0))
    qy = int(round((y - miny) / sy * 65535.0))
    return max(0, min(65535, qx)), max(0, min(65535, qy))


def add_linestring(
    acc: dict[str, Any],
    coords: Iterable[tuple[float, float]],
    bounds: list[float],
    meta: tuple[int, int],
) -> None:
    pts = list(coords)
    if len(pts) < 2:
        return
    start = len(acc["xy"]) // 2
    for x, y in pts:
        qx, qy = quantize_xy(float(x), float(y), bounds)
        acc["xy"].extend((qx, qy))
    acc["parts"].extend((start, len(pts), int(meta[0]), int(meta[1])))
    acc["partCount"] += 1
    acc["vertexCount"] += len(pts)


def iter_line_components(geom: Any):
    if geom.is_empty:
        return
    if geom.geom_type == "LineString":
        yield geom
    elif geom.geom_type == "LinearRing":
        yield geom
    elif geom.geom_type == "MultiLineString":
        yield from geom.geoms
    elif geom.geom_type == "GeometryCollection":
        for g in geom.geoms:
            yield from iter_line_components(g)


def load_release(zip_path: Path, temp: Path) -> tuple[Path, Path]:
    if sha256_file(zip_path) != SOURCE_RELEASE_ASSET_SHA256:
        raise RuntimeError("source release ZIP SHA256 mismatch")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(temp)
    roads = temp / "WENZHOU_OSM_ROADS.geojsonseq.gz"
    buildings = temp / "WENZHOU_OSM_BUILDINGS.geojsonseq.gz"
    if not roads.is_file() or not buildings.is_file():
        raise RuntimeError("expected OSM evidence payload missing")
    return roads, buildings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--release-zip", type=Path, required=True)
    ap.add_argument("--patch-manifest", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--temp", type=Path, default=Path("/tmp/wenzhou-r35-bundle"))
    args = ap.parse_args()

    args.temp.mkdir(parents=True, exist_ok=True)
    roads_path, buildings_path = load_release(args.release_zip, args.temp)
    patch_manifest = json.loads(args.patch_manifest.read_text(encoding="utf-8"))
    patches = {p["id"]: p for p in patch_manifest["patches"]}
    if len(patches) != 17:
        raise RuntimeError(f"expected 17 inherited patches, got {len(patches)}")

    patch_boxes = {
        pid: box(*[float(v) for v in p["bounds"]]) for pid, p in patches.items()
    }
    road_acc = {
        pid: {
            "xy": [], "parts": [], "partCount": 0, "vertexCount": 0,
            "classes": Counter(),
        }
        for pid in patches
    }
    building_acc = {
        pid: {"xy": [], "parts": [], "partCount": 0, "vertexCount": 0}
        for pid in patches if pid != "overview"
    }
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:32651", always_xy=True)
    project = transformer.transform

    road_candidate_count = 0
    with gzip.open(roads_path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            feat = json.loads(line)
            props = feat.get("properties") or {}
            gobj = feat.get("geometry") or {}
            if gobj.get("type") != "LineString" or not props.get("highway"):
                continue
            highway = str(props["highway"])
            try:
                geom = transform(project, shape(gobj))
            except Exception:
                continue
            if geom.is_empty:
                continue
            road_candidate_count += 1
            class_code = ROAD_CLASS_CODE.get(highway, 255)
            flags = (
                (1 if props.get("bridge") not in (None, "", "no") else 0)
                | (2 if props.get("tunnel") not in (None, "", "no") else 0)
            )
            gx0, gy0, gx1, gy1 = geom.bounds
            for pid, pbox in patch_boxes.items():
                if pid == "overview" and highway not in ALLOWED_MAJOR:
                    continue
                px0, py0, px1, py1 = pbox.bounds
                if gx1 < px0 or gx0 > px1 or gy1 < py0 or gy0 > py1:
                    continue
                clipped = geom.intersection(pbox)
                for ls in iter_line_components(clipped):
                    add_linestring(
                        road_acc[pid], ls.coords, patches[pid]["bounds"],
                        (class_code, flags),
                    )
                    road_acc[pid]["classes"][highway] += 1

    building_candidate_count = 0
    building_identity_seen: set[tuple[str, str]] = set()
    with gzip.open(buildings_path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            feat = json.loads(line)
            props = feat.get("properties") or {}
            gobj = feat.get("geometry") or {}
            if gobj.get("type") != "MultiPolygon":
                continue
            key = (str(props.get("@type")), str(props.get("@id")))
            if key in building_identity_seen:
                continue
            building_identity_seen.add(key)
            building_candidate_count += 1
            try:
                polygon_geom = transform(project, shape(gobj))
            except Exception:
                continue
            if polygon_geom.is_empty:
                continue

            # IMPORTANT: clip the original polygon BOUNDARY as a line. Clipping
            # the polygon first and then asking for its boundary would create
            # synthetic closure segments along the patch rectangle. Those are
            # not OSM building edges and must never enter the evidence layer.
            boundary_geom = polygon_geom.boundary
            gx0, gy0, gx1, gy1 = boundary_geom.bounds
            for pid, pbox in patch_boxes.items():
                if pid == "overview":
                    continue
                px0, py0, px1, py1 = pbox.bounds
                if gx1 < px0 or gx0 > px1 or gy1 < py0 or gy0 > py1:
                    continue
                clipped_boundary = boundary_geom.intersection(pbox)
                for ls in iter_line_components(clipped_boundary):
                    add_linestring(
                        building_acc[pid], ls.coords, patches[pid]["bounds"],
                        (0, 0),
                    )

    args.out.mkdir(parents=True, exist_ok=True)
    patch_records: list[dict[str, Any]] = []
    total_bytes = 0
    for pid, p in patches.items():
        rb = road_acc[pid]
        road_xy = write_array(args.out / f"{pid}.roads.xy.u16le", "H", rb["xy"])
        road_parts = write_array(
            args.out / f"{pid}.roads.parts.u32le", "I", rb["parts"]
        )
        files: dict[str, Any] = {"roadXY": road_xy, "roadParts": road_parts}
        total_bytes += road_xy["bytes"] + road_parts["bytes"]

        building_meta = {"boundaryPartCount": 0, "vertexCount": 0}
        if pid != "overview":
            bb = building_acc[pid]
            building_xy = write_array(
                args.out / f"{pid}.buildings.xy.u16le", "H", bb["xy"]
            )
            building_parts = write_array(
                args.out / f"{pid}.buildings.parts.u32le", "I", bb["parts"]
            )
            files.update({
                "buildingXY": building_xy,
                "buildingParts": building_parts,
            })
            total_bytes += building_xy["bytes"] + building_parts["bytes"]
            building_meta = {
                "boundaryPartCount": bb["partCount"],
                "vertexCount": bb["vertexCount"],
            }

        minx, miny, maxx, maxy = [float(v) for v in p["bounds"]]
        patch_records.append({
            "id": pid,
            "bounds": [minx, miny, maxx, maxy],
            "quantization": {
                "type": "uint16-bounds-relative",
                "maxStepM": max((maxx-minx)/65535.0, (maxy-miny)/65535.0),
            },
            "roads": {
                "partCount": rb["partCount"],
                "vertexCount": rb["vertexCount"],
                "classPartCounts": dict(rb["classes"].most_common()),
                "physicalWidthKnown": False,
                "screenLineWidthOnly": True,
            },
            "buildings": {
                **building_meta,
                "sourceMultiPolygonBoundaryOnly": True,
                "clippingCreatesPatchClosure": False,
                "flatFootprintBoundaryOnly": True,
                "heightClaim": "unknown-not-generated",
            },
            "files": files,
        })

    manifest = {
        "schema": "wenzhou-r3.5-osm-browser-bundle/r2",
        "sourceReleaseTag": SOURCE_RELEASE_TAG,
        "sourceReleaseAsset": SOURCE_RELEASE_ASSET,
        "sourceReleaseAssetSha256": SOURCE_RELEASE_ASSET_SHA256,
        "sourceCorrectedReportAsset": CORRECTED_REPORT_ASSET,
        "sourceCorrectedReportSha256": CORRECTED_REPORT_SHA256,
        "sourceIdentity": "external_mapped_observation",
        "sourceCrs": "EPSG:4326",
        "displayCrs": "EPSG:32651",
        "canonicalTruth": False,
        "surveyGradeGeometry": False,
        "individualPhysicalTruth": False,
        "productionReady": False,
        "roadPolicy": (
            "Only explicit highway LineString geometry is used as mapped "
            "centerline-style display evidence. Rendered line width is screen "
            "styling, never physical road width."
        ),
        "buildingPolicy": (
            "Only unique OSM identities with MultiPolygon building/building:part "
            "geometry are eligible. The source polygon boundary is converted to "
            "line evidence before clipping, so patch boundaries never create "
            "synthetic closure edges. No height/levels/roof/material defaults are generated."
        ),
        "overviewPolicy": (
            "Overview excludes buildings and includes only motorway/trunk/primary/"
            "secondary/tertiary classes and links."
        ),
        "sourceCandidateCounts": {
            "roadLineStringHighway": road_candidate_count,
            "buildingMultiPolygonUniqueIdentity": building_candidate_count,
        },
        "patchCount": len(patch_records),
        "totalBytes": total_bytes,
        "patches": patch_records,
        "roadClassCodes": (
            {str(v): k for k, v in ROAD_CLASS_CODE.items()}
            | {"255": "other-explicit-highway"}
        ),
        "roadFlags": {
            "1": "bridge-tag-present-non-no",
            "2": "tunnel-tag-present-non-no",
        },
        "buildingPartMeta": {
            "0": "source-polygon-boundary-line-clipped-to-view-no-synthetic-patch-closure"
        },
    }
    write_json(args.out / "osm-context.json", manifest)

    errors: list[str] = []
    for rec in patch_records:
        for item in rec["files"].values():
            p = args.out / Path(item["path"]).name
            if p.stat().st_size != item["bytes"] or sha256_file(p) != item["sha256"]:
                errors.append(p.name)
    if errors:
        raise RuntimeError(f"bundle self-check failed: {errors}")
    if total_bytes > 48 * 1024 * 1024:
        raise RuntimeError(f"browser bundle too large: {total_bytes} bytes")
    if road_candidate_count != 177578:
        raise RuntimeError(f"road source candidate count changed: {road_candidate_count}")
    if building_candidate_count != 68359:
        raise RuntimeError(
            f"building source candidate count changed: {building_candidate_count}"
        )

    print(json.dumps({
        "passed": True,
        "schema": manifest["schema"],
        "patchCount": len(patch_records),
        "totalBytes": total_bytes,
        "roadSourceCandidates": road_candidate_count,
        "buildingSourceCandidates": building_candidate_count,
        "buildingBoundaryPolicy": "source-boundary-before-clip-no-synthetic-patch-closure",
        "patchSummary": [
            {
                "id": r["id"],
                "roadParts": r["roads"]["partCount"],
                "buildingBoundaryParts": r["buildings"]["boundaryPartCount"],
                "maxQuantizationStepM": r["quantization"]["maxStepM"],
            }
            for r in patch_records
        ],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
