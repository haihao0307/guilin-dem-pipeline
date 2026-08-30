from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_online_assets import (
    AOI_SHA256,
    SOURCE_NODATA,
    SOURCE_SHA256,
    SOURCE_SPACING_M,
    build_hydrology,
    build_overview,
    write_json,
)
from canonical_elevation_store import CanonicalElevationStore

EXPECTED_CANONICAL_SHA256 = "91154cbe7c29220c9da41efc98105f1d36b614a343636543f7dd230735da079a"
EXPECTED_SAMPLE_COUNT = 211_919_355
EXPECTED_DATA_BYTES = 423_838_710
EXPECTED_CHUNK_COUNT = 840
EXPECTED_SHARD_COUNT = 7


def validate_store_and_contract(
    store: CanonicalElevationStore,
    native_manifest: dict,
    pointer: dict,
) -> None:
    manifest = store.manifest
    if manifest.get("status") not in {
        "pixel_exact_verified_cutover_pending",
        "authoritative_production_source",
    }:
        raise RuntimeError(f"canonical store status is not verified: {manifest.get('status')}")
    if manifest.get("source_cold_backup", {}).get("sha256") != SOURCE_SHA256:
        raise RuntimeError("canonical store cold-source identity mismatch")
    if manifest.get("aoi", {}).get("geometry_sha256") != AOI_SHA256:
        raise RuntimeError("canonical store AOI mismatch")
    stream = manifest.get("canonical_row_major_stream", {})
    if stream.get("sha256") != EXPECTED_CANONICAL_SHA256:
        raise RuntimeError("canonical stream SHA256 mismatch")
    if stream.get("sample_count") != EXPECTED_SAMPLE_COUNT or stream.get("bytes") != EXPECTED_DATA_BYTES:
        raise RuntimeError("canonical stream dimensions mismatch")
    for key in ("compression", "resampling", "quantization", "interpolation"):
        if stream.get(key) != "none":
            raise RuntimeError(f"canonical stream {key} must be none")
    logical = manifest.get("logical_chunks", {})
    if logical.get("chunk_count") != EXPECTED_CHUNK_COUNT:
        raise RuntimeError("canonical chunk count mismatch")
    if logical.get("overlap_samples") != 0 or logical.get("padding_samples") != 0:
        raise RuntimeError("canonical store contains overlap or padding")
    if logical.get("each_source_sample_stored_once") is not True:
        raise RuntimeError("canonical store does not store every source sample exactly once")
    physical = manifest.get("physical_shards", {})
    if physical.get("shard_count") != EXPECTED_SHARD_COUNT or physical.get("total_bytes") != EXPECTED_DATA_BYTES:
        raise RuntimeError("canonical shard contract mismatch")
    if physical.get("compression") != "none":
        raise RuntimeError("canonical shards are compressed")

    if pointer.get("schema") != "guilin-canonical-elevation-store-authority/v1":
        raise RuntimeError("canonical authority pointer schema mismatch")
    if pointer.get("canonical_stream_sha256") != EXPECTED_CANONICAL_SHA256:
        raise RuntimeError("canonical authority pointer SHA mismatch")
    if pointer.get("pixel_mismatch_count") != 0 or pointer.get("maximum_absolute_elevation_difference_m") != 0:
        raise RuntimeError("canonical authority pointer records pixel differences")
    if pointer.get("normal_production_source_tiff_reads_allowed_after_cutover") is not False:
        raise RuntimeError("source TIFF remains enabled in the authority pointer")

    if native_manifest.get("source", {}).get("sha256") != SOURCE_SHA256:
        raise RuntimeError("legacy spatial index source identity mismatch")
    if native_manifest.get("aoi", {}).get("geometry_sha256") != AOI_SHA256:
        raise RuntimeError("legacy spatial index AOI mismatch")
    if native_manifest.get("source", {}).get("resolution_m") != [SOURCE_SPACING_M, SOURCE_SPACING_M]:
        raise RuntimeError("legacy spatial index spacing mismatch")
    if native_manifest.get("source", {}).get("nodata") != SOURCE_NODATA:
        raise RuntimeError("legacy spatial index NoData mismatch")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build Guilin overview and hydrology assets from the canonical elevation store without reading the TIFF"
    )
    parser.add_argument("--elevation-store-manifest", type=Path, required=True)
    parser.add_argument("--native-spatial-index", type=Path, required=True)
    parser.add_argument("--store-pointer", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    native_manifest = json.loads(args.native_spatial_index.read_text(encoding="utf-8"))
    pointer = json.loads(args.store_pointer.read_text(encoding="utf-8"))

    with CanonicalElevationStore(args.elevation_store_manifest) as store:
        validate_store_and_contract(store, native_manifest, pointer)
        overview = build_overview(store, native_manifest, args.output_dir)
        hydrology = build_hydrology(store, native_manifest, args.hydrology, args.output_dir)

    overview_manifest = args.output_dir / "overview-direct-samples-manifest.json"
    hydrology_manifest = args.output_dir / "osm-waterways-manifest.json"
    write_json(overview_manifest, overview)
    write_json(hydrology_manifest, hydrology)

    receipt = {
        "schema": "guilin-continuous-full-map-from-canonical-store-receipt/v1",
        "passed": True,
        "elevation_source_mode": "canonical-pixel-exact-store",
        "source_tiff_read": False,
        "source_tiff_role": "cold-backup-only",
        "source_tiff_sha256": SOURCE_SHA256,
        "canonical_stream_sha256": EXPECTED_CANONICAL_SHA256,
        "aoi_geometry_sha256": AOI_SHA256,
        "native_spacing_m": SOURCE_SPACING_M,
        "canonical_sample_count": EXPECTED_SAMPLE_COUNT,
        "canonical_data_bytes": EXPECTED_DATA_BYTES,
        "canonical_chunk_count": EXPECTED_CHUNK_COUNT,
        "canonical_shard_count": EXPECTED_SHARD_COUNT,
        "canonical_overlap_samples": 0,
        "canonical_padding_samples": 0,
        "canonical_compression": "none",
        "canonical_resampling": "none",
        "canonical_source_elevation_modified_m": 0.0,
        "overview": {
            "grid": overview["asset"]["grid"],
            "bytes": overview["asset"]["bytes"],
            "sha256": overview["asset"]["sha256"],
            "selection": overview["asset"]["selection"],
            "interpolation": overview["asset"]["interpolation"],
            "compression": overview["asset"]["compression"],
            "height_texture": overview["asset"]["height_texture"],
        },
        "hydrology": {
            "record_counts": hydrology["topology"]["record_counts"],
            "record_count_total": hydrology["topology"]["record_count_total"],
            "source_segment_count": hydrology["topology"]["source_segment_count"],
            "segment_count": hydrology["topology"]["segment_count"],
            "dropped_segment_count": hydrology["topology"]["dropped_segment_count"],
            "node_count": hydrology["topology"]["node_count"],
            "lake_surface_asset_count": 0,
            "reservoir_surface_asset_count": 0,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
        },
    }
    write_json(args.output_dir / "CANONICAL_STORE_FULL_MAP_BUILD_RECEIPT.json", receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
