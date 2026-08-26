from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from pyproj import Transformer

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

LI_RE = re.compile(r"(?:漓江|漓水|桂江|Li River|Li Jiang|Lijiang)", re.I)
XIANG_RE = re.compile(r"(?:湘江|湘水|Xiang River|Xiang Jiang|Xiangjiang)", re.I)


def query_overpass(query: str) -> dict:
    payload = urlencode({"data": query}).encode("utf-8")
    errors: list[str] = []
    for endpoint in ENDPOINTS:
        for attempt in range(3):
            try:
                request = Request(
                    endpoint,
                    data=payload,
                    headers={
                        "User-Agent": "GuilinDEM/0.7.1 (https://github.com/haihao0307/guilin-dem-pipeline)",
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                )
                with urlopen(request, timeout=240) as response:
                    return json.load(response)
            except Exception as exc:
                errors.append(f"{endpoint} attempt {attempt + 1}: {exc}")
                time.sleep(3 * (attempt + 1))
    raise RuntimeError("Overpass query failed: " + " | ".join(errors))


def classify(tags: dict) -> str:
    names = " | ".join(
        str(tags.get(key, ""))
        for key in ("name", "name:zh", "name:en", "alt_name", "official_name")
    )
    if LI_RE.search(names):
        return "li"
    if XIANG_RE.search(names):
        return "xiang"
    return "other"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.terrain_manifest.read_text(encoding="utf-8"))
    west, south, east, north = manifest["bounds_epsg32649"]
    to_wgs84 = Transformer.from_crs("EPSG:32649", "EPSG:4326", always_xy=True)
    lon0, lat0 = to_wgs84.transform(west, south)
    lon1, lat1 = to_wgs84.transform(east, north)
    bbox = (min(lat0, lat1), min(lon0, lon1), max(lat0, lat1), max(lon0, lon1))
    s, w, n, e = bbox

    query = f"""
[out:json][timeout:240];
(
  way[\"waterway\"=\"river\"]({s},{w},{n},{e});
  way[\"waterway\"=\"stream\"][\"name\"]({s},{w},{n},{e});
  way[\"waterway\"=\"canal\"][\"name\"]({s},{w},{n},{e});
);
out tags geom;
""".strip()

    payload = query_overpass(query)
    features: list[dict] = []
    counts = {"li": 0, "xiang": 0, "other": 0}
    for element in payload.get("elements", []):
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        tags = element.get("tags") or {}
        system = classify(tags)
        counts[system] += 1
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_type": element.get("type"),
                    "osm_id": element.get("id"),
                    "system": system,
                    "waterway": tags.get("waterway", ""),
                    "name": tags.get("name", ""),
                    "name_zh": tags.get("name:zh", ""),
                    "name_en": tags.get("name:en", ""),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[point["lon"], point["lat"]] for point in geometry],
                },
            }
        )

    result = {
        "type": "FeatureCollection",
        "name": "Guilin OSM hydrology first pass",
        "generated_from": "OpenStreetMap Overpass API",
        "osm_attribution": "© OpenStreetMap contributors",
        "query_bbox_wgs84": [w, s, e, n],
        "feature_counts": counts,
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"feature_counts": counts, "total": len(features)}, ensure_ascii=False))
    if counts["li"] == 0 or counts["xiang"] == 0:
        print("WARNING: one named main river system has zero exact-name OSM ways; generic OSM rivers remain available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
