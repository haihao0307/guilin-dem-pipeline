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
NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


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
                        "User-Agent": "GuilinDEM/0.7.2 (https://github.com/haihao0307/guilin-dem-pipeline)",
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


def parse_width(tags: dict, system: str) -> tuple[float, str]:
    for key in ("width", "est_width"):
        raw = str(tags.get(key, "")).strip()
        match = NUMBER_RE.search(raw)
        if match:
            value = float(match.group(0))
            if 1.0 <= value <= 2000.0:
                return value, key

    waterway = str(tags.get("waterway", "river"))
    if system == "li":
        return (180.0 if waterway == "river" else 38.0), "system-default"
    if system == "xiang":
        return (150.0 if waterway == "river" else 34.0), "system-default"
    defaults = {
        "river": 58.0,
        "stream": 18.0,
        "canal": 28.0,
        "drain": 10.0,
        "ditch": 7.0,
    }
    return defaults.get(waterway, 20.0), "waterway-default"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--terrain-manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.terrain_manifest.read_text(encoding="utf-8"))
    west, south, east, north = manifest["bounds_epsg32649"]
    to_wgs84 = Transformer.from_crs("EPSG:32649", "EPSG:4326", always_xy=True)
    corners = [
        to_wgs84.transform(west, south),
        to_wgs84.transform(east, south),
        to_wgs84.transform(east, north),
        to_wgs84.transform(west, north),
    ]
    lons = [point[0] for point in corners]
    lats = [point[1] for point in corners]
    s, w, n, e = min(lats), min(lons), max(lats), max(lons)

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
    widths: dict[str, list[float]] = {"li": [], "xiang": [], "other": []}

    for element in payload.get("elements", []):
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        tags = element.get("tags") or {}
        system = classify(tags)
        base_width_m, width_source = parse_width(tags, system)
        counts[system] += 1
        widths[system].append(base_width_m)
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
                    "base_width_m": base_width_m,
                    "width_source": width_source,
                    "intermittent": tags.get("intermittent", ""),
                    "seasonal": tags.get("seasonal", ""),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[point["lon"], point["lat"]] for point in geometry],
                },
            }
        )

    width_summary = {
        key: {
            "minimum_m": min(values) if values else 0.0,
            "maximum_m": max(values) if values else 0.0,
            "mean_m": sum(values) / len(values) if values else 0.0,
        }
        for key, values in widths.items()
    }

    result = {
        "type": "FeatureCollection",
        "name": "Guilin OSM hydrology river-ribbon source",
        "generated_from": "OpenStreetMap Overpass API",
        "osm_attribution": "© OpenStreetMap contributors",
        "query_bbox_wgs84": [w, s, e, n],
        "feature_counts": counts,
        "base_width_summary": width_summary,
        "centerline_policy": "OSM coordinates immutable; display width is derived separately",
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "feature_counts": counts,
        "total": len(features),
        "base_width_summary": width_summary,
    }, ensure_ascii=False))
    if counts["li"] == 0 or counts["xiang"] == 0:
        print("WARNING: one named main river system has zero exact-name OSM ways; generic OSM rivers remain available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
