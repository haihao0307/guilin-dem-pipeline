from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import json
import math
import shutil
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import rasterio
from rasterio.shutil import copy as rio_copy

from common import read_json, sha256_file, utc_now, write_json

USER_AGENT = "Haihao-DEM-Pipeline/1.1 (temporary AWS Terrain Tiles fallback)"
BASE_URL = "https://elevation-tiles-prod.s3.amazonaws.com/skadi"


class PipelineError(RuntimeError):
    pass


def tile_code(latitude: int, longitude: int) -> tuple[str, str]:
    lat_code = ("N" if latitude >= 0 else "S") + f"{abs(latitude):02d}"
    lon_code = ("E" if longitude >= 0 else "W") + f"{abs(longitude):03d}"
    return lat_code, f"{lat_code}{lon_code}"


def gzip_is_valid(path: Path) -> bool:
    try:
        with gzip.open(path, "rb") as stream:
            while stream.read(4 * 1024 * 1024):
                pass
        return True
    except (EOFError, gzip.BadGzipFile, OSError):
        return False


def curl_content_length(curl: str, url: str) -> int:
    completed = subprocess.run(
        [curl, "--head", "--fail", "--location", "--silent", "--show-error", "--max-time", "30", url],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise OSError(f"curl HEAD exited with code {completed.returncode}")
    lengths = []
    for line in completed.stdout.splitlines():
        if line.lower().startswith("content-length:"):
            try:
                lengths.append(int(line.split(":", 1)[1].strip()))
            except ValueError:
                pass
    if not lengths or max(lengths) <= 1024:
        raise OSError("download size is unavailable")
    return max(lengths)


def curl_segmented_download(curl: str, url: str, partial: Path, workers: int = 12) -> None:
    total_bytes = curl_content_length(curl, url)
    chunk_size = 1024 * 1024
    chunk_dir = partial.parent / f"{partial.name}.chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    ranges = [
        (index, start, min(start + chunk_size - 1, total_bytes - 1))
        for index, start in enumerate(range(0, total_bytes, chunk_size))
    ]

    def fetch(item: tuple[int, int, int]) -> Path:
        index, start, end = item
        chunk = chunk_dir / f"{index:04d}.part"
        expected = end - start + 1
        if chunk.exists() and chunk.stat().st_size == expected:
            return chunk
        chunk.unlink(missing_ok=True)
        completed = subprocess.run(
            [
                curl,
                "--fail",
                "--location",
                "--silent",
                "--show-error",
                "--connect-timeout",
                "20",
                "--max-time",
                "600",
                "--retry",
                "5",
                "--retry-all-errors",
                "--range",
                f"{start}-{end}",
                "--user-agent",
                USER_AGENT,
                "--output",
                str(chunk),
                url,
            ],
            check=False,
        )
        if completed.returncode != 0 or not chunk.exists() or chunk.stat().st_size != expected:
            actual = chunk.stat().st_size if chunk.exists() else 0
            chunk.unlink(missing_ok=True)
            raise OSError(f"range {start}-{end} failed: curl={completed.returncode}, bytes={actual}/{expected}")
        return chunk

    print(f"并行分段下载：{len(ranges)} 段，{workers} 路")
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, len(ranges))) as pool:
        chunks = list(pool.map(fetch, ranges))
    with partial.open("wb") as destination:
        for chunk in chunks:
            with chunk.open("rb") as source:
                shutil.copyfileobj(source, destination, length=4 * 1024 * 1024)
    if partial.stat().st_size != total_bytes:
        raise OSError(f"merged download has unexpected size: {partial.stat().st_size}/{total_bytes}")
    for chunk in chunks:
        chunk.unlink(missing_ok=True)
    try:
        chunk_dir.rmdir()
    except OSError:
        pass


def download(url: str, target: Path, attempts: int = 4) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 1024 and gzip_is_valid(target):
        return
    target.unlink(missing_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    for attempt in range(1, attempts + 1):
        try:
            partial.unlink(missing_ok=True)
            curl = shutil.which("curl.exe") or shutil.which("curl")
            if curl:
                curl_segmented_download(curl, url, partial)
            else:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
                with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as stream:
                    shutil.copyfileobj(response, stream, length=4 * 1024 * 1024)
            if partial.stat().st_size <= 1024:
                raise PipelineError(f"empty fallback tile: {url}")
            if not gzip_is_valid(partial):
                raise OSError("downloaded gzip tile is truncated or corrupt")
            partial.replace(target)
            return
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, PipelineError) as exc:
            partial.unlink(missing_ok=True)
            if attempt >= attempts:
                raise PipelineError(f"fallback tile download failed: {url}: {exc}") from exc
            time.sleep(attempt * 3)


