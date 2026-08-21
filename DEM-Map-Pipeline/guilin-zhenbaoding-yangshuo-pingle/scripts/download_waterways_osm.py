from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_BOUNDS = (24.6152842480, 109.7724593260, 26.2980810697, 110.9051259163)
QUERY_TEMPLATE = """[out:json][timeout:180];
way[\"waterway\"]({south},{west},{north},{east});
out tags geom;"""


def load_overpass(input_path: Path | None, bounds: tuple[float, float, float, float]) -> dict:
    if input_path:
        return json.loads(input_path.read_text(encoding="utf-8"))
    south, west, north, east = bounds
    query = QUERY_TEMPLATE.format(south=south, west=west, north=north, east=east)
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    request = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=body,
        headers={"User-Agent": "Haihao-Guilin-DEM/1.1"},
    )
    with urllib.request.urlopen(request, timeout=240) as response:
        return json.load(response)


def simplify(points: list[list[float]], stride: int = 2) -> list[list[float]]:
    if len(points) <= 3:
        return points
    result = points[::stride]
    if result[-1] != points[-1]:
        result.append(points[-1])
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Download all mapped OSM waterways for the Guilin DEM footprint")
    parser.add_argument("--input", help="Optional saved Overpass JSON")
    parser.add_argument("--output", required=True)
    parser.add_argument("--south", type=float, default=DEFAULT_BOUNDS[0])
    parser.add_argument("--west", type=float, default=DEFAULT_BOUNDS[1])
    parser.add_argument("--north", type=float, default=DEFAULT_BOUNDS[2])
    parser.add_argument("--east", type=float, default=DEFAULT_BOUNDS[3])
    args = parser.parse_args()
    bounds = (args.south, args.west, args.north, args.east)
    payload = load_overpass(Path(args.input).resolve() if args.input else None, bounds)
    features = []
    for element in payload.get("elements", []):
        geometry = element.get("geometry") or []
        points = [[float(point["lon"]), float(point["lat"])] for point in geometry]
        if len(points) < 2:
            continue
        tags = element.get("tags") or {}
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "waterway": tags.get("waterway", "unknown"),
                    "name": tags.get("name"),
                    "nameZh": tags.get("name:zh"),
                    "osmType": element.get("type"),
                    "osmId": element.get("id"),
                    "source": "OpenStreetMap contributors via Overpass API",
                },
                "geometry": {"type": "LineString", "coordinates": simplify(points)},
            }
        )
    output = {
        "type": "FeatureCollection",
        "properties": {
            "name": "桂林全水系",
            "source": "OpenStreetMap contributors",
            "license": "ODbL 1.0",
            "queryBounds": [args.west, args.south, args.east, args.north],
            "labelPolicy": "地图只绘制水系线，不显示水系名称",
            "featureCount": len(features),
        },
        "features": features,
    }
    target = Path(args.output).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{target} ({len(features)} line features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
