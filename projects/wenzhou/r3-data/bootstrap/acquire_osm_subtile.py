#!/usr/bin/env python3
"""Acquire one adaptive OSM subtile for a failed Wenzhou R3 source tile.

Geometry selectors use ``out geom``. Sea-label objects use ``out center`` so a
large regional relation cannot force a huge geometry response. The exact
queries and every raw response are retained and hashed.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

WGS84_BOUNDS = [119.53652775317141, 26.768974131802604, 122.92078622479278, 29.675418483082204]
TILE_SPLITS = 4
SUB_SPLITS = 2
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tile_bounds(tile_index: int) -> tuple[int, int, list[float]]:
    if tile_index < 0 or tile_index >= TILE_SPLITS * TILE_SPLITS:
        raise ValueError("tile index out of range")
    row, col = divmod(tile_index, TILE_SPLITS)
    west, south, east, north = WGS84_BOUNDS
    dx = (east - west) / TILE_SPLITS
    dy = (north - south) / TILE_SPLITS
    return row, col, [west + col * dx, south + row * dy, west + (col + 1) * dx, south + (row + 1) * dy]


def subtile_bounds(tile_index: int, sub_index: int) -> tuple[str, str, list[float]]:
    if sub_index < 0 or sub_index >= SUB_SPLITS * SUB_SPLITS:
        raise ValueError("sub-index must be 0..3")
    row, col, bounds = tile_bounds(tile_index)
    sr, sc = divmod(sub_index, SUB_SPLITS)
    west, south, east, north = bounds
    dx = (east - west) / SUB_SPLITS
    dy = (north - south) / SUB_SPLITS
    return f"r{row}_c{col}", f"sr{sr}_sc{sc}", [west + sc * dx, south + sr * dy, west + (sc + 1) * dx, south + (sr + 1) * dy]


def geometry_query(bounds: list[float]) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.10f},{west:.10f},{north:.10f},{east:.10f}"
    return f'''[out:json][timeout:240][maxsize:1073741824];
(
  nwr["waterway"]({bbox});
  nwr["natural"="coastline"]({bbox});
  nwr["natural"="water"]({bbox});
  nwr["water"]({bbox});
  nwr["waterway"="riverbank"]({bbox});
  nwr["landuse"="reservoir"]({bbox});
  nwr["landuse"="basin"]({bbox});
  nwr["natural"="wetland"]({bbox});
  nwr["natural"="bay"]({bbox});
);
out geom qt;
'''


def label_query(bounds: list[float]) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.10f},{west:.10f},{north:.10f},{east:.10f}"
    return f'''[out:json][timeout:180][maxsize:268435456];
(
  nwr["place"="sea"]({bbox});
);
out center qt;
'''


def request_query(session: requests.Session, query: str, seed: int, attempts: list[dict[str, Any]], role: str) -> tuple[dict[str, Any], bytes, str]:
    start = seed % len(ENDPOINTS)
    for attempt in range(1, 8):
        endpoint = ENDPOINTS[(start + attempt - 1) % len(ENDPOINTS)]
        t0 = time.monotonic()
        try:
            response = session.post(endpoint, data={"data": query}, timeout=(30, 270))
            duration = time.monotonic() - t0
            rec: dict[str, Any] = {
                "role": role,
                "attempt": attempt,
                "endpoint": endpoint,
                "httpStatus": response.status_code,
                "durationSeconds": duration,
                "responseBytes": len(response.content),
                "contentType": response.headers.get("content-type"),
            }
            if response.status_code == 200:
                candidate = response.json()
                if isinstance(candidate, dict) and isinstance(candidate.get("elements"), list):
                    rec["validOverpassJson"] = True
                    attempts.append(rec)
                    return candidate, response.content, endpoint
                rec["validOverpassJson"] = False
            else:
                rec["bodyPrefix"] = response.text[:240]
            attempts.append(rec)
        except Exception as exc:
            attempts.append({
                "role": role,
                "attempt": attempt,
                "endpoint": endpoint,
                "durationSeconds": time.monotonic() - t0,
                "error": f"{type(exc).__name__}: {exc}",
            })
        time.sleep(min(24, 2 + attempt * 3) + random.random())
    raise RuntimeError(f"all Overpass endpoints failed for {role}")


def write_gzip(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(filename=str(path), mode="wb", compresslevel=9, mtime=0) as handle:
        handle.write(payload)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tile", type=int, required=True)
    ap.add_argument("--sub-index", type=int, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    tile_id, sub_id, bounds = subtile_bounds(args.tile, args.sub_index)
    root = args.output / f"OSM_TILE_{tile_id}" / "SUBTILES" / sub_id
    raw = root / "RAW_OVERPASS"
    raw.mkdir(parents=True, exist_ok=True)
    gq = geometry_query(bounds)
    lq = label_query(bounds)
    (raw / f"{sub_id}.geometry.query.overpassql").write_text(gq, encoding="utf-8")
    (raw / f"{sub_id}.labels.query.overpassql").write_text(lq, encoding="utf-8")

    session = requests.Session()
    session.headers.update({"User-Agent": "WenzhouWorldTruthR3/1.1 (source-audit pipeline; GitHub Actions)"})
    attempts: list[dict[str, Any]] = []
    passed = False
    selected: dict[str, str] = {}
    outputs: dict[str, Any] = {}
    error: str | None = None
    try:
        geom_doc, geom_bytes, geom_endpoint = request_query(session, gq, args.tile * 19 + args.sub_index, attempts, "geometry")
        label_doc, label_bytes, label_endpoint = request_query(session, lq, args.tile * 23 + args.sub_index + 1, attempts, "sea_labels")
        selected = {"geometry": geom_endpoint, "seaLabels": label_endpoint}
        for role, doc, payload in (("geometry", geom_doc, geom_bytes), ("labels", label_doc, label_bytes)):
            path = raw / f"{sub_id}.{role}.json.gz"
            write_gzip(path, payload)
            outputs[role] = {
                "path": path.relative_to(root).as_posix(),
                "elementCount": len(doc.get("elements", [])),
                "rawUncompressedBytes": len(payload),
                "rawUncompressedSha256": sha256(payload),
                "rawCompressedBytes": path.stat().st_size,
                "rawCompressedSha256": sha256_file(path),
                "osmGenerator": doc.get("generator"),
                "osmBaseTimestamp": doc.get("osm3s", {}).get("timestamp_osm_base"),
            }
        passed = True
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

    receipt = {
        "schema": "wenzhou-osm-overpass-subtile/r3.1",
        "parentTileIndex": args.tile,
        "parentTileId": tile_id,
        "subIndex": args.sub_index,
        "subtileId": sub_id,
        "boundsWgs84": bounds,
        "geometryQuerySha256": sha256(gq.encode("utf-8")),
        "labelQuerySha256": sha256(lq.encode("utf-8")),
        "retrievedAtUtc": now_z(),
        "selectedEndpoints": selected,
        "attempts": attempts,
        "outputs": outputs,
        "passed": passed,
        "fallbackUsed": False,
        "license": "ODbL 1.0",
        "attribution": "© OpenStreetMap contributors",
        "error": error,
    }
    (root / "SUBTILE_RECEIPT.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
