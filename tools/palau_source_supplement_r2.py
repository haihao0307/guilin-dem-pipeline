#!/usr/bin/env python3
"""Palau KAOPU source intake R2.

R2 adds the actually useful processed NOAA bathymetry products, fixes the Open
Waters Seascape raster decoder for 512 px WebP tiles, retries IHO/DCDB CSB
inventory, and writes source-specific measured-point carriers. It does not fuse
sources. Every observation remains an independent voice for PalauWorld.
"""
from __future__ import annotations

import argparse
import array
import gzip
import hashlib
import json
import math
import os
import re
import subprocess
import time
import urllib.parse
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

AOI_WGS84 = (134.22820105775745, 6.792006436378491, 135.00024636263274, 7.890407692444282)
AOI_UTM53 = (414923.1875, 750807.125, 500027.1875, 872182.625)
USER_AGENT = "KAOPU-Palau-Source-Supplement/2.0 (+https://github.com/haihao0307/guilin-dem-pipeline)"
CRUISES = ("EX2505", "EX2506", "EX2507")


@dataclass
class Event:
    stage: str
    status: str
    detail: str
    url: str | None = None
    path: str | None = None
    bytes: int | None = None


class Job:
    def __init__(self, out: Path):
        self.out = out
        self.raw = out / "raw"
        self.derived = out / "derived"
        self.meta = out / "metadata"
        for p in (out, self.raw, self.derived, self.meta):
            p.mkdir(parents=True, exist_ok=True)
        self.events: list[Event] = []
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": USER_AGENT})

    def event(self, stage: str, status: str, detail: str, **kwargs: Any) -> None:
        e = Event(stage, status, detail, **kwargs)
        self.events.append(e)
        print(f"[{stage}] {status}: {detail}", flush=True)

    def request(self, method: str, url: str, *, timeout: int = 180, **kwargs: Any) -> requests.Response:
        last: Exception | None = None
        for attempt in range(5):
            try:
                r = self.s.request(method, url, timeout=timeout, **kwargs)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise RuntimeError(f"HTTP {r.status_code}")
                r.raise_for_status()
                return r
            except Exception as exc:
                last = exc
                time.sleep(2.0 + attempt * 3.0)
        raise RuntimeError(f"request failed {url}: {last}")

    def download(self, url: str, path: Path, *, stage: str, cap: int = 600_000_000) -> bool:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.stat().st_size > 0:
            self.event(stage, "REUSED", path.name, url=url, path=str(path.relative_to(self.out)), bytes=path.stat().st_size)
            return True
        try:
            with self.request("GET", url, timeout=300, stream=True) as r:
                length = int(r.headers.get("content-length", 0) or 0)
                if length and length > cap:
                    self.event(stage, "SKIP_TOO_LARGE", f"{path.name}: {length}", url=url)
                    return False
                tmp = path.with_suffix(path.suffix + ".part")
                total = 0
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1024 * 1024):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > cap:
                            f.close()
                            tmp.unlink(missing_ok=True)
                            self.event(stage, "SKIP_TOO_LARGE", f"{path.name}: >{cap}", url=url)
                            return False
                        f.write(chunk)
                tmp.replace(path)
                self.event(stage, "DOWNLOADED", path.name, url=url, path=str(path.relative_to(self.out)), bytes=total)
                return True
        except Exception as exc:
            self.event(stage, "FAILED", f"{path.name}: {exc}", url=url)
            return False


def dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def list_directory(job: Job, url: str, stage: str) -> list[dict[str, Any]]:
    try:
        r = job.request("GET", url, timeout=180)
    except Exception as exc:
        job.event(stage, "INDEX_FAILED", str(exc), url=url)
        return []
    soup = BeautifulSoup(r.text, "html.parser")
    rows: list[dict[str, Any]] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if href in ("../", "./") or href.startswith("?") or href.startswith("#"):
            continue
        absolute = urllib.parse.urljoin(url, href)
        if not absolute.startswith(url):
            continue
        label = " ".join(a.get_text(" ", strip=True).split())
        row = {"name": label or Path(urllib.parse.urlparse(absolute).path).name, "url": absolute, "directory": absolute.endswith("/")}
        parent_text = " ".join(a.parent.get_text(" ", strip=True).split()) if a.parent else ""
        size = re.search(r"(?<!\d)(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)\b", parent_text, re.I)
        if size:
            n = float(size.group(1))
            unit = size.group(2).upper()
            row["displayBytes"] = int(n * {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}[unit])
        rows.append(row)
    job.event(stage, "INDEXED", f"{url}: {len(rows)} entries", url=url)
    return rows


