#!/usr/bin/env python3
"""Acquire one immutable OSM Overpass source tile for Wenzhou R3.

The script writes the exact query, gzipped JSON response, and a receipt with
payload hashes. It never substitutes an earlier OSM extract.
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
SPLITS = 4
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def now_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def bounds_for(index: int) -> tuple[int, int, list[float]]:
    if index < 0 or index >= SPLITS * SPLITS:
        raise ValueError(f"tile index must be 0..{SPLITS*SPLITS-1}")
    row, col = divmod(index, SPLITS)
    west, south, east, north = WGS84_BOUNDS
    dx = (east - west) / SPLITS
    dy = (north - south) / SPLITS
    return row, col, [west + col * dx, south + row * dy, west + (col + 1) * dx, south + (row + 1) * dy]


def query_for(bounds: list[float]) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
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
  nwr["place"="sea"]({bbox});
);
out geom qt;
'''


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tile", type=int, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    row, col, bounds = bounds_for(args.tile)
    tile_id = f"r{row}_c{col}"
    root = args.output / f"OSM_TILE_{tile_id}"
    raw_dir = root / "RAW_OVERPASS"
    raw_dir.mkdir(parents=True, exist_ok=True)
    query = query_for(bounds)
    query_path = raw_dir / f"{tile_id}.query.overpassql"
    query_path.write_text(query, encoding="utf-8")

    session = requests.Session()
    session.headers.update({"User-Agent": "WenzhouWorldTruthR3/1.1 (source-audit pipeline; GitHub Actions)"})
    attempts: list[dict[str, Any]] = []
    response_bytes: bytes | None = None
    payload: dict[str, Any] | None = None
    selected_endpoint: str | None = None
    start = args.tile % len(ENDPOINTS)

    for attempt in range(1, 7):
        endpoint = ENDPOINTS[(start + attempt - 1) % len(ENDPOINTS)]
        t0 = time.monotonic()
        try:
            response = session.post(endpoint, data={"data": query}, timeout=(30, 270))
            duration = time.monotonic() - t0
            rec: dict[str, Any] = {
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
                    payload = candidate
                    response_bytes = response.content
                    selected_endpoint = endpoint
                    rec["validOverpassJson"] = True
                    attempts.append(rec)
                    break
                rec["validOverpassJson"] = False
            else:
                rec["bodyPrefix"] = response.text[:240]
            attempts.append(rec)
        except Exception as exc:
            attempts.append({
                "attempt": attempt,
                "endpoint": endpoint,
                "durationSeconds": time.monotonic() - t0,
                "error": f"{type(exc).__name__}: {exc}",
            })
        time.sleep(min(20, 2 + attempt * 3) + random.random())

    status = {
        "schema": "wenzhou-osm-overpass-tile/r3.1",
        "tileIndex": args.tile,
        "tileId": tile_id,
        "row": row,
        "column": col,
        "boundsWgs84": bounds,
        "querySha256": sha256(query.encode("utf-8")),
        "retrievedAtUtc": now_z(),
        "selectedEndpoint": selected_endpoint,
        "attempts": attempts,
        "passed": payload is not None and response_bytes is not None,
        "fallbackUsed": False,
        "license": "ODbL 1.0",
        "attribution": "© OpenStreetMap contributors",
    }

    if payload is not None and response_bytes is not None:
        raw_path = raw_dir / f"{tile_id}.json.gz"
        with gzip.GzipFile(filename=str(raw_path), mode="wb", compresslevel=9, mtime=0) as f:
            f.write(response_bytes)
        status.update({
            "rawUncompressedBytes": len(response_bytes),
            "rawUncompressedSha256": sha256(response_bytes),
            "rawCompressedBytes": raw_path.stat().st_size,
            "rawCompressedSha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
            "elementCount": len(payload.get("elements", [])),
            "osmGenerator": payload.get("generator"),
            "osmBaseTimestamp": payload.get("osm3s", {}).get("timestamp_osm_base"),
        })
    write_json(root / "TILE_RECEIPT.json", status)
    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0 if status["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
