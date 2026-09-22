#!/usr/bin/env python3
"""Verify the R19 Palau authority gate without fabricating missing geography.

Default mode validates that the repository is honestly blocked while exact source
binaries are absent. `--require-ready --input-root <dir>` verifies the actual
JPEG and GeoTIFF bytes before any visual build is permitted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
LOCK_PATH = ROOT / "games/survivor-palau/palau-world/airai-r19/R19_AUTHORITY_LOCK.json"
BINDINGS_PATH = ROOT / "games/survivor-palau/palau-world/airai-r19/R19_INPUT_BINDINGS.json"
OCEAN_PATH = ROOT / (
    "ocean-mother/releases/r018-v036-unified/"
    "Ocean_Mother_R018_V0.3.6_Unified_Seascape_Verified_Direct_Open.html"
)

EXPECTED_IMAGES = {
    "complete_palau_frame": {
        "filename": "01_PALAU_FULL_FRAME_USER_ORIGINAL.jpeg",
        "bytes": 109929,
        "dimensions": [581, 1260],
        "sha256": "5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312",
    },
    "stone_money_user_yellow_region": {
        "filename": "02_STONE_MONEY_YELLOW_AREA_USER_ORIGINAL.jpeg",
        "bytes": 285719,
        "dimensions": [1284, 2778],
        "sha256": "4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47",
    },
}


class GateError(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise GateError(f"missing contract: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def jpeg_dimensions(path: Path) -> list[int]:
    """Read JPEG width/height without Pillow."""
    data = path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise GateError(f"not a JPEG: {path}")
    offset = 2
    sof_markers = {
        0xC0,
        0xC1,
        0xC2,
        0xC3,
        0xC5,
        0xC6,
        0xC7,
        0xC9,
        0xCA,
        0xCB,
        0xCD,
        0xCE,
        0xCF,
    }
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            break
        length = struct.unpack(">H", data[offset : offset + 2])[0]
        if length < 2 or offset + length > len(data):
            raise GateError(f"invalid JPEG segment in {path}")
        if marker in sof_markers:
            if length < 7:
                raise GateError(f"invalid JPEG SOF in {path}")
            height = struct.unpack(">H", data[offset + 3 : offset + 5])[0]
            width = struct.unpack(">H", data[offset + 5 : offset + 7])[0]
            return [width, height]
        offset += length
    raise GateError(f"JPEG dimensions not found: {path}")


def assert_equal(actual: Any, expected: Any, label: str) -> None:
    if actual != expected:
        raise GateError(f"{label}: expected {expected!r}, got {actual!r}")


def validate_contracts(lock: dict[str, Any], bindings: dict[str, Any]) -> None:
    assert_equal(lock["base"]["sha"], "c47f7cc62d864e95117bd5548ca9ffa3f1d770a8", "base SHA")
    rejected = lock["rejectedLineage"]
    for field in (
        "reuseVisibleGeography",
        "reuseCoastlines",
        "reuseStoryAnchors",
        "reuseTerrainMeshes",
        "reuseVisualResults",
    ):
        assert_equal(rejected[field], False, f"rejected lineage {field}")

    by_role = {item["role"]: item for item in lock["authorityImages"]}
    bound_by_role = {item["role"]: item for item in bindings["authorityImages"]}
    for role, expected in EXPECTED_IMAGES.items():
        if role not in by_role or role not in bound_by_role:
            raise GateError(f"missing authority role: {role}")
        locked = by_role[role]
        bound = bound_by_role[role]
        assert_equal(locked["canonicalFilename"], expected["filename"], f"{role} filename")
        assert_equal(locked["bytes"], expected["bytes"], f"{role} bytes")
        assert_equal(locked["dimensions"], expected["dimensions"], f"{role} dimensions")
        assert_equal(locked["sha256"], expected["sha256"], f"{role} SHA-256")
        for key in ("canonicalFilename", "bytes", "dimensions", "sha256"):
            assert_equal(bound[key], locked[key], f"binding {role} {key}")

    rules = lock["worldRules"]
    assert_equal(rules["storyRegionIsPoint"], False, "story region point flag")
    assert_equal(rules["automaticIslandNamingAllowed"], False, "automatic naming")
    assert_equal(rules["guessedStoryCoordinatesAllowed"], False, "guessed story coordinates")
    assert_equal(rules["cartoonTerrainAllowed"], False, "cartoon terrain")
    assert_equal(rules["traditionalLOD"], False, "traditional LOD")
    assert_equal(lock["elevationAuthority"]["substitutionAllowed"], False, "DEM substitution")
    assert_equal(lock["elevationAuthority"]["copernicusFallbackAllowed"], False, "Copernicus fallback")
    if not OCEAN_PATH.is_file():
        raise GateError(f"frozen Ocean Mother source missing: {OCEAN_PATH}")


def verify_authority_images(bindings: dict[str, Any], input_root: Path) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for item in bindings["authorityImages"]:
        role = item["role"]
        expected = EXPECTED_IMAGES[role]
        relative = item.get("relativePath")
        if not relative:
            raise GateError(f"{role}: relativePath is not bound")
        path = (input_root / relative).resolve()
        if not path.is_file():
            raise GateError(f"{role}: source file missing: {path}")
        assert_equal(path.stat().st_size, expected["bytes"], f"{role} actual bytes")
        assert_equal(sha256_file(path), expected["sha256"], f"{role} actual SHA-256")
        assert_equal(jpeg_dimensions(path), expected["dimensions"], f"{role} actual dimensions")
        verified.append({"role": role, "path": str(path), "sha256": expected["sha256"]})
    return verified


def verify_dem_files(bindings: dict[str, Any], input_root: Path) -> list[dict[str, Any]]:
    try:
        import rasterio  # type: ignore
    except ImportError as exc:
        raise GateError("rasterio is required for ready-state GeoTIFF verification") from exc

    items = bindings.get("demGeoTiffs", [])
    if len(items) != 2:
        raise GateError(f"exactly two DEM GeoTIFF bindings are required, got {len(items)}")

    verified: list[dict[str, Any]] = []
    for item in items:
        dem_id = item.get("id") or "UNKNOWN_DEM"
        required_fields = (
            "relativePath",
            "originalFilename",
            "bytes",
            "sha256",
            "crs",
            "transform",
            "width",
            "height",
            "bounds",
            "dtype",
        )
        missing = [field for field in required_fields if item.get(field) is None]
        if missing:
            raise GateError(f"{dem_id}: incomplete frozen identity fields: {missing}")
        path = (input_root / item["relativePath"]).resolve()
        if not path.is_file():
            raise GateError(f"{dem_id}: GeoTIFF missing: {path}")
        assert_equal(path.name, item["originalFilename"], f"{dem_id} filename")
        assert_equal(path.stat().st_size, item["bytes"], f"{dem_id} bytes")
        assert_equal(sha256_file(path), item["sha256"], f"{dem_id} SHA-256")
        with rasterio.open(path) as dataset:
            actual_transform = [float(value) for value in dataset.transform[:6]]
            actual_bounds = [
                float(dataset.bounds.left),
                float(dataset.bounds.bottom),
                float(dataset.bounds.right),
                float(dataset.bounds.top),
            ]
            assert_equal(str(dataset.crs), item["crs"], f"{dem_id} CRS")
            assert_equal(actual_transform, item["transform"], f"{dem_id} transform")
            assert_equal(dataset.width, item["width"], f"{dem_id} width")
            assert_equal(dataset.height, item["height"], f"{dem_id} height")
            assert_equal(actual_bounds, item["bounds"], f"{dem_id} bounds")
            assert_equal(dataset.nodata, item.get("nodata"), f"{dem_id} NoData")
            assert_equal(dataset.dtypes[0], item["dtype"], f"{dem_id} dtype")
        verified.append({"id": dem_id, "path": str(path), "sha256": item["sha256"]})
    return verified


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-root", type=Path)
    parser.add_argument("--require-ready", action="store_true")
    args = parser.parse_args()

    try:
        lock = load_json(LOCK_PATH)
        bindings = load_json(BINDINGS_PATH)
        validate_contracts(lock, bindings)

        if not args.require_ready:
            assert_equal(lock["gate"]["visualBuildAllowed"], False, "blocked visual build")
            assert_equal(lock["gate"]["status"], "BLOCKED_SOURCE_BINARIES", "blocked status")
            assert_equal(bindings["readyForVisualBuild"], False, "binding visual readiness")
            print(
                json.dumps(
                    {
                        "status": "PASS_BLOCKED_HONESTLY",
                        "visualBuildAllowed": False,
                        "authorityImages": len(lock["authorityImages"]),
                        "requiredDemGeoTiffs": lock["elevationAuthority"]["requiredCount"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0

        if args.input_root is None:
            raise GateError("--input-root is required with --require-ready")
        image_result = verify_authority_images(bindings, args.input_root)
        dem_result = verify_dem_files(bindings, args.input_root)
        print(
            json.dumps(
                {
                    "status": "PASS_EXACT_SOURCE_BYTES",
                    "authorityImages": image_result,
                    "demGeoTiffs": dem_result,
                    "authorityOverlayMayBegin": True,
                    "visualBuildMayBegin": False,
                    "nextGate": "coordinate registration and overlay QA",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except GateError as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