def convert_hgt_gz(gzip_path: Path, hgt_path: Path, tif_path: Path) -> dict[str, Any]:
    with gzip_path.open("rb") as stream:
        stream.seek(-4, 2)
        expected_hgt_bytes = struct.unpack("<I", stream.read(4))[0]
    if not hgt_path.exists() or hgt_path.stat().st_size != expected_hgt_bytes:
        hgt_partial = hgt_path.with_suffix(hgt_path.suffix + ".part")
        hgt_partial.unlink(missing_ok=True)
        with gzip.open(gzip_path, "rb") as source, hgt_partial.open("wb") as destination:
            shutil.copyfileobj(source, destination, length=4 * 1024 * 1024)
        if hgt_partial.stat().st_size != expected_hgt_bytes:
            hgt_partial.unlink(missing_ok=True)
            raise PipelineError(f"decompressed tile has unexpected size: {gzip_path.name}")
        hgt_partial.replace(hgt_path)
    if tif_path.exists() and tif_path.stat().st_size > 1024:
        with rasterio.open(tif_path) as dataset:
            return {
                "file": str(tif_path),
                "bytes": tif_path.stat().st_size,
                "sha256": sha256_file(tif_path),
                "crs": dataset.crs.to_string() if dataset.crs else None,
                "resolution": [abs(dataset.transform.a), abs(dataset.transform.e)],
                "bounds": list(dataset.bounds),
            }

    with rasterio.open(hgt_path) as source:
        profile = source.profile.copy()
        block = min(512, source.width, source.height)
        profile.update(
            driver="GTiff",
            compress="DEFLATE",
            predictor=2,
            tiled=True,
            blockxsize=block,
            blockysize=block,
            BIGTIFF="IF_SAFER",
            nodata=source.nodata if source.nodata is not None else -32768,
        )
        tif_path.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(tif_path, "w", **profile) as destination:
            destination.update_tags(
                SOURCE_PROVIDER="AWS Open Data Terrain Tiles",
                SOURCE_FORMAT="Mapzen Skadi SRTM HGT",
                SOURCE_ROLE="TEMPORARY_COMPLETE_RANGE_FALLBACK",
                NATIVE_12_5M_SURVEY_CLAIM="false",
            )
            for _, window in source.block_windows(1):
                destination.write(source.read(1, window=window), 1, window=window)

    with rasterio.open(tif_path) as dataset:
        return {
            "file": str(tif_path),
            "bytes": tif_path.stat().st_size,
            "sha256": sha256_file(tif_path),
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "resolution": [abs(dataset.transform.a), abs(dataset.transform.e)],
            "bounds": list(dataset.bounds),
        }


def run(config_path: Path, root: Path) -> int:
    config = read_json(config_path)
    resolved = read_json(root / config["outputs"]["resolvedAoiJson"])
    final = resolved.get("final", {})
    bounds = final.get("bounds")
    if not isinstance(bounds, list) or len(bounds) != 4:
        raise PipelineError("resolved AOI bounds are unavailable")
    min_lon, min_lat, max_lon, max_lat = (float(value) for value in bounds)

    lon_values = range(math.floor(min_lon), math.ceil(max_lon))
    lat_values = range(math.floor(min_lat), math.ceil(max_lat))
    raw_dir = root / "data" / "raw" / "mapzen"
    dem_dir = root / "data" / "raw" / "dem"
    records: list[dict[str, Any]] = []

    for latitude in lat_values:
        for longitude in lon_values:
            lat_dir, code = tile_code(latitude, longitude)
            gz_name = f"{code}.hgt.gz"
            url = f"{BASE_URL}/{lat_dir}/{gz_name}"
            gzip_path = raw_dir / lat_dir / gz_name
            hgt_path = raw_dir / lat_dir / f"{code}.hgt"
            tif_path = dem_dir / f"MAPZEN_{code}_dem.tif"
            print(f"临时完整范围源片：{code}")
            download(url, gzip_path)
            record = convert_hgt_gz(gzip_path, hgt_path, tif_path)
            record.update({"tile": code, "url": url})
            records.append(record)

    runtime_source = {
        "mode": "mapzen_skadi_fallback",
        "status": "temporary_complete_range_preview",
        "productLabel": "AWS Terrain Tiles约30米临时完整范围DEM",
        "provider": "AWS Open Data Terrain Tiles, Mapzen Skadi",
        "dataset": "Global bare-earth terrain tiles assembled from open elevation sources",
        "nativeResolutionApproxMeters": 30,
        "outputPixelSpacingMeters": 30,
        "native12_5mSurveyClaim": False,
        "temporaryFallback": True,
        "replacementPolicy": "EARTHDATA_TOKEN可用后由ASF RTC_HI_RES参考DEM整体替换",
        "attribution": "Terrain Tiles on AWS, Mapzen and upstream source attributions",
    }
    write_json(root / "metadata" / "runtime_source.json", runtime_source)
    write_json(
        root / config["outputs"]["sourceManifest"],
        {
            "schemaVersion": "1.1.0",
            "generatedAt": utc_now(),
            "project": config["project"],
            "runtimeSource": runtime_source,
            "tiles": records,
        },
    )
    write_json(
        root / "reports" / "DOWNLOAD_STATUS.json",
        {
            "generatedAt": utc_now(),
            "status": "fallback_dem_download_complete",
            "tileCount": len(records),
            "rawDemDirectory": str(dem_dir),
        },
    )
    print(f"临时完整范围源片下载完成，共 {len(records)} 张。")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download an unauthenticated temporary full-range DEM fallback")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(Path(args.config).resolve(), Path(args.root).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
