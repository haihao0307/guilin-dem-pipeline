"""Build four exact 10 km by 10 km Guilin core DEM packages.

Each output is a centered 800 by 800 crop of an existing 1132 by 1132,
12.5 metre fine-region package. The build never interpolates spatial samples.
The source mask is cropped byte-for-byte, so any source gap remains explicit.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from array import array
from pathlib import Path


CORE_IDS = (
    "zhenbao-ding",
    "guilin-old-city",
    "yangtang-airfield",
    "yangshuo-county-seat",
)
SOURCE_GRID_SIZE = 1132
CORE_GRID_SIZE = 800
RESOLUTION_METERS = 12.5
CORE_SIDE_METERS = CORE_GRID_SIZE * RESOLUTION_METERS
CROP_OFFSET = (SOURCE_GRID_SIZE - CORE_GRID_SIZE) // 2


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_json_bytes(value: dict) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def little_endian_u16(raw: bytes) -> array:
    if len(raw) % 2:
        raise RuntimeError("uint16 payload has an odd byte length")
    values = array("H")
    values.frombytes(raw)
    if sys.byteorder != "little":
        values.byteswap()
    return values


def u16_little_endian_bytes(values: array) -> bytes:
    encoded = array("H", values)
    if sys.byteorder != "little":
        encoded.byteswap()
    return encoded.tobytes()


def crop_rows(values, source_width: int, offset: int, size: int):
    cropped = []
    for row in range(offset, offset + size):
        start = row * source_width + offset
        cropped.extend(values[start:start + size])
    return cropped


def inverse_utm49(easting: float, northing: float) -> tuple[float, float]:
    """Convert EPSG:32649 coordinates to WGS84 without an optional dependency."""
    semi_major = 6378137.0
    eccentricity_sq = 0.00669437999014
    scale = 0.9996
    eccentricity_prime_sq = eccentricity_sq / (1.0 - eccentricity_sq)
    x = easting - 500000.0
    meridional_arc = northing / scale
    mu = meridional_arc / (
        semi_major
        * (
            1.0
            - eccentricity_sq / 4.0
            - 3.0 * eccentricity_sq**2 / 64.0
            - 5.0 * eccentricity_sq**3 / 256.0
        )
    )
    e1 = (1.0 - math.sqrt(1.0 - eccentricity_sq)) / (1.0 + math.sqrt(1.0 - eccentricity_sq))
    footpoint = (
        mu
        + (3.0 * e1 / 2.0 - 27.0 * e1**3 / 32.0) * math.sin(2.0 * mu)
        + (21.0 * e1**2 / 16.0 - 55.0 * e1**4 / 32.0) * math.sin(4.0 * mu)
        + (151.0 * e1**3 / 96.0) * math.sin(6.0 * mu)
        + (1097.0 * e1**4 / 512.0) * math.sin(8.0 * mu)
    )
    sin_fp, cos_fp, tan_fp = math.sin(footpoint), math.cos(footpoint), math.tan(footpoint)
    c1 = eccentricity_prime_sq * cos_fp**2
    t1 = tan_fp**2
    n1 = semi_major / math.sqrt(1.0 - eccentricity_sq * sin_fp**2)
    r1 = semi_major * (1.0 - eccentricity_sq) / (1.0 - eccentricity_sq * sin_fp**2) ** 1.5
    d = x / (n1 * scale)
    latitude = footpoint - (n1 * tan_fp / r1) * (
        d**2 / 2.0
        - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1**2 - 9.0 * eccentricity_prime_sq) * d**4 / 24.0
        + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1**2 - 252.0 * eccentricity_prime_sq - 3.0 * c1**2)
        * d**6
        / 720.0
    )
    longitude = math.radians(111.0) + (
        d
        - (1.0 + 2.0 * t1 + c1) * d**3 / 6.0
        + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1**2 + 8.0 * eccentricity_prime_sq + 24.0 * t1**2)
        * d**5
        / 120.0
    ) / cos_fp
    return math.degrees(longitude), math.degrees(latitude)


def wgs84_bounds(bounds: list[float]) -> list[float]:
    west, south, east, north = bounds
    corners = (
        inverse_utm49(west, south),
        inverse_utm49(west, north),
        inverse_utm49(east, south),
        inverse_utm49(east, north),
    )
    longitudes = [point[0] for point in corners]
    latitudes = [point[1] for point in corners]
    return [min(longitudes), min(latitudes), max(longitudes), max(latitudes)]


def source_index_by_id(index_path: Path) -> tuple[dict, dict[str, dict]]:
    index = read_json(index_path)
    records = {item["id"]: item for item in index.get("regions", [])}
    missing = [core_id for core_id in CORE_IDS if core_id not in records]
    if missing:
        raise RuntimeError(f"source index is missing cores: {', '.join(missing)}")
    grid_origins = {
        (
            float(record["bounds"][0]) - int(record["pixelOrigin"][0]) * RESOLUTION_METERS,
            float(record["bounds"][3]) + int(record["pixelOrigin"][1]) * RESOLUTION_METERS,
        )
        for record in records.values()
    }
    if len(grid_origins) != 1:
        raise RuntimeError("focus packages do not share one 12.5 m mosaic pixel origin")
    index["sourceMosaicId"] = "verified-12.5m-mosaic-all-10"
    index["sourceMosaicGridOriginProjected"] = list(grid_origins.pop())
    return index, records


def validate_source(manifest: dict, height_raw: bytes, mask_raw: bytes, core_id: str) -> None:
    width = int(manifest.get("gridWidth", 0))
    height = int(manifest.get("gridHeight", 0))
    if (width, height) != (SOURCE_GRID_SIZE, SOURCE_GRID_SIZE):
        raise RuntimeError(f"{core_id}: expected {SOURCE_GRID_SIZE}x{SOURCE_GRID_SIZE}, got {width}x{height}")
    if manifest.get("crs") != "EPSG:32649":
        raise RuntimeError(f"{core_id}: unexpected CRS {manifest.get('crs')!r}")
    resolution = manifest.get("resolution") or []
    if len(resolution) != 2 or any(abs(float(value) - RESOLUTION_METERS) > 1e-9 for value in resolution):
        raise RuntimeError(f"{core_id}: expected a 12.5 m square grid")
    if len(height_raw) != width * height * 2:
        raise RuntimeError(f"{core_id}: height binary size does not match the manifest")
    if len(mask_raw) != width * height:
        raise RuntimeError(f"{core_id}: mask binary size does not match the manifest")


def package_core(core_id: str, source_root: Path, output_root: Path, source_record: dict, source_index: dict) -> dict:
    source_dir = source_root / core_id
    source_manifest_path = source_dir / "terrain-manifest.json"
    source_height_path = source_dir / "height_u16.bin"
    source_mask_path = source_dir / "mask_u8.bin"
    source_manifest = read_json(source_manifest_path)
    source_height_raw = source_height_path.read_bytes()
    source_mask_raw = source_mask_path.read_bytes()
    validate_source(source_manifest, source_height_raw, source_mask_raw, core_id)

    source_heights = little_endian_u16(source_height_raw)
    core_source_heights = crop_rows(source_heights, SOURCE_GRID_SIZE, CROP_OFFSET, CORE_GRID_SIZE)
    core_mask_values = crop_rows(source_mask_raw, SOURCE_GRID_SIZE, CROP_OFFSET, CORE_GRID_SIZE)
    valid_indices = [sample_index for sample_index, valid in enumerate(core_mask_values) if valid]
    if not valid_indices:
        raise RuntimeError(f"{core_id}: centered core has no valid DEM pixels")

    source_minimum = float(source_manifest["minimumElevation"])
    source_maximum = float(source_manifest["maximumElevation"])
    source_range = source_maximum - source_minimum
    decoded = [source_minimum + core_source_heights[sample_index] / 65535.0 * source_range for sample_index in valid_indices]
    valid_minimum = min(decoded)
    valid_maximum = max(decoded)

    # Preserve every source uint16 code. Spatial samples and their quantisation
    # envelope remain identical to the common 12.5 m mosaic window.
    height_bytes = u16_little_endian_bytes(array("H", core_source_heights))
    mask_bytes = bytes(core_mask_values)
    west, south, east, north = [float(value) for value in source_manifest["bounds"]]
    core_bounds = [
        west + CROP_OFFSET * RESOLUTION_METERS,
        north - (CROP_OFFSET + CORE_GRID_SIZE) * RESOLUTION_METERS,
        west + (CROP_OFFSET + CORE_GRID_SIZE) * RESOLUTION_METERS,
        north - CROP_OFFSET * RESOLUTION_METERS,
    ]
    grid_center = [(core_bounds[0] + core_bounds[2]) / 2.0, (core_bounds[1] + core_bounds[3]) / 2.0]
    source_pixel_origin = [int(value) for value in source_record["pixelOrigin"]]
    pixel_origin = [source_pixel_origin[0] + CROP_OFFSET, source_pixel_origin[1] + CROP_OFFSET]
    valid_count = len(valid_indices)
    pixel_count = CORE_GRID_SIZE * CORE_GRID_SIZE
    valid_fraction = valid_count / pixel_count
    status = "ready_12_5m" if valid_fraction == 1.0 else "incomplete_12_5m"
    source_manifest_rel = source_manifest_path.as_posix()
    source_height_rel = source_height_path.as_posix()
    source_mask_rel = source_mask_path.as_posix()
    try:
        repo_root = Path(__file__).resolve().parents[3]
        source_manifest_rel = source_manifest_path.resolve().relative_to(repo_root).as_posix()
        source_height_rel = source_height_path.resolve().relative_to(repo_root).as_posix()
        source_mask_rel = source_mask_path.resolve().relative_to(repo_root).as_posix()
    except ValueError:
        pass

    landmarks = []
    for landmark in source_manifest.get("landmarks", []):
        item = dict(landmark)
        center = source_manifest.get("centerProjected", grid_center)
        item["gridU"] = (float(center[0]) - core_bounds[0]) / CORE_SIDE_METERS
        item["gridV"] = (core_bounds[3] - float(center[1])) / CORE_SIDE_METERS
        landmarks.append(item)

    manifest = {
        "schemaVersion": "guilin-core-dem/v1",
        "id": core_id,
        "name": source_manifest["name"],
        "crs": source_manifest["crs"],
        "sourceResolutionMeters": RESOLUTION_METERS,
        "accuracyPolicy": source_manifest["accuracyPolicy"],
        "requestedAreaSquareKilometers": 100.0,
        "actualAreaSquareKilometers": 100.0,
        "bounds": core_bounds,
        "projectedBounds": core_bounds,
        "wgs84Bounds": wgs84_bounds(core_bounds),
        "widthMeters": CORE_SIDE_METERS,
        "heightMeters": CORE_SIDE_METERS,
        "gridWidth": CORE_GRID_SIZE,
        "gridHeight": CORE_GRID_SIZE,
        "resolution": [RESOLUTION_METERS, RESOLUTION_METERS],
        "raster": {
            "width": CORE_GRID_SIZE,
            "height": CORE_GRID_SIZE,
            "resolutionMeters": RESOLUTION_METERS,
            "gridConvention": "pixel-center",
            "spacingDerivation": "projected-extent/grid-dimension",
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "sampleType": "uint16",
            "byteOrder": "little-endian",
        },
        "rowOrder": "north-to-south",
        "columnOrder": "west-to-east",
        "pixelOrigin": pixel_origin,
        "pixelOriginProjected": [core_bounds[0], core_bounds[3]],
        "firstPixelCenterProjected": [
            core_bounds[0] + RESOLUTION_METERS / 2.0,
            core_bounds[3] - RESOLUTION_METERS / 2.0,
        ],
        "gridCenterProjected": grid_center,
        "centerProjected": source_manifest.get("centerProjected", grid_center),
        "minimumElevation": source_minimum,
        "maximumElevation": source_maximum,
        "validElevationRangeMeters": [valid_minimum, valid_maximum],
        "verticalScale": float(source_manifest.get("verticalScale", 1.0)),
        "heightEncoding": {
            "sampleType": "uint16",
            "byteOrder": "little-endian",
            "quantizationMinimumMeters": source_minimum,
            "quantizationMaximumMeters": source_maximum,
            "decodeFormula": "min_m + sample_u16 / 65535 * (max_m - min_m)",
        },
        "heightBinary": "height_u16.bin",
        "heightByteLength": len(height_bytes),
        "heightSha256": sha256_bytes(height_bytes),
        "maskBinary": "mask_u8.bin",
        "maskByteLength": len(mask_bytes),
        "maskSha256": sha256_bytes(mask_bytes),
        "validPixelCount": valid_count,
        "missingPixelCount": pixel_count - valid_count,
        "validFraction": valid_fraction,
        "status": status,
        "sourceStatus": source_manifest.get("status"),
        "gapPolicy": "source-mask-preserved-no-fill" if valid_fraction < 1.0 else "complete-source-window",
        "coverage": {
            "validFraction": valid_fraction,
            "validPixelCount": valid_count,
            "missingPixelCount": pixel_count - valid_count,
            "complete": valid_fraction == 1.0,
        },
        "fallback": {
            "applied": False,
            "allowed": False,
            "policy": "mask-invalid-pixels-and-report-source-gap",
        },
        "landmarks": landmarks,
        "waterwayPolicy": source_manifest.get("waterwayPolicy"),
        "sourceLineage": {
            "lineageId": "verified-12.5m-fine-region-centered-core",
            "sourceMosaicId": source_index["sourceMosaicId"],
            "sourceMosaicGridOriginProjected": source_index["sourceMosaicGridOriginProjected"],
            "sourceManifest": source_manifest_rel,
            "sourceHeightBinary": source_height_rel,
            "sourceMaskBinary": source_mask_rel,
            "sourceManifestSha256": sha256_path(source_manifest_path),
            "sourceHeightSha256": sha256_path(source_height_path),
            "sourceMaskSha256": sha256_path(source_mask_path),
            "sourceGridWidth": SOURCE_GRID_SIZE,
            "sourceGridHeight": SOURCE_GRID_SIZE,
            "sourceBounds": source_manifest["bounds"],
            "sourcePixelOrigin": source_pixel_origin,
            "sourceValidFraction": float(source_manifest["validFraction"]),
            "sourceMinimumElevation": source_minimum,
            "sourceMaximumElevation": source_maximum,
            "sourceStatus": source_manifest.get("status"),
            "sourceIndexSchemaVersion": source_index.get("schemaVersion"),
            "sourceIndexGeneratedAt": source_index.get("generatedAt"),
            "cropMethod": "center-window-no-spatial-resampling",
            "cropWindow": {
                "columnOffset": CROP_OFFSET,
                "rowOffset": CROP_OFFSET,
                "width": CORE_GRID_SIZE,
                "height": CORE_GRID_SIZE,
            },
            "heightReencoding": "none-source-u16-codes-cropped-byte-for-byte",
        },
        "sourceMosaic": {
            "mosaicId": source_index["sourceMosaicId"],
            "crs": source_manifest["crs"],
            "resolutionMeters": RESOLUTION_METERS,
            "gridOriginProjected": source_index["sourceMosaicGridOriginProjected"],
            "gridOriginConvention": "west-north-vertex",
            "pixelOrigin": source_pixel_origin,
            "fineRegionId": core_id,
            "fineRegionGridWidth": SOURCE_GRID_SIZE,
            "fineRegionGridHeight": SOURCE_GRID_SIZE,
            "fineRegionBounds": source_manifest["bounds"],
            "fineRegionValidFraction": float(source_manifest["validFraction"]),
            "cropColumnOffset": CROP_OFFSET,
            "cropRowOffset": CROP_OFFSET,
            "sourceManifest": source_manifest_rel,
            "sourceIndexSchemaVersion": source_index.get("schemaVersion"),
            "sourceIndexGeneratedAt": source_index.get("generatedAt"),
        },
    }

    target = output_root / core_id
    target.mkdir(parents=True, exist_ok=True)
    (target / "height_u16.bin").write_bytes(height_bytes)
    (target / "mask_u8.bin").write_bytes(mask_bytes)
    (target / "manifest.json").write_bytes(stable_json_bytes(manifest))
    validate_package(target, manifest)
    return manifest


def validate_package(path: Path, manifest: dict | None = None) -> dict:
    manifest = manifest or read_json(path / "manifest.json")
    height = (path / manifest["heightBinary"]).read_bytes()
    mask = (path / manifest["maskBinary"]).read_bytes()
    expected_pixels = int(manifest["gridWidth"]) * int(manifest["gridHeight"])
    if (manifest["gridWidth"], manifest["gridHeight"]) != (CORE_GRID_SIZE, CORE_GRID_SIZE):
        raise RuntimeError(f"{path.name}: output grid must be 800x800")
    if manifest["widthMeters"] != CORE_SIDE_METERS or manifest["heightMeters"] != CORE_SIDE_METERS:
        raise RuntimeError(f"{path.name}: output extent must be exactly 10,000 m square")
    if len(height) != expected_pixels * 2 or len(mask) != expected_pixels:
        raise RuntimeError(f"{path.name}: output binary byte length mismatch")
    if sha256_bytes(height) != manifest["heightSha256"] or sha256_bytes(mask) != manifest["maskSha256"]:
        raise RuntimeError(f"{path.name}: output checksum mismatch")
    valid_count = sum(1 for value in mask if value > 0)
    if valid_count != manifest["validPixelCount"]:
        raise RuntimeError(f"{path.name}: valid-pixel count mismatch")
    if abs(valid_count / expected_pixels - manifest["validFraction"]) > 1e-15:
        raise RuntimeError(f"{path.name}: valid fraction mismatch")
    if path.name == "zhenbao-ding" and manifest["missingPixelCount"] == 0:
        raise RuntimeError("zhenbao-ding: known source gap was hidden")
    source_mosaic = manifest.get("sourceMosaic", {})
    if source_mosaic.get("mosaicId") != "verified-12.5m-mosaic-all-10":
        raise RuntimeError(f"{path.name}: source mosaic identity is missing")
    if source_mosaic.get("gridOriginProjected") != [378787.5, 2906250.0]:
        raise RuntimeError(f"{path.name}: source mosaic pixel origin is inconsistent")
    return manifest


def build_index(manifests: list[dict], output_root: Path) -> dict:
    mosaic_ids = {manifest["sourceMosaic"]["mosaicId"] for manifest in manifests}
    mosaic_origins = {tuple(manifest["sourceMosaic"]["gridOriginProjected"]) for manifest in manifests}
    if len(mosaic_ids) != 1 or len(mosaic_origins) != 1:
        raise RuntimeError("all four cores must share one source mosaic and pixel origin")
    index = {
        "schemaVersion": "guilin-core-dem-index/v1",
        "coreSideMeters": CORE_SIDE_METERS,
        "gridWidth": CORE_GRID_SIZE,
        "gridHeight": CORE_GRID_SIZE,
        "resolutionMeters": RESOLUTION_METERS,
        "crs": "EPSG:32649",
        "sourceMosaic": {
            "mosaicId": mosaic_ids.pop(),
            "crs": "EPSG:32649",
            "resolutionMeters": RESOLUTION_METERS,
            "gridOriginProjected": list(mosaic_origins.pop()),
            "gridOriginConvention": "west-north-vertex",
            "cropMethod": "exact-source-window-no-spatial-resampling",
        },
        "coreManifestUrls": {manifest["id"]: f"{manifest['id']}/manifest.json" for manifest in manifests},
        "cores": [
            {
                "id": manifest["id"],
                "name": manifest["name"],
                "manifestUrl": f"{manifest['id']}/manifest.json",
                "status": manifest["status"],
                "validFraction": manifest["validFraction"],
            }
            for manifest in manifests
        ],
    }
    (output_root / "manifest.json").write_bytes(stable_json_bytes(index))
    return index


def main() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    project_root = repo_root / "DEM-Map-Pipeline" / "guilin-zhenbaoding-yangshuo-pingle"
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=project_root / "web" / "assets" / "fine-regions")
    parser.add_argument("--source-index", type=Path, default=project_root / "metadata" / "fine_regions_12_5m.json")
    parser.add_argument("--output-root", type=Path, default=repo_root / "web" / "guilin-v050" / "assets" / "cores")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    try:
        output_root = args.output_root.resolve()
        if args.check_only:
            manifests = [validate_package(output_root / core_id) for core_id in CORE_IDS]
            index = read_json(output_root / "manifest.json")
            if list(index.get("coreManifestUrls", {})) != list(CORE_IDS):
                raise RuntimeError("core index order or IDs do not match the fixed four-core contract")
            expected_mosaic = {
                "mosaicId": "verified-12.5m-mosaic-all-10",
                "crs": "EPSG:32649",
                "resolutionMeters": RESOLUTION_METERS,
                "gridOriginProjected": [378787.5, 2906250.0],
                "gridOriginConvention": "west-north-vertex",
                "cropMethod": "exact-source-window-no-spatial-resampling",
            }
            if index.get("sourceMosaic") != expected_mosaic:
                raise RuntimeError("core index source mosaic contract is inconsistent")
        else:
            source_index, source_records = source_index_by_id(args.source_index.resolve())
            output_root.mkdir(parents=True, exist_ok=True)
            manifests = [
                package_core(core_id, args.source_root.resolve(), output_root, source_records[core_id], source_index)
                for core_id in CORE_IDS
            ]
            build_index(manifests, output_root)
        for manifest in manifests:
            print(
                f"{manifest['id']}: {manifest['gridWidth']}x{manifest['gridHeight']}, "
                f"{manifest['widthMeters']:.0f}m square, valid={manifest['validFraction']:.9f}, "
                f"elevation={manifest['minimumElevation']:.3f}..{manifest['maximumElevation']:.3f}m, "
                f"status={manifest['status']}"
            )
        print(f"validated: {output_root / 'manifest.json'}")
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
