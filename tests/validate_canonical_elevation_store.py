from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.windows import Window

SOURCE_FILE = "guilin_raw_union_12_5m.tif"
SOURCE_BYTES = 124_348_471
SOURCE_SHA256 = "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4"
SOURCE_CRS = "EPSG:32649"
SOURCE_GRID = [17_408, 18_867]
SOURCE_NODATA = 0
SOURCE_SPACING_M = 12.5
AOI_SHA256 = "36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80"
AOI_WINDOW = [2_438, 949, 11_983, 17_685]
CHUNK_SIZE = 512
EXPECTED_SAMPLE_COUNT = AOI_WINDOW[2] * AOI_WINDOW[3]
EXPECTED_DATA_BYTES = EXPECTED_SAMPLE_COUNT * 2
EXPECTED_CHUNK_ROWS = math.ceil(AOI_WINDOW[3] / CHUNK_SIZE)
EXPECTED_CHUNK_COLUMNS = math.ceil(AOI_WINDOW[2] / CHUNK_SIZE)
EXPECTED_CHUNK_COUNT = EXPECTED_CHUNK_ROWS * EXPECTED_CHUNK_COLUMNS


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_manifest_structure(root: Path, manifest: dict[str, Any]) -> dict[tuple[int, int], dict[str, Any]]:
    if manifest.get("schema") != "guilin-canonical-elevation-store/v1":
        raise RuntimeError("canonical store schema mismatch")
    if manifest.get("source_cold_backup", {}).get("sha256") != SOURCE_SHA256:
        raise RuntimeError("cold source identity mismatch")
    if manifest.get("aoi", {}).get("geometry_sha256") != AOI_SHA256:
        raise RuntimeError("AOI identity mismatch")
    if manifest.get("aoi", {}).get("source_window") != AOI_WINDOW:
        raise RuntimeError("AOI source window mismatch")
    if manifest.get("aoi", {}).get("sample_count") != EXPECTED_SAMPLE_COUNT:
        raise RuntimeError("AOI sample count mismatch")
    stream = manifest.get("canonical_row_major_stream", {})
    if stream.get("bytes") != EXPECTED_DATA_BYTES or stream.get("sample_count") != EXPECTED_SAMPLE_COUNT:
        raise RuntimeError("canonical stream size mismatch")
    for key in ("compression", "resampling", "quantization", "interpolation"):
        if stream.get(key) != "none":
            raise RuntimeError(f"canonical stream {key} must be none")
    logical = manifest.get("logical_chunks", {})
    expected = {
        "matrix_rows": EXPECTED_CHUNK_ROWS,
        "matrix_columns": EXPECTED_CHUNK_COLUMNS,
        "chunk_count": EXPECTED_CHUNK_COUNT,
        "overlap_samples": 0,
        "padding_samples": 0,
        "each_source_sample_stored_once": True,
        "total_bytes": EXPECTED_DATA_BYTES,
    }
    for key, value in expected.items():
        if logical.get(key) != value:
            raise RuntimeError(f"logical chunk contract mismatch: {key}={logical.get(key)!r}")

    shard_map: dict[str, dict[str, Any]] = {}
    shard_total = 0
    for shard in manifest.get("physical_shards", {}).get("shards", []):
        path = root / shard["file"]
        if not path.is_file():
            raise RuntimeError(f"missing shard: {path}")
        if path.stat().st_size != int(shard["bytes"]):
            raise RuntimeError(f"shard size mismatch: {path}")
        if sha256_file(path) != shard["sha256"]:
            raise RuntimeError(f"shard SHA256 mismatch: {path}")
        if shard.get("compression") != "none":
            raise RuntimeError(f"compressed shard: {path}")
        shard_map[shard["file"]] = shard
        shard_total += int(shard["bytes"])
    if shard_total != EXPECTED_DATA_BYTES:
        raise RuntimeError(f"physical shard byte total mismatch: {shard_total}")

    chunk_map: dict[tuple[int, int], dict[str, Any]] = {}
    per_shard_ranges: dict[str, list[tuple[int, int, str]]] = {}
    for chunk in manifest.get("chunks", []):
        row, column = [int(value) for value in chunk["matrix_index"]]
        key = (row, column)
        if key in chunk_map:
            raise RuntimeError(f"duplicate chunk matrix index: {key}")
        if not (0 <= row < EXPECTED_CHUNK_ROWS and 0 <= column < EXPECTED_CHUNK_COLUMNS):
            raise RuntimeError(f"chunk matrix index out of range: {key}")
        relative_column = column * CHUNK_SIZE
        relative_row = row * CHUNK_SIZE
        width = min(CHUNK_SIZE, AOI_WINDOW[2] - relative_column)
        height = min(CHUNK_SIZE, AOI_WINDOW[3] - relative_row)
        expected_aoi_window = [relative_column, relative_row, width, height]
        expected_source_window = [AOI_WINDOW[0] + relative_column, AOI_WINDOW[1] + relative_row, width, height]
        if chunk.get("aoi_window") != expected_aoi_window:
            raise RuntimeError(f"chunk AOI window mismatch: {chunk['id']}")
        if chunk.get("source_window") != expected_source_window:
            raise RuntimeError(f"chunk source window mismatch: {chunk['id']}")
        expected_bytes = width * height * 2
        if int(chunk.get("bytes", -1)) != expected_bytes:
            raise RuntimeError(f"chunk bytes mismatch: {chunk['id']}")
        if int(chunk.get("sample_count", -1)) != width * height:
            raise RuntimeError(f"chunk sample count mismatch: {chunk['id']}")
        if chunk.get("padding_samples") != 0 or chunk.get("shared_edge_duplicate_samples") != 0:
            raise RuntimeError(f"chunk padding or overlap detected: {chunk['id']}")
        if chunk.get("compression") != "none" or chunk.get("resampling") != "none" or chunk.get("quantization") != "none":
            raise RuntimeError(f"chunk transformation detected: {chunk['id']}")
        shard_name = chunk["shard"]
        if shard_name not in shard_map:
            raise RuntimeError(f"chunk references unknown shard: {chunk['id']}")
        offset = int(chunk["shard_byte_offset"])
        if offset < 0 or offset + expected_bytes > int(shard_map[shard_name]["bytes"]):
            raise RuntimeError(f"chunk byte range outside shard: {chunk['id']}")
        per_shard_ranges.setdefault(shard_name, []).append((offset, offset + expected_bytes, chunk["id"]))
        chunk_map[key] = chunk
    if len(chunk_map) != EXPECTED_CHUNK_COUNT:
        raise RuntimeError(f"chunk count mismatch: {len(chunk_map)}")
    for shard_name, ranges in per_shard_ranges.items():
        ranges.sort()
        cursor = 0
        for start, stop, chunk_id in ranges:
            if start != cursor:
                raise RuntimeError(f"shard gap or overlap before {chunk_id}: {start} != {cursor}")
            cursor = stop
        if cursor != int(shard_map[shard_name]["bytes"]):
            raise RuntimeError(f"unused bytes at end of shard {shard_name}")
    return chunk_map


