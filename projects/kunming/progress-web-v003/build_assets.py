#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, math, re
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from scipy.ndimage import gaussian_filter, uniform_filter, label
from pyproj import Transformer

EXPECTED_SHA256 = "9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2"
EXPECTED_CRS = "EPSG:32648"
EXPECTED_GRID = (5892, 8095)
EXPECTED_RES = (12.5, 12.5)
EXPECTED_BOUNDS = (243875.0, 2719987.5, 317525.0, 2821175.0)
SOURCE_BASELINE_SHA256 = "af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def require_close(a: float, b: float, tol: float = 1e-6) -> None:
    if abs(a - b) > tol:
        raise RuntimeError(f"value mismatch: {a} != {b}")


def normalize_rg16(z: np.ndarray, zmin: float, zmax: float) -> np.ndarray:
    norm = np.clip((z - zmin) / (zmax - zmin), 0.0, 1.0)
    q = np.round(norm * 65535.0).astype(np.uint16)
    out = np.zeros((z.shape[0], z.shape[1], 3), dtype=np.uint8)
    out[..., 0] = (q >> 8).astype(np.uint8)
    out[..., 1] = (q & 255).astype(np.uint8)
    return out


def multistop_palette(t: np.ndarray) -> np.ndarray:
    stops = [
        (0.00, np.array([0.12, 0.30, 0.18], np.float32)),
        (0.18, np.array([0.28, 0.48, 0.22], np.float32)),
        (0.38, np.array([0.53, 0.59, 0.27], np.float32)),
        (0.58, np.array([0.68, 0.56, 0.32], np.float32)),
        (0.76, np.array([0.62, 0.55, 0.49], np.float32)),
        (0.90, np.array([0.76, 0.74, 0.70], np.float32)),
        (1.00, np.array([0.96, 0.96, 0.95], np.float32)),
    ]
    out = np.empty(t.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (t >= a) & (t <= b)
        if not np.any(m):
            continue
        f = (t[m] - a) / (b - a)
        out[m] = ca + (cb - ca) * f[:, None]
    return out


def make_surface(z: np.ndarray, px: float, py: float, seed: int = 20260826) -> np.ndarray:
    z = z.astype(np.float32, copy=False)
    zmin, zmax = float(np.nanmin(z)), float(np.nanmax(z))
    t = np.clip((z - zmin) / (zmax - zmin), 0.0, 1.0)
    gx = np.gradient(z, axis=1) / px
    gy = np.gradient(z, axis=0) / py
    slope = np.arctan(np.hypot(gx, gy))
    slope_n = np.clip(slope / math.radians(42.0), 0.0, 1.0)
    aspect = np.arctan2(-gx, gy)

    def hillshade(azimuth: float, altitude: float) -> np.ndarray:
        az = math.radians(360.0 - azimuth + 90.0)
        alt = math.radians(altitude)
        hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
        return np.clip(hs, 0.0, 1.0)

    hs = 0.56 * hillshade(315, 43) + 0.24 * hillshade(45, 35) + 0.20 * hillshade(225, 28)
    hs = np.clip(hs, 0.0, 1.0)

    local = z - gaussian_filter(z, sigma=7.0)
    macro = z - gaussian_filter(z, sigma=42.0)
    valley = np.clip((-macro - np.percentile(-macro, 42)) / (np.percentile(-macro, 98) - np.percentile(-macro, 42) + 1e-6), 0.0, 1.0)
    ridge = np.clip((local - np.percentile(local, 62)) / (np.percentile(local, 99) - np.percentile(local, 62) + 1e-6), 0.0, 1.0)

    rng = np.random.default_rng(seed)
    small = rng.random((max(32, z.shape[0] // 64), max(32, z.shape[1] // 64)), dtype=np.float32)
    noise_img = Image.fromarray(np.round(small * 255).astype(np.uint8), mode="L").resize((z.shape[1], z.shape[0]), Image.Resampling.BICUBIC)
    noise = np.asarray(noise_img, np.float32) / 255.0
    noise = gaussian_filter(noise, sigma=2.0)

    col = multistop_palette(t)
    green = np.array([0.10, 0.36, 0.16], np.float32)
    deep_green = np.array([0.07, 0.27, 0.13], np.float32)
    warm_rock = np.array([0.47, 0.34, 0.23], np.float32)
    cool_rock = np.array([0.48, 0.48, 0.46], np.float32)
    pale = np.array([0.89, 0.88, 0.85], np.float32)

    vegetation = np.clip((1.0 - slope_n) * (1.0 - np.clip((t - 0.70) / 0.30, 0.0, 1.0)) * (0.42 + 0.58 * valley), 0.0, 1.0)
    rock = np.clip(slope_n * 0.82 + ridge * 0.44 + np.clip((t - 0.72) / 0.28, 0.0, 1.0) * 0.42, 0.0, 1.0)
    northness = np.clip((np.cos(aspect) + 1.0) * 0.5, 0.0, 1.0)
    wet = np.clip(valley * (1.0 - slope_n) * 1.16, 0.0, 1.0)

    col = col * (1.0 - vegetation[..., None] * 0.32) + green * (vegetation[..., None] * 0.32)
    col = col * (1.0 - wet[..., None] * 0.22) + deep_green * (wet[..., None] * 0.22)
    rock_col = warm_rock * (0.62 + 0.38 * (1.0 - northness[..., None])) + cool_rock * (0.38 * northness[..., None])
    col = col * (1.0 - rock[..., None] * 0.43) + rock_col * (rock[..., None] * 0.43)
    snow = np.clip((t - 0.84) / 0.16, 0.0, 1.0) * np.clip((1.0 - slope_n * 0.55), 0.0, 1.0)
    col = col * (1.0 - snow[..., None] * 0.56) + pale * (snow[..., None] * 0.56)

    variation = (noise - 0.5) * 0.18 + (ridge - 0.5) * 0.08
    col *= (1.0 + variation[..., None])
    col *= (0.52 + 0.62 * hs[..., None])
    col = np.clip(np.power(col, 0.92), 0.0, 1.0)
    return np.round(col * 255.0).astype(np.uint8)


def parse_width(tags: dict[str, Any], kind: str) -> float:
    val = tags.get("width")
    if isinstance(val, str):
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)", val)
        if m:
            try:
                return max(1.0, min(5000.0, float(m.group(1))))
            except ValueError:
                pass
    return {"river": 42.0, "canal": 28.0, "stream": 10.0}.get(kind, 12.0)


def rdp(points: list[list[float]], epsilon: float) -> list[list[float]]:
    if len(points) < 3:
        return points
    x1, y1 = points[0]
    x2, y2 = points[-1]
    dx, dy = x2 - x1, y2 - y1
    denom = math.hypot(dx, dy)
    max_dist, idx = -1.0, -1
    for i, (x, y) in enumerate(points[1:-1], start=1):
        d = math.hypot(x - x1, y - y1) if denom == 0 else abs(dy * x - dx * y + x2 * y1 - y2 * x1) / denom
        if d > max_dist:
            max_dist, idx = d, i
    if max_dist > epsilon:
        left = rdp(points[: idx + 1], epsilon)
        right = rdp(points[idx:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def join_segments(segments: list[list[list[float]]], tolerance: float = 1e-7) -> list[list[list[float]]]:
    remaining = [s[:] for s in segments if len(s) >= 2]
    loops: list[list[list[float]]] = []
    def near(a: list[float], b: list[float]) -> bool:
        return abs(a[0] - b[0]) <= tolerance and abs(a[1] - b[1]) <= tolerance
    while remaining:
        chain = remaining.pop(0)
        changed = True
        while changed and remaining:
            changed = False
            for i, seg in enumerate(remaining):
                if near(chain[-1], seg[0]):
                    chain.extend(seg[1:]); remaining.pop(i); changed = True; break
                if near(chain[-1], seg[-1]):
                    chain.extend(list(reversed(seg[:-1]))); remaining.pop(i); changed = True; break
                if near(chain[0], seg[-1]):
                    chain = seg[:-1] + chain; remaining.pop(i); changed = True; break
                if near(chain[0], seg[0]):
                    chain = list(reversed(seg[1:])) + chain; remaining.pop(i); changed = True; break
        loops.append(chain)
    return loops


def parse_osm(osm_path: Path, bounds: tuple[float, float, float, float]) -> dict[str, Any]:
    raw = json.loads(osm_path.read_text(encoding="utf-8"))
    transformer = Transformer.from_crs("EPSG:4326", EXPECTED_CRS, always_xy=True)
    left, bottom, right, top = bounds
    width, height = right - left, top - bottom

    def convert(geom: Iterable[dict[str, Any]]) -> list[list[float]]:
        pts: list[list[float]] = []
        for p in geom:
            if "lon" not in p or "lat" not in p:
                continue
            x, y = transformer.transform(float(p["lon"]), float(p["lat"]))
            u = (x - left) / width
            v = (top - y) / height
            if -0.05 <= u <= 1.05 and -0.05 <= v <= 1.05:
                pts.append([float(u), float(v)])
        return pts

    rivers: list[dict[str, Any]] = []
    lakes: list[dict[str, Any]] = []
    seen_rivers: set[tuple[str, int]] = set()
    elements = raw.get("elements", [])
    for el in elements:
        tags = el.get("tags") or {}
        typ = el.get("type")
        eid = int(el.get("id", 0))
        waterway = tags.get("waterway")
        if waterway in {"river", "stream", "canal"} and el.get("geometry"):
            pts = convert(el["geometry"])
            if len(pts) >= 2 and (typ, eid) not in seen_rivers:
                rivers.append({
                    "id": f"{typ}/{eid}",
                    "kind": waterway,
                    "name": tags.get("name") or tags.get("name:en") or "",
                    "intermittent": tags.get("intermittent") == "yes",
                    "widthMeters": parse_width(tags, waterway),
                    "points": rdp(pts, 0.00022),
                })
                seen_rivers.add((typ, eid))

        is_water_area = tags.get("natural") == "water" or tags.get("landuse") == "reservoir" or tags.get("water") in {"lake", "reservoir", "pond", "river"}
        if not is_water_area:
            continue
        if typ == "way" and el.get("geometry"):
            pts = convert(el["geometry"])
            if len(pts) >= 4:
                if pts[0] != pts[-1]:
                    pts.append(pts[0])
                lakes.append({"id": f"way/{eid}", "kind": tags.get("water") or "water", "name": tags.get("name") or "", "rings": [rdp(pts, 0.00015)]})
        elif typ == "relation":
            outer_segments: list[list[list[float]]] = []
            inner_segments: list[list[list[float]]] = []
            for member in el.get("members") or []:
                geom = member.get("geometry")
                if not geom:
                    continue
                pts = convert(geom)
                if len(pts) < 2:
                    continue
                (inner_segments if member.get("role") == "inner" else outer_segments).append(pts)
            outer = join_segments(outer_segments)
            inner = join_segments(inner_segments)
            for j, ring in enumerate(outer):
                if len(ring) >= 4:
                    if ring[0] != ring[-1]:
                        ring.append(ring[0])
                    lakes.append({"id": f"relation/{eid}/{j}", "kind": tags.get("water") or "water", "name": tags.get("name") or "", "rings": [rdp(ring, 0.00015)]})

    if not rivers and not lakes:
        raise RuntimeError("Overpass result contains no usable rivers or water areas; fail closed")
    return {
        "schemaVersion": "kunming_hydrology_reference@1.0.0",
        "status": "current_reference_not_historical_truth",
        "source": {
            "provider": "OpenStreetMap via Overpass API",
            "copyright": "OpenStreetMap contributors",
            "license": "ODbL 1.0",
            "queryTimestamp": raw.get("osm3s", {}).get("timestamp_osm_base"),
        },
        "coordinateSpace": "normalized crop UV",
        "cropBoundsEpsg32648": list(bounds),
        "rivers": rivers,
        "lakes": lakes,
        "qa": {
            "riverFeatureCount": len(rivers),
            "lakeFeatureCount": len(lakes),
            "relationInnerRingsOmittedFromVisualMask": bool(inner if 'inner' in locals() else []),
        },
    }


def detect_dem_lakes(z: np.ndarray, px: float, py: float) -> list[dict[str, Any]]:
    gx = np.gradient(z, axis=1) / px
    gy = np.gradient(z, axis=0) / py
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    mean = uniform_filter(z, size=5, mode="nearest")
    mean2 = uniform_filter(z * z, size=5, mode="nearest")
    std = np.sqrt(np.maximum(0.0, mean2 - mean * mean))
    candidate = (slope < 0.2) & (std < 1.0)
    labels, count = label(candidate)
    sizes = np.bincount(labels.ravel())
    min_cells = max(1, round(0.5e6 / (px * py)))
    lakes: list[dict[str, Any]] = []
    for idx in range(1, count + 1):
        if sizes[idx] < min_cells:
            continue
        mask = labels == idx
        ys, xs = np.where(mask)
        lakes.append({
            "areaKm2": float(sizes[idx] * px * py / 1e6),
            "meanElevationMeters": float(z[mask].mean()),
            "bboxPixels": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        })
    lakes.sort(key=lambda item: item["areaKm2"], reverse=True)
    return lakes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--osm", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--template", type=Path, required=True)
    ap.add_argument("--texture-width", type=int, default=3072)
    args = ap.parse_args()

    actual_sha = sha256(args.input)
    if actual_sha != EXPECTED_SHA256:
        raise RuntimeError(f"input SHA-256 mismatch: {actual_sha}")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "assets").mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.input) as src:
        if str(src.crs) != EXPECTED_CRS:
            raise RuntimeError(f"CRS mismatch: {src.crs}")
        if (src.width, src.height) != EXPECTED_GRID:
            raise RuntimeError(f"grid mismatch: {(src.width, src.height)}")
        require_close(src.res[0], EXPECTED_RES[0]); require_close(abs(src.res[1]), EXPECTED_RES[1])
        for got, exp in zip(src.bounds, EXPECTED_BOUNDS):
            require_close(got, exp)
        if src.compression is not None:
            raise RuntimeError(f"authoritative cropped master must be uncompressed; got {src.compression}")
        if src.overviews(1):
            raise RuntimeError("authoritative cropped master must not contain overviews")

        texture_w = args.texture_width
        texture_h = round(src.height * texture_w / src.width)
        z = src.read(1, out_shape=(texture_h, texture_w), resampling=Resampling.bilinear).astype(np.float32)
        zmin = float(np.nanmin(z)); zmax = float(np.nanmax(z)); zmean = float(np.nanmean(z)); zstd = float(np.nanstd(z))
        px = (src.bounds.right - src.bounds.left) / texture_w
        py = (src.bounds.top - src.bounds.bottom) / texture_h

        Image.fromarray(normalize_rg16(z, zmin, zmax), mode="RGB").save(args.output / "assets" / "height_rg16.png", compress_level=4)
        surface = make_surface(z, px, py)
        Image.fromarray(surface, mode="RGB").save(args.output / "assets" / "surface_satellite.png", compress_level=4)
        fallback_h = 2048
        fallback_w = round(texture_w * fallback_h / texture_h)
        Image.fromarray(surface, mode="RGB").resize((fallback_w, fallback_h), Image.Resampling.LANCZOS).save(args.output / "assets" / "fallback.jpg", quality=93, subsampling=0)

        qh = 1024; qw = round(src.width * qh / src.height)
        qz = src.read(1, out_shape=(qh, qw), resampling=Resampling.average).astype(np.float64)
        qpx = (src.bounds.right - src.bounds.left) / qw
        qpy = (src.bounds.top - src.bounds.bottom) / qh
        dem_lakes = detect_dem_lakes(qz, qpx, qpy)

    hydrology = parse_osm(args.osm, EXPECTED_BOUNDS)
    hydrology["demValidation"] = {
        "method": "flat connected components at approximately 99 m sample spacing",
        "status": "model validation only",
        "detectedLakeComponents": dem_lakes,
    }
    (args.output / "hydrology.json").write_text(json.dumps(hydrology, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    mesh = [896, round(896 * EXPECTED_GRID[1] / EXPECTED_GRID[0])]
    knowledge = {
        "schemaVersion": "kunming_dem_knowledge@1.0.0",
        "status": "distilled_reproducible_knowledge",
        "authoritativeSource": {
            "file": args.input.name,
            "sha256": actual_sha,
            "sourceMosaicSha256": SOURCE_BASELINE_SHA256,
            "crs": EXPECTED_CRS,
            "pixelSpacingMeters": [12.5, 12.5],
            "grid": list(EXPECTED_GRID),
            "bounds": list(EXPECTED_BOUNDS),
            "compression": "NONE",
            "overviews": [],
            "elevationMeters": {"min": zmin, "max": zmax, "mean": zmean, "std": zstd}
        },
        "storagePolicy": {
            "gitStoresAuthoritativeTiff": false,
            "gitStoresViewerTextures": false,
            "sourceBinaryRole": "single cold archive or reproducible external source",
            "repositoryStores": ["hashes", "lineage", "crop", "algorithms", "parameters", "QA", "regeneration scripts"],
            "viewerAssetsAre": "regenerable caches"
        },
        "viewer": {
            "texture": [texture_w, texture_h],
            "mesh": mesh,
            "displayPixelMetersApprox": [px, py],
            "heightEncoding": "RG16 normalized PNG"
        },
        "hydrology": {
            "currentReference": "OpenStreetMap waterways and water areas",
            "topologyValidation": "DEM flat-lake detection; flow validation planned",
            "historicalTruthStatus": "pending",
            "failClosedRule": "never draw a river without a cited source or declared DEM-derived model"
        },
        "colorModel": {
            "inspiredBy": ["Gaea SatMaps", "CLUT/data-map mixing", "slope", "aspect", "local relief", "valley wetness"],
            "authoritativeElevationModified": false
        }
    }
    (args.output / "knowledge.json").write_text(json.dumps(knowledge, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "schemaVersion": "kunming_progress_viewer@3.0.0",
        "title": "昆明 DEM 真值优先 V003",
        "authoritative": knowledge["authoritativeSource"],
        "viewer": knowledge["viewer"],
        "hydrology": {
            "source": hydrology["source"],
            "riverFeatureCount": hydrology["qa"]["riverFeatureCount"],
            "lakeFeatureCount": hydrology["qa"]["lakeFeatureCount"],
            "status": hydrology["status"]
        },
        "rules": [
            "No hand-drawn waterways.",
            "No authoritative DEM values are modified.",
            "Browser textures are display proxies and are never processing inputs.",
            "Current OSM hydrography is a present-day reference; historical reconstruction remains pending."
        ]
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    for name in ["index.html", "styles.css", "app.js"]:
        src = args.template / name
        if not src.exists():
            raise RuntimeError(f"missing template {src}")
        (args.output / name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")

    qa = {
        "status": "complete",
        "inputSha256": actual_sha,
        "texture": [texture_w, texture_h],
        "mesh": mesh,
        "hydrology": manifest["hydrology"],
        "assets": {p.name: {"bytes": p.stat().st_size, "sha256": sha256(p)} for p in (args.output / "assets").iterdir() if p.is_file()}
    }
    (args.output / "QA.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