def discover_product_files(job: Job, cruise: str) -> list[dict[str, Any]]:
    stage = "NOAA_PRODUCTS"
    level = f"https://data.ngdc.noaa.gov/platforms/ocean/ships/okeanos_explorer/{cruise}/multibeam/level_02/"
    direct = level + f"{cruise}_PRODUCT_OER/"
    dirs = [direct]
    direct_rows = list_directory(job, direct, stage)
    if not direct_rows:
        dirs = [r["url"] for r in list_directory(job, level, stage) if r.get("directory") and "PRODUCT" in r.get("name", "").upper()]
    rows: list[dict[str, Any]] = []
    for d in dirs:
        for row in list_directory(job, d, stage):
            row = {**row, "cruise": cruise, "productDirectory": d}
            rows.append(row)
    return rows


def is_primary_xyz(name: str) -> bool:
    u = name.upper()
    return name.lower().endswith(".xyz.gz") and (
        ("FNL" in u and "POLYGON" not in u and "TRANSIT" not in u)
        or ("OTEC" in u and "_FP" not in u)
    )


def select_download(row: dict[str, Any]) -> bool:
    name = row["name"]
    lower = name.lower()
    upper = name.upper()
    if row.get("directory"):
        return False
    if lower.endswith(".tif.gz"):
        return True
    if lower.endswith(".kmz.gz"):
        return True
    if is_primary_xyz(name):
        return True
    # Keep small metadata/checksum files if the product directory exposes them.
    if lower.endswith((".xml", ".txt", ".json", ".md5", ".sha256")):
        return True
    return False


def gdal_info(path: Path) -> dict[str, Any] | None:
    source = f"/vsigzip/{path.resolve()}" if path.name.lower().endswith(".tif.gz") else str(path)
    try:
        p = subprocess.run(["gdalinfo", "-json", source], check=True, capture_output=True, text=True, timeout=240)
        return json.loads(p.stdout)
    except Exception:
        return None