def read_chunk(root: Path, chunk: dict[str, Any]) -> np.ndarray:
    path = root / chunk["shard"]
    offset = int(chunk["shard_byte_offset"])
    byte_count = int(chunk["bytes"])
    with path.open("rb") as handle:
        handle.seek(offset)
        raw = handle.read(byte_count)
    if len(raw) != byte_count:
        raise RuntimeError(f"short chunk read: {chunk['id']}")
    if hashlib.sha256(raw).hexdigest() != chunk["sha256"]:
        raise RuntimeError(f"chunk SHA256 mismatch: {chunk['id']}")
    width, height = [int(value) for value in chunk["grid"]]
    return np.frombuffer(raw, dtype="<i2").reshape((height, width))


def validate_store(root: Path, manifest: dict[str, Any], source: Path | None, reconstruction: Path | None) -> dict[str, Any]:
    chunk_map = validate_manifest_structure(root, manifest)
    store_digest = hashlib.sha256()
    source_digest = hashlib.sha256()
    mismatch_count = 0
    max_abs_difference = 0
    reconstructed_bytes = 0
    reconstruction_handle = reconstruction.open("wb") if reconstruction else None
    dataset = rasterio.open(source) if source else None
    try:
        if dataset is not None:
            if source is None or source.name != SOURCE_FILE or source.stat().st_size != SOURCE_BYTES:
                raise RuntimeError("source identity mismatch")
            if sha256_file(source) != SOURCE_SHA256:
                raise RuntimeError("source SHA256 mismatch")
            if str(dataset.crs) != SOURCE_CRS or [dataset.width, dataset.height] != SOURCE_GRID:
                raise RuntimeError("source grid or CRS mismatch")
            if dataset.dtypes[0] != "int16" or dataset.nodata != SOURCE_NODATA:
                raise RuntimeError("source dtype or NoData mismatch")

        for chunk_row in range(EXPECTED_CHUNK_ROWS):
            row_start = chunk_row * CHUNK_SIZE
            height = min(CHUNK_SIZE, AOI_WINDOW[3] - row_start)
            block = np.empty((height, AOI_WINDOW[2]), dtype="<i2")
            for chunk_column in range(EXPECTED_CHUNK_COLUMNS):
                chunk = chunk_map[(chunk_row, chunk_column)]
                values = read_chunk(root, chunk)
                column_start = chunk_column * CHUNK_SIZE
                width = values.shape[1]
                block[:, column_start:column_start + width] = values
                if dataset is not None:
                    source_window = chunk["source_window"]
                    source_values = dataset.read(
                        1,
                        window=Window(*source_window),
                        boundless=False,
                    ).astype("<i2", copy=False)
                    difference = values.astype(np.int32) - source_values.astype(np.int32)
                    mismatch_count += int(np.count_nonzero(difference))
                    if difference.size:
                        max_abs_difference = max(max_abs_difference, int(np.abs(difference).max()))
            raw_block = block.tobytes(order="C")
            store_digest.update(raw_block)
            reconstructed_bytes += len(raw_block)
            if reconstruction_handle is not None:
                reconstruction_handle.write(raw_block)
            if dataset is not None:
                source_block = dataset.read(
                    1,
                    window=Window(AOI_WINDOW[0], AOI_WINDOW[1] + row_start, AOI_WINDOW[2], height),
                    boundless=False,
                ).astype("<i2", copy=False)
                source_digest.update(source_block.tobytes(order="C"))
                difference = block.astype(np.int32) - source_block.astype(np.int32)
                mismatch_count += int(np.count_nonzero(difference))
                if difference.size:
                    max_abs_difference = max(max_abs_difference, int(np.abs(difference).max()))
    finally:
        if reconstruction_handle is not None:
            reconstruction_handle.flush()
            reconstruction_handle.close()
        if dataset is not None:
            dataset.close()

    if reconstructed_bytes != EXPECTED_DATA_BYTES:
        raise RuntimeError(f"reconstruction byte count mismatch: {reconstructed_bytes}")
    store_sha = store_digest.hexdigest()
    expected_sha = manifest["canonical_row_major_stream"]["sha256"]
    if store_sha != expected_sha:
        raise RuntimeError(f"store canonical SHA mismatch: {store_sha}")
    source_sha = source_digest.hexdigest() if source is not None else None
    if source_sha is not None and source_sha != expected_sha:
        raise RuntimeError(f"source canonical SHA mismatch: {source_sha}")
    if mismatch_count != 0 or max_abs_difference != 0:
        raise RuntimeError(f"pixel mismatch: count={mismatch_count}, max_abs={max_abs_difference}")
    if reconstruction is not None:
        if reconstruction.stat().st_size != EXPECTED_DATA_BYTES:
            raise RuntimeError("reconstruction file byte count mismatch")
        if sha256_file(reconstruction) != expected_sha:
            raise RuntimeError("reconstruction SHA256 mismatch")

    return {
        "schema": "guilin-canonical-elevation-store-validation/v1",
        "passed": True,
        "source_pixel_comparison_performed": source is not None,
        "source_sha256": SOURCE_SHA256 if source is not None else None,
        "aoi_geometry_sha256": AOI_SHA256,
        "sample_count": EXPECTED_SAMPLE_COUNT,
        "data_bytes": EXPECTED_DATA_BYTES,
        "chunk_count": EXPECTED_CHUNK_COUNT,
        "chunk_rows": EXPECTED_CHUNK_ROWS,
        "chunk_columns": EXPECTED_CHUNK_COLUMNS,
        "shard_count": len(manifest["physical_shards"]["shards"]),
        "all_shard_sha256_verified": True,
        "all_chunk_sha256_verified": True,
        "pixel_mismatch_count": mismatch_count,
        "maximum_absolute_elevation_difference_m": max_abs_difference,
        "source_canonical_stream_sha256": source_sha,
        "store_reconstructed_stream_sha256": store_sha,
        "manifest_canonical_stream_sha256": expected_sha,
        "reconstructed_raw_file_bytes": reconstructed_bytes if reconstruction is not None else None,
        "overlap_samples": 0,
        "padding_samples": 0,
        "compression": "none",
        "resampling": "none",
        "quantization": "none",
        "interpolation": "none",
        "source_elevation_modified_m": 0.0,
        "cutover_ready": source is not None,
        "post_cutover_source_tiff_role": "cold_backup_only",
        "post_cutover_daily_source_tiff_reads_allowed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and reconstruct the Guilin canonical elevation store")
    parser.add_argument("--store-dir", type=Path, required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--reconstruction", type=Path)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    manifest_path = args.store_dir / "CANONICAL_ELEVATION_MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    receipt = validate_store(args.store_dir, manifest, args.source, args.reconstruction)
    write_json(args.receipt, receipt)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
