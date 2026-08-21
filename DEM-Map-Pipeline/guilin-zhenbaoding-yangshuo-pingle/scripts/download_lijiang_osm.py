from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path


QUERY = '''[out:json][timeout:60];
way["waterway"="river"]["name"="漓江"](24.50,109.65,26.55,111.30);
out geom;'''


def load_overpass(input_path: Path | None) -> dict:
    if input_path:
        return json.loads(input_path.read_text(encoding="utf-8"))
    body = urllib.parse.urlencode({"data": QUERY}).encode("utf-8")
    request = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=body,
        headers={"User-Agent": "Haihao-Guilin-DEM/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def simplify(points: list[list[float]], stride: int = 3) -> list[list[float]]:
    if len(points) <= 3:
        return points
    result = points[::stride]
    if result[-1] != points[-1]:
        result.append(points[-1])
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    payload = load_overpass(Path(args.input).resolve() if args.input else None)
    features = []
    for element in payload.get("elements", []):
        geometry = element.get("geometry") or []
        points = [[float(point["lon"]), float(point["lat"])] for point in geometry]
        if len(points) < 2:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "name": "漓江",
                "osmType": element.get("type"),
                "osmId": element.get("id"),
                "source": "OpenStreetMap contributors via Overpass API",
            },
            "geometry": {"type": "LineString", "coordinates": simplify(points)},
        })
    output = {
        "type": "FeatureCollection",
        "properties": {
            "name": "漓江",
            "source": "OpenStreetMap contributors",
            "license": "ODbL 1.0",
        },
        "features": features,
    }
    target = Path(args.output).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{target} ({len(features)} line features)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