def parse_xyz_to_carrier(job: Job, path: Path, cruise: str) -> dict[str, Any]:
    stage = "NOAA_XYZ_CARRIER"
    west, south, east, north = AOI_WGS84
    out = job.derived / "noaa_multibeam" / f"{path.name[:-7]}_palau_aoi_lonlatz.f32"
    out.parent.mkdir(parents=True, exist_ok=True)
    total = inside = invalid = 0
    z_min = math.inf
    z_max = -math.inf
    x_min = math.inf
    x_max = -math.inf
    y_min = math.inf
    y_max = -math.inf
    swap: bool | None = None
    buf = array.array("f")
    sample: list[list[float]] = []
    with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as src, out.open("wb") as dst:
        for line in src:
            vals = re.findall(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", line)
            if len(vals) < 3:
                continue
            try:
                a, b, z = float(vals[0]), float(vals[1]), float(vals[2])
            except ValueError:
                invalid += 1
                continue
            total += 1
            if swap is None:
                # WGS84 product names are expected lon,lat,z; still protect against lat,lon.
                if abs(a) <= 25 and 100 <= abs(b) <= 180:
                    swap = True
                elif 100 <= abs(a) <= 180 and abs(b) <= 25:
                    swap = False
            lon, lat = (b, a) if swap else (a, b)
            x_min, x_max = min(x_min, lon), max(x_max, lon)
            y_min, y_max = min(y_min, lat), max(y_max, lat)
            z_min, z_max = min(z_min, z), max(z_max, z)
            if len(sample) < 12:
                sample.append([lon, lat, z])
            if west <= lon <= east and south <= lat <= north:
                buf.extend((lon, lat, z))
                inside += 1
                if len(buf) >= 3_000_000:
                    buf.tofile(dst)
                    buf = array.array("f")
        if buf:
            buf.tofile(dst)
    meta = {
        "schema": "kaopu-measured-point-carrier/1.0",
        "sourceCruise": cruise,
        "sourceFile": path.name,
        "sourceSha256": sha256(path),
        "record": "float32 little-endian interleaved longitude,latitude,z",
        "sourceOrderWasSwapped": bool(swap),
        "totalParsedPoints": total,
        "palauAoiPoints": inside,
        "invalidLines": invalid,
        "sourceBounds": [x_min, y_min, x_max, y_max] if total else None,
        "zRangeRaw": [z_min, z_max] if total else None,
        "sampleRaw": sample,
        "aoiWgs84": AOI_WGS84,
        "verticalDatum": "retain source metadata; not normalized in R2",
        "status": "MEASURED_SOURCE_VOICE_NOT_FUSED",
        "binary": str(out.relative_to(job.out)),
    }
    dump(out.with_suffix(".json"), meta)
    job.event(stage, "DERIVED", f"{path.name}: {inside}/{total} points in AOI", path=str(out.relative_to(job.out)), bytes=out.stat().st_size)
    return meta


def intake_noaa_products(job: Job) -> None:
    stage = "NOAA_PRODUCTS"
    inventory: dict[str, Any] = {}
    raster_metadata: dict[str, Any] = {}
    point_carriers: list[dict[str, Any]] = []
    total_cap = 1_600_000_000
    total_downloaded = 0
    for cruise in CRUISES:
        rows = discover_product_files(job, cruise)
        inventory[cruise] = rows
        for row in rows:
            if not select_download(row):
                continue
            name = row["name"] or Path(urllib.parse.urlparse(row["url"]).path).name
            if not name or name.endswith("/"):
                continue
            cap = 500_000_000 if is_primary_xyz(name) else 250_000_000
            if total_downloaded >= total_cap:
                job.event(stage, "TOTAL_CAP_REACHED", f"{total_downloaded} bytes")
                break
            path = job.raw / "noaa_multibeam_products" / cruise / name
            before = path.stat().st_size if path.exists() else 0
            if not job.download(row["url"], path, stage=stage, cap=min(cap, total_cap - total_downloaded)):
                continue
            total_downloaded += max(0, path.stat().st_size - before)
            if name.lower().endswith(".gz"):
                ok = subprocess.run(["gzip", "-t", str(path)], check=False).returncode == 0
                job.event(stage, "GZIP_OK" if ok else "GZIP_BAD", name)
                if not ok:
                    continue
            if name.lower().endswith(".tif.gz"):
                info = gdal_info(path)
                raster_metadata[name] = info or {"status": "gdalinfo-failed"}
            elif is_primary_xyz(name):
                try:
                    point_carriers.append(parse_xyz_to_carrier(job, path, cruise))
                except Exception as exc:
                    job.event("NOAA_XYZ_CARRIER", "FAILED", f"{name}: {exc}")
    dump(job.meta / "NOAA_MULTIBEAM_PRODUCT_INVENTORY_R2.json", inventory)
    dump(job.meta / "NOAA_MULTIBEAM_RASTER_METADATA_R2.json", raster_metadata)
    dump(job.meta / "NOAA_MULTIBEAM_POINT_CARRIERS_R2.json", point_carriers)


def intake_legacy_palau_multibeam(job: Job) -> None:
    stage = "NOAA_LEGACY_PALAU"
    datasets = {
        "RR1606": "https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/gov.noaa.ngdc.mgg.multibeam%3ARR1606_Multibeam/xml",
        "PD20PA01": "https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/gov.noaa.ngdc.mgg.multibeam%3APD20PA01_Multibeam/xml",
        "RR1515": "https://data.ngdc.noaa.gov/platforms/ocean/ships/roger_revelle/RR1515/multibeam/data/version1/metadata/RR1515.xml",
    }
    status = {}
    for name, url in datasets.items():
        p = job.raw / "noaa_legacy_palau" / f"{name}.xml"
        status[name] = {"metadataUrl": url, "downloaded": job.download(url, p, stage=stage, cap=25_000_000)}
    dump(job.meta / "NOAA_LEGACY_PALAU_DATASETS_R2.json", status)


def decode_terrarium(rgb):
    import numpy as np
    return rgb[:, :, 0].astype(np.float32) * 256.0 + rgb[:, :, 1].astype(np.float32) + rgb[:, :, 2].astype(np.float32) / 256.0 - 32768.0


def intake_seascape(job: Job) -> None:
    stage = "OPEN_WATERS_SEASCAPE"
    tilejson_url = "https://tiles.openwaters.io/seascape/raster.json"
    try:
        tj = job.request("GET", tilejson_url).json()
    except Exception as exc:
        job.event(stage, "FAILED", str(exc), url=tilejson_url)
        return
    dump(job.meta / "OPEN_WATERS_RASTER_TILEJSON_R2.json", tj)
    try:
        import mercantile
        import numpy as np
        import rasterio
        from PIL import Image
        from rasterio.enums import Resampling
        from rasterio.transform import from_origin
        from rasterio.warp import reproject

        z = 10
        west, south, east, north = AOI_WGS84
        tiles = list(mercantile.tiles(west, south, east, north, zooms=z))
        template = tj["tiles"][0]
        arrays: dict[tuple[int, int], Any] = {}
        tile_size = None
        for t in tiles:
            url = template.replace("{z}", str(t.z)).replace("{x}", str(t.x)).replace("{y}", str(t.y))
            suffix = Path(urllib.parse.urlparse(url).path).suffix or ".webp"
            p = job.raw / "openwaters_seascape_r2" / str(z) / str(t.x) / f"{t.y}{suffix}"
            if not job.download(url, p, stage=stage, cap=8_000_000):
                continue
            arr = np.asarray(Image.open(p).convert("RGB"), dtype=np.uint8)
            if arr.shape[0] != arr.shape[1]:
                job.event(stage, "BAD_TILE", f"{p.name}: {arr.shape}")
                continue
            tile_size = tile_size or arr.shape[0]
            if arr.shape[0] != tile_size:
                arr = np.asarray(Image.fromarray(arr).resize((tile_size, tile_size), Image.Resampling.BILINEAR))
            arrays[(t.x, t.y)] = decode_terrarium(arr)
        if not arrays or tile_size is None:
            raise RuntimeError("no valid tiles")
        xs = [q[0] for q in arrays]
        ys = [q[1] for q in arrays]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        mosaic = np.full(((maxy - miny + 1) * tile_size, (maxx - minx + 1) * tile_size), np.nan, dtype=np.float32)
        for (x, y), arr in arrays.items():
            r0 = (y - miny) * tile_size
            c0 = (x - minx) * tile_size
            mosaic[r0:r0 + tile_size, c0:c0 + tile_size] = arr
        nw = mercantile.xy_bounds(minx, miny, z)
        se = mercantile.xy_bounds(maxx, maxy, z)
        pixel = (se.right - nw.left) / mosaic.shape[1]
        src_transform = from_origin(nw.left, nw.top, pixel, pixel)
        xmin, ymin, xmax, ymax = AOI_UTM53
        dst_res = 100.0
        width = math.ceil((xmax - xmin) / dst_res)
        height = math.ceil((ymax - ymin) / dst_res)
        dst = np.full((height, width), -9999.0, dtype=np.float32)
        dst_transform = from_origin(xmin, ymax, dst_res, dst_res)
        reproject(source=mosaic, destination=dst, src_transform=src_transform, src_crs="EPSG:3857", dst_transform=dst_transform, dst_crs="EPSG:32653", src_nodata=np.nan, dst_nodata=-9999.0, resampling=Resampling.bilinear)
        tif = job.derived / "openwaters_seascape" / "palau_seascape_approx_100m_utm53_r2.tif"
        tif.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(tif, "w", driver="GTiff", width=width, height=height, count=1, dtype="float32", crs="EPSG:32653", transform=dst_transform, nodata=-9999.0, compress="DEFLATE", predictor=3, tiled=True, blockxsize=256, blockysize=256) as f:
            f.write(dst, 1)
            f.set_band_description(1, "approximate_seafloor_elevation_m_mixed_sources_not_chart_datum")
            f.update_tags(source="Open Waters Seascape", license="CC BY 4.0 compilation; preserve underlying source attribution", role="LOW_FREQUENCY_BASELINE_ONLY")
        valid = dst[dst > -9000]
        lo, hi = (np.percentile(valid, [2, 98]) if valid.size else (-5000, 100))
        vis = np.clip((dst - lo) * 255 / max(1.0, hi - lo), 0, 255).astype(np.uint8)
        vis[dst <= -9000] = 0
        preview = job.derived / "openwaters_seascape" / "palau_seascape_preview_r2.png"
        Image.fromarray(vis).save(preview)
        dump(job.meta / "OPEN_WATERS_SEASCAPE_R2.json", {"zoom": z, "tileSize": tile_size, "tileCount": len(arrays), "output": str(tif.relative_to(job.out)), "validPixels": int(valid.size), "rangeM": [float(valid.min()), float(valid.max())] if valid.size else None, "status": "APPROXIMATE_LOW_FREQUENCY_NOT_MEASURED_TRUTH"})
        job.event(stage, "DERIVED", f"{len(arrays)} x {tile_size}px tiles -> UTM53 100m", path=str(tif.relative_to(job.out)), bytes=tif.stat().st_size)
    except Exception as exc:
        job.event(stage, "MOSAIC_FAILED", str(exc))


def retry_csb(job: Job) -> None:
    stage = "IHO_DCDB_CSB"
    base = "https://q81rej0j12.execute-api.us-east-1.amazonaws.com"
    bbox = ",".join(str(x) for x in AOI_WGS84)
    attempts = []
    for method, endpoint, kwargs in [
        ("GET", "/count", {"params": {"bbox": bbox}}),
        ("GET", "/platforms", {"params": {"bbox": bbox}}),
        ("GET", "/count", {"params": {"bbox": bbox, "datasets": "csb"}}),
    ]:
        url = base + endpoint
        try:
            r = job.request(method, url, timeout=120, **kwargs)
            payload = r.json()
            attempts.append({"method": method, "endpoint": endpoint, "kwargs": kwargs, "success": True, "payload": payload})
            job.event(stage, "DISCOVERED", f"{endpoint}: {payload}", url=url)
        except Exception as exc:
            attempts.append({"method": method, "endpoint": endpoint, "kwargs": kwargs, "success": False, "error": str(exc)})
            job.event(stage, "FAILED", f"{endpoint}: {exc}", url=url)
    # Record the public S3 fallback without recursively enumerating a >70 TB archive.
    attempts.append({"fallback": "s3://noaa-dcdb-bathymetry-pds", "policy": "inventory only until API recovers; do not recursively download the global archive"})
    dump(job.meta / "IHO_DCDB_CSB_RETRY_R2.json", attempts)


def summarize(job: Job) -> None:
    files = []
    for p in sorted(job.out.rglob("*")):
        if p.is_file() and p.name != "R2_DOWNLOAD_REPORT.json":
            files.append({"path": str(p.relative_to(job.out)), "bytes": p.stat().st_size, "sha256": sha256(p)})
    report = {
        "schema": "palau-kaopu-source-supplement/2.0",
        "aoiWgs84": AOI_WGS84,
        "aoiUtm53": AOI_UTM53,
        "events": [asdict(e) for e in job.events],
        "files": files,
        "downloaded": sum(e.status == "DOWNLOADED" for e in job.events),
        "derived": sum(e.status == "DERIVED" for e in job.events),
        "failed": sum("FAILED" in e.status or e.status in ("GZIP_BAD", "BAD_TILE") for e in job.events),
        "singleConductor": "PalauWorld.sample(E,N,Z,time,observationBand)",
        "boundary": "R2 preserves source-specific observations. No interpolation, datum normalization or cross-source averaging is accepted as canonical truth here.",
    }
    dump(job.meta / "R2_DOWNLOAD_REPORT.json", report)
    (job.out / "README.md").write_text(
        "# Palau KAOPU Source Supplement R2\n\n"
        "This supplement adds processed NOAA EX2505/EX2506/EX2507 multibeam products, source-specific point carriers clipped to the current Palau AOI, a corrected Open Waters Seascape low-frequency raster, and retry receipts for IHO/DCDB CSB.\n\n"
        "It is not a fused seabed. Measured multibeam, official chart constraints, crowdsourced soundings, optical evidence and approximate background bathymetry remain independent voices under one PalauWorld conductor.\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    job = Job(args.out)
    for fn in (intake_noaa_products, intake_legacy_palau_multibeam, intake_seascape, retry_csb):
        try:
            fn(job)
        except Exception as exc:
            job.event(fn.__name__, "UNHANDLED_FAILED", repr(exc))
    summarize(job)
    payload = [p for p in job.raw.rglob("*") if p.is_file()] + [p for p in job.derived.rglob("*") if p.is_file()]
    print(json.dumps({"payloadFiles": len(payload), "events": len(job.events)}, indent=2))
    return 0 if payload else 2


if __name__ == "__main__":
    raise SystemExit(main())
