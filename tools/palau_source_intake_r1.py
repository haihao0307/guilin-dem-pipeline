#!/usr/bin/env python3
"""First-round Palau evidence intake for the KAOPU single-conductor world field.

This script intentionally keeps unlike observations separate. It downloads open
source/authority data, records licensing and datum caveats, and produces one
manifest for later distillation into PalauWorld. It does not average sources or
pretend chart/satellite observations are a continuous terrain truth.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.parse
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

AOI_WGS84 = (134.22820105775745, 6.792006436378491, 135.00024636263274, 7.890407692444282)
AOI_UTM53 = (414923.1875, 750807.125, 500027.1875, 872182.625)
TODAY = "2026-09-20"
USER_AGENT = "KAOPU-Palau-Source-Intake/1.0 (+https://github.com/haihao0307/guilin-dem-pipeline)"


@dataclass
class Event:
    stage: str
    status: str
    detail: str
    url: str | None = None
    path: str | None = None
    bytes: int | None = None


class Intake:
    def __init__(self, out: Path):
        self.out = out
        self.raw = out / "raw"
        self.derived = out / "derived"
        self.meta = out / "metadata"
        for p in (self.out, self.raw, self.derived, self.meta):
            p.mkdir(parents=True, exist_ok=True)
        self.events: list[Event] = []
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def event(self, stage: str, status: str, detail: str, **kwargs: Any) -> None:
        e = Event(stage=stage, status=status, detail=detail, **kwargs)
        self.events.append(e)
        print(f"[{stage}] {status}: {detail}", flush=True)

    def request(self, method: str, url: str, *, timeout: int = 120, **kwargs: Any) -> requests.Response:
        last: Exception | None = None
        for attempt in range(4):
            try:
                r = self.session.request(method, url, timeout=timeout, **kwargs)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise RuntimeError(f"HTTP {r.status_code}")
                r.raise_for_status()
                return r
            except Exception as exc:
                last = exc
                time.sleep(2.5 * (attempt + 1))
        raise RuntimeError(f"request failed: {url}: {last}")

    def download(self, url: str, path: Path, *, max_bytes: int = 500_000_000, stage: str = "download") -> bool:
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with self.request("GET", url, timeout=180, stream=True) as r:
                length = int(r.headers.get("content-length", 0) or 0)
                if length and length > max_bytes:
                    self.event(stage, "SKIP_TOO_LARGE", f"{length} bytes", url=url)
                    return False
                tmp = path.with_suffix(path.suffix + ".part")
                total = 0
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1024 * 1024):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > max_bytes:
                            f.close()
                            tmp.unlink(missing_ok=True)
                            self.event(stage, "SKIP_TOO_LARGE", f">{max_bytes} bytes", url=url)
                            return False
                        f.write(chunk)
                tmp.replace(path)
                self.event(stage, "DOWNLOADED", path.name, url=url, path=str(path.relative_to(self.out)), bytes=total)
                return True
        except Exception as exc:
            self.event(stage, "FAILED", str(exc), url=url)
            return False


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_")[:140]


def intersects(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def intake_osm(job: Intake) -> None:
    stage = "OSM_MARINE"
    south, west, north, east = AOI_WGS84[1], AOI_WGS84[0], AOI_WGS84[3], AOI_WGS84[2]
    bbox = f"{south},{west},{north},{east}"
    query = f"""[out:json][timeout:240];(
      nwr[\"natural\"~\"reef|shoal|beach|sand|bare_rock|rock|wetland|coastline\"]({bbox});
      nwr[\"wetland\"=\"mangrove\"]({bbox});
      nwr[\"place\"~\"island|islet\"]({bbox});
      nwr[\"seamark:type\"]({bbox});
      nwr[\"man_made\"~\"pier|breakwater|groyne|lighthouse\"]({bbox});
      nwr[\"harbour\"]({bbox});
      nwr[\"tourism\"=\"dive_site\"]({bbox});
      nwr[\"wreck\"]({bbox});
      nwr[\"depth\"]({bbox});
    );out body geom qt;"""
    (job.meta / "OSM_QUERY.overpassql").write_text(query, encoding="utf-8")
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter",
    ]
    data = None
    used = None
    for endpoint in endpoints:
        try:
            r = job.request("POST", endpoint, timeout=300, data={"data": query})
            data = r.json()
            used = endpoint
            break
        except Exception as exc:
            job.event(stage, "ENDPOINT_FAILED", str(exc), url=endpoint)
    if data is None:
        job.event(stage, "FAILED", "all Overpass endpoints failed")
        return
    raw_path = job.raw / "osm" / "palau_marine_overpass.json"
    write_json(raw_path, data)
    job.event(stage, "DOWNLOADED", f"{len(data.get('elements', []))} OSM elements", url=used, path=str(raw_path.relative_to(job.out)), bytes=raw_path.stat().st_size)
    try:
        import osm2geojson

        geo = osm2geojson.json2geojson(data)
        out = job.derived / "osm" / "palau_marine.geojson"
        write_json(out, geo)
        job.event(stage, "DERIVED", f"GeoJSON features={len(geo.get('features', []))}", path=str(out.relative_to(job.out)), bytes=out.stat().st_size)
    except Exception as exc:
        job.event(stage, "CONVERT_FAILED", str(exc))


def parse_enc_catalog(text: str) -> set[str]:
    # Product catalogs have changed namespace/layout over time. Context search
    # keeps the intake resilient while known Palau cells remain seeded below.
    cells: set[str] = set()
    target_words = re.compile(r"Palau|Koror|Malakal|Ngeaur|Angaur|Pulo\s+Anna|Merir|Peleliu", re.I)
    for m in re.finditer(r"\bUS[1-6][A-Z0-9]{5}\b", text):
        context = text[max(0, m.start() - 1200): min(len(text), m.end() + 2400)]
        if target_words.search(context):
            cells.add(m.group(0))
    return cells


def intake_noaa_enc(job: Intake) -> None:
    stage = "NOAA_ENC"
    root = job.raw / "noaa_enc"
    root.mkdir(parents=True, exist_ok=True)
    catalog_urls = [
        "https://www.charts.noaa.gov/ENCs/ENCProdCat_19115.xml",
        "https://www.charts.noaa.gov/ENCs/ENCProdCat.xml",
    ]
    catalog_text = ""
    for url in catalog_urls:
        p = root / Path(urllib.parse.urlparse(url).path).name
        if job.download(url, p, max_bytes=80_000_000, stage=stage):
            catalog_text = p.read_text(encoding="utf-8", errors="ignore")
            break
    cells = {"US5TB3P1", "US4TB1X0", "US4TB3J0"}
    if catalog_text:
        cells |= parse_enc_catalog(catalog_text)
    write_json(job.meta / "NOAA_ENC_CELLS.json", {"cells": sorted(cells), "selection": "known Palau cells plus catalog title context search"})
    for cell in sorted(cells):
        zip_path = root / f"{cell}.zip"
        url = f"https://www.charts.noaa.gov/ENCs/{cell}.zip"
        if not job.download(url, zip_path, max_bytes=300_000_000, stage=stage):
            continue
        cell_dir = root / cell
        try:
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(cell_dir)
            job.event(stage, "EXTRACTED", cell, path=str(cell_dir.relative_to(job.out)))
        except Exception as exc:
            job.event(stage, "EXTRACT_FAILED", f"{cell}: {exc}")
            continue
        bases = list(cell_dir.rglob("*.000"))
        if not bases:
            job.event(stage, "NO_BASE_CELL", cell)
            continue
        for base in bases:
            gpkg = job.derived / "noaa_enc" / f"{cell}.gpkg"
            gpkg.parent.mkdir(parents=True, exist_ok=True)
            cmd = [
                "ogr2ogr", "-f", "GPKG", str(gpkg), str(base),
                "-skipfailures", "-oo", "SPLIT_MULTIPOINT=ON", "-oo", "ADD_SOUNDG_DEPTH=ON",
            ]
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=600)
                inv = subprocess.run(["ogrinfo", "-ro", "-so", "-al", str(gpkg)], check=False, capture_output=True, text=True, timeout=180)
                (job.meta / "noaa_enc" / f"{cell}_ogrinfo.txt").parent.mkdir(parents=True, exist_ok=True)
                (job.meta / "noaa_enc" / f"{cell}_ogrinfo.txt").write_text(inv.stdout + "\n" + inv.stderr, encoding="utf-8")
                job.event(stage, "DERIVED", f"{cell} S-57 to GeoPackage", path=str(gpkg.relative_to(job.out)), bytes=gpkg.stat().st_size)
            except Exception as exc:
                job.event(stage, "OGR_CONVERT_FAILED", f"{cell}: {exc}")
            break


def crawl_directory(job: Intake, base: str, stage: str, *, max_depth: int = 3, max_urls: int = 1200) -> list[dict[str, Any]]:
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    queue: list[tuple[str, int]] = [(base, 0)]
    base_parts = urllib.parse.urlparse(base)
    while queue and len(seen) < max_urls:
        url, depth = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        if not url.endswith("/"):
            try:
                r = job.request("HEAD", url, timeout=90, allow_redirects=True)
                rows.append({"url": url, "status": "file", "bytes": int(r.headers.get("content-length", 0) or 0), "contentType": r.headers.get("content-type", "")})
            except Exception as exc:
                rows.append({"url": url, "status": "file-unverified", "error": str(exc)})
            continue
        try:
            r = job.request("GET", url, timeout=120)
        except Exception as exc:
            rows.append({"url": url, "status": "failed", "error": str(exc)})
            continue
        rows.append({"url": url, "status": "index", "bytes": len(r.content)})
        if depth >= max_depth:
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if href.startswith("?") or href.startswith("#") or href in ("../", "./"):
                continue
            nxt = urllib.parse.urljoin(url, href)
            parts = urllib.parse.urlparse(nxt)
            if parts.netloc != base_parts.netloc or not parts.path.startswith(base_parts.path):
                continue
            if nxt not in seen:
                queue.append((nxt, depth + (1 if nxt.endswith("/") else 0)))
    return rows


def intake_noaa_multibeam(job: Intake) -> None:
    stage = "NOAA_MULTIBEAM"
    root = job.raw / "noaa_multibeam"
    root.mkdir(parents=True, exist_ok=True)
    cruises = ["EX2505", "EX2506", "EX2507"]
    inventory: dict[str, Any] = {}
    allow_ext = {".xml", ".json", ".geojson", ".csv", ".txt", ".kml", ".kmz", ".tif", ".tiff", ".bag", ".nc", ".grd", ".asc", ".xyz"}
    total_downloaded = 0
    total_cap = 700_000_000
    for cruise in cruises:
        report_url = f"https://www.ngdc.noaa.gov/ships/okeanos_explorer/{cruise}_mb.html"
        job.download(report_url, root / f"{cruise}_multibeam_report.html", max_bytes=20_000_000, stage=stage)
        waf = f"https://www.ncei.noaa.gov/waf/okeanos-rov-cruises/{cruise.lower()}/"
        rows = crawl_directory(job, waf, stage, max_depth=4, max_urls=1800)
        inventory[cruise] = rows
        candidates = []
        for row in rows:
            u = row["url"]
            ext = Path(urllib.parse.urlparse(u).path).suffix.lower()
            name = Path(urllib.parse.urlparse(u).path).name.lower()
            if row.get("status") == "file" and ext in allow_ext and any(k in name for k in ("track", "nav", "meta", "grid", "bath", "coverage", "survey", cruise.lower())):
                candidates.append(u)
        for u in candidates[:120]:
            if total_downloaded >= total_cap:
                break
            rel_name = safe_name(cruise + "_" + Path(urllib.parse.urlparse(u).path).name)
            p = root / cruise / rel_name
            before = p.stat().st_size if p.exists() else 0
            if job.download(u, p, max_bytes=min(120_000_000, total_cap - total_downloaded), stage=stage):
                total_downloaded += p.stat().st_size - before
    write_json(job.meta / "NOAA_2025_WAF_INVENTORY.json", inventory)

    rr_urls = {
        "RR1515.xml": "https://data.ngdc.noaa.gov/platforms/ocean/ships/roger_revelle/RR1515/multibeam/data/version1/metadata/RR1515.xml",
        "RR1515_file-info.txt": "https://data.ngdc.noaa.gov/platforms/ocean/ships/roger_revelle/RR1515/multibeam/data/version1/metadata/file-info.txt",
        "RR1515_report.html": "https://www.ngdc.noaa.gov/ships/roger_revelle/RR1515_mb.html",
    }
    for name, url in rr_urls.items():
        job.download(url, root / "RR1515" / name, max_bytes=20_000_000, stage=stage)


def intake_csb(job: Intake) -> None:
    stage = "IHO_DCDB_CSB"
    base = "https://q81rej0j12.execute-api.us-east-1.amazonaws.com"
    bbox = ",".join(str(x) for x in AOI_WGS84)
    out = job.raw / "iho_dcdb_csb"
    out.mkdir(parents=True, exist_ok=True)
    try:
        count = job.request("GET", f"{base}/count", params={"bbox": bbox}, timeout=120).json()
        platforms = job.request("GET", f"{base}/platforms", params={"bbox": bbox}, timeout=120).json()
        write_json(job.meta / "IHO_DCDB_CSB_COUNT.json", count)
        write_json(job.meta / "IHO_DCDB_CSB_PLATFORMS.json", platforms)
        n = int(count.get("count", 0))
        job.event(stage, "DISCOVERED", f"soundings={n}")
        if n <= 0:
            return
        if n > 5_000_000:
            job.event(stage, "ORDER_SKIPPED", f"{n} points exceeds first-round cap")
            return
        payload = {"bbox": bbox, "datasets": [{"label": "csb"}]}
        order = job.request("POST", f"{base}/order", json=payload, timeout=180).json()
        write_json(job.meta / "IHO_DCDB_CSB_ORDER.json", order)
        status_url = order.get("url")
        if not status_url:
            job.event(stage, "ORDER_FAILED", str(order))
            return
        status = {}
        for _ in range(50):
            status = job.request("GET", status_url, timeout=120).json()
            write_json(job.meta / "IHO_DCDB_CSB_ORDER_STATUS.json", status)
            if status.get("status") == "complete":
                break
            if status.get("status") in ("failed", "error"):
                break
            time.sleep(12)
        location = status.get("output_location")
        if status.get("status") != "complete" or not location:
            job.event(stage, "ORDER_INCOMPLETE", str(status))
            return
        if location.startswith("s3://"):
            dest = out / Path(location).name
            try:
                subprocess.run(["aws", "s3", "cp", "--no-sign-request", location, str(dest)], check=True, timeout=900)
                job.event(stage, "DOWNLOADED", dest.name, path=str(dest.relative_to(job.out)), bytes=dest.stat().st_size)
            except Exception as exc:
                job.event(stage, "S3_DOWNLOAD_FAILED", str(exc), url=location)
        elif location.startswith("http"):
            job.download(location, out / Path(urllib.parse.urlparse(location).path).name, max_bytes=800_000_000, stage=stage)
    except Exception as exc:
        job.event(stage, "FAILED", str(exc))


def select_sentinel_items(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for f in features:
        p = f.get("properties", {})
        code = p.get("grid:code") or p.get("s2:mgrs_tile") or p.get("mgrs:tile")
        if not code:
            m = re.search(r"_(\d{2}[A-Z]{3})_", f.get("id", ""))
            code = m.group(1) if m else f.get("id", "unknown")
        groups.setdefault(str(code), []).append(f)
    selected = []
    for code, items in groups.items():
        items.sort(key=lambda x: (float(x.get("properties", {}).get("eo:cloud_cover", 1000) or 1000), -int(re.sub(r"\D", "", x.get("properties", {}).get("datetime", "0")[:10]) or 0)))
        selected.append(items[0])
    selected.sort(key=lambda x: float(x.get("properties", {}).get("eo:cloud_cover", 1000) or 1000))
    return selected[:12]


def intake_sentinel(job: Intake) -> None:
    stage = "SENTINEL_2"
    endpoint = "https://earth-search.aws.element84.com/v1/search"
    query = {
        "collections": ["sentinel-2-l2a"],
        "bbox": list(AOI_WGS84),
        "datetime": f"2024-01-01T00:00:00Z/{TODAY}T23:59:59Z",
        "query": {"eo:cloud_cover": {"lt": 25}},
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        "limit": 100,
    }
    try:
        data = job.request("POST", endpoint, json=query, timeout=180).json()
    except Exception as exc:
        job.event(stage, "FAILED", str(exc), url=endpoint)
        return
    raw = job.raw / "sentinel2" / "earth_search_results.json"
    write_json(raw, data)
    features = data.get("features", [])
    selected = select_sentinel_items(features)
    write_json(job.meta / "SENTINEL2_SELECTED_ITEMS.json", selected)
    job.event(stage, "DISCOVERED", f"items={len(features)}, selected={len(selected)}", url=endpoint)
    if not selected:
        return
    try:
        import numpy as np
        import rasterio
        from PIL import Image
        from rasterio.enums import Resampling
        from rasterio.transform import from_origin
        from rasterio.warp import reproject

        xmin, ymin, xmax, ymax = AOI_UTM53
        res = 20.0
        width = math.ceil((xmax - xmin) / res)
        height = math.ceil((ymax - ymin) / res)
        transform = from_origin(xmin, ymax, res, res)
        bands = [("red", "B04"), ("green", "B03"), ("blue", "B02"), ("nir", "B08")]
        out_path = job.derived / "sentinel2" / "palau_sentinel2_l2a_20m_rgbn.tif"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        profile = {
            "driver": "GTiff", "width": width, "height": height, "count": 4,
            "dtype": "uint16", "crs": "EPSG:32653", "transform": transform,
            "nodata": 0, "compress": "DEFLATE", "predictor": 2, "tiled": True,
            "blockxsize": 512, "blockysize": 512, "BIGTIFF": "IF_SAFER",
        }
        env = rasterio.Env(AWS_NO_SIGN_REQUEST="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF")
        with env, rasterio.open(out_path, "w", **profile) as dst:
            for out_index, (asset_key, fallback_common) in enumerate(bands, start=1):
                mosaic = np.zeros((height, width), dtype=np.uint16)
                for item in selected:
                    assets = item.get("assets", {})
                    asset = assets.get(asset_key)
                    if not asset:
                        # Some STAC implementations expose common-name metadata under different keys.
                        for candidate in assets.values():
                            if candidate.get("eo:bands") and any(b.get("common_name") == asset_key for b in candidate.get("eo:bands", [])):
                                asset = candidate
                                break
                    if not asset or not asset.get("href"):
                        continue
                    href = asset["href"]
                    try:
                        with rasterio.open(href) as src:
                            tmp = np.zeros_like(mosaic)
                            reproject(
                                source=rasterio.band(src, 1), destination=tmp,
                                src_transform=src.transform, src_crs=src.crs,
                                dst_transform=transform, dst_crs="EPSG:32653",
                                src_nodata=src.nodata or 0, dst_nodata=0,
                                resampling=Resampling.bilinear,
                            )
                            take = (mosaic == 0) & (tmp > 0)
                            mosaic[take] = tmp[take]
                    except Exception as exc:
                        job.event(stage, "ASSET_READ_FAILED", f"{item.get('id')} {asset_key}: {exc}", url=href)
                dst.write(mosaic, out_index)
                dst.set_band_description(out_index, asset_key)
        job.event(stage, "DERIVED", "20 m RGB+NIR COG mosaic", path=str(out_path.relative_to(job.out)), bytes=out_path.stat().st_size)

        with rasterio.open(out_path) as src:
            scale = max(1, math.ceil(src.width / 1800))
            rgb = src.read([1, 2, 3], out_shape=(3, max(1, src.height // scale), max(1, src.width // scale)), resampling=Resampling.bilinear).astype(np.float32)
        img = np.zeros_like(rgb, dtype=np.uint8)
        for i in range(3):
            valid = rgb[i][rgb[i] > 0]
            if valid.size:
                lo, hi = np.percentile(valid, [2, 98])
                img[i] = np.clip((rgb[i] - lo) * 255.0 / max(1.0, hi - lo), 0, 255).astype(np.uint8)
        preview = job.derived / "sentinel2" / "palau_sentinel2_preview.jpg"
        Image.fromarray(np.transpose(img, (1, 2, 0))).save(preview, quality=90)
        job.event(stage, "PREVIEW", preview.name, path=str(preview.relative_to(job.out)), bytes=preview.stat().st_size)
    except Exception as exc:
        job.event(stage, "MOSAIC_FAILED", str(exc))


def parse_wfs_feature_types(xml_text: str) -> list[dict[str, Any]]:
    rows = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return rows
    for ft in root.iter():
        if not ft.tag.endswith("FeatureType"):
            continue
        row: dict[str, Any] = {}
        for child in ft.iter():
            tag = child.tag.split("}")[-1]
            text = (child.text or "").strip()
            if tag in ("Name", "Title", "Abstract") and text and tag.lower() not in row:
                row[tag.lower()] = text
        lowers = []
        uppers = []
        for child in ft.iter():
            tag = child.tag.split("}")[-1]
            text = (child.text or "").strip()
            if tag == "LowerCorner" and text:
                lowers = [float(x) for x in text.split()[:2]]
            elif tag == "UpperCorner" and text:
                uppers = [float(x) for x in text.split()[:2]]
        if len(lowers) == 2 and len(uppers) == 2:
            row["bbox"] = [lowers[0], lowers[1], uppers[0], uppers[1]]
        if row.get("name"):
            rows.append(row)
    return rows


def intake_allen_coral(job: Intake) -> None:
    stage = "ALLEN_CORAL_ATLAS"
    root = job.raw / "allen_coral_atlas"
    root.mkdir(parents=True, exist_ok=True)
    urls = {
        "wfs_capabilities.xml": "https://allencoralatlas.org/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities",
        "wms_capabilities.xml": "https://allencoralatlas.org/geoserver/ows?service=WMS&version=1.3.0&request=GetCapabilities",
        "maps_metadata.json": "https://allencoralatlas.org/mapping/maps",
    }
    for name, url in urls.items():
        job.download(url, root / name, max_bytes=80_000_000, stage=stage)
    cap = root / "wfs_capabilities.xml"
    if cap.exists():
        layers = parse_wfs_feature_types(cap.read_text(encoding="utf-8", errors="ignore"))
        write_json(job.meta / "ALLEN_CORAL_WFS_LAYERS.json", layers)
        relevant = []
        for row in layers:
            text = " ".join(str(row.get(k, "")) for k in ("name", "title", "abstract"))
            bbox = tuple(row.get("bbox", [-180, -90, 180, 90]))
            if re.search(r"benthic|geomorphic|reef|western\s*micronesia|micronesia", text, re.I) and intersects(AOI_WGS84, bbox):
                relevant.append(row)
        write_json(job.meta / "ALLEN_CORAL_RELEVANT_LAYERS.json", relevant)
        for row in relevant[:12]:
            name = row["name"]
            params = {
                "service": "WFS", "version": "2.0.0", "request": "GetFeature",
                "typeNames": name, "outputFormat": "application/json",
                "srsName": "EPSG:4326", "bbox": ",".join(str(x) for x in (*AOI_WGS84, "EPSG:4326")),
                "count": "100000",
            }
            url = "https://allencoralatlas.org/geoserver/ows?" + urllib.parse.urlencode(params)
            job.download(url, job.derived / "allen_coral_atlas" / f"{safe_name(name)}.geojson", max_bytes=180_000_000, stage=stage)
    write_json(job.meta / "ALLEN_CORAL_BATHYMETRY_ACCESS.json", {
        "status": "AUTHENTICATED_AOI_DOWNLOAD_REQUIRED",
        "reason": "Bathymetry is download-only through an Allen Coral Atlas account/AOI workflow; no anonymous WFS/WCS endpoint is advertised.",
        "method": "10 m satellite-derived bathymetry where bottom is visible",
        "doNotInfer": "Habitat polygons and visual imagery are not a substitute for the bathymetry GeoTIFF.",
    })


def intake_seascape(job: Intake) -> None:
    stage = "OPEN_WATERS_SEASCAPE"
    root = job.raw / "openwaters_seascape"
    root.mkdir(parents=True, exist_ok=True)
    tilejson_urls = {
        "raster.json": "https://tiles.openwaters.io/seascape/raster.json",
        "vector.json": "https://tiles.openwaters.io/seascape/vector.json",
        "coverage.json": "https://tiles.openwaters.io/seascape/coverage.json",
    }
    raster_meta = None
    for name, url in tilejson_urls.items():
        p = root / name
        if job.download(url, p, max_bytes=20_000_000, stage=stage) and name == "raster.json":
            try:
                raster_meta = json.loads(p.read_text())
            except Exception:
                pass
    if not raster_meta or not raster_meta.get("tiles"):
        job.event(stage, "NO_TILE_TEMPLATE", "raster TileJSON unavailable")
        return
    try:
        import mercantile
        import numpy as np
        import rasterio
        from PIL import Image
        from rasterio.enums import Resampling
        from rasterio.transform import from_origin
        from rasterio.warp import reproject

        z = 10
        tiles = list(mercantile.tiles(*AOI_WGS84, zooms=z))
        xs = [t.x for t in tiles]
        ys = [t.y for t in tiles]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        mosaic = np.full(((maxy - miny + 1) * 256, (maxx - minx + 1) * 256), np.nan, dtype=np.float32)
        template = raster_meta["tiles"][0]
        for t in tiles:
            url = template.replace("{z}", str(t.z)).replace("{x}", str(t.x)).replace("{y}", str(t.y))
            p = root / "tiles_z10" / str(t.x) / f"{t.y}.png"
            if not job.download(url, p, max_bytes=5_000_000, stage=stage):
                continue
            arr = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
            values = arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0 - 32768.0
            r0 = (t.y - miny) * 256
            c0 = (t.x - minx) * 256
            mosaic[r0:r0 + 256, c0:c0 + 256] = values
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
        reproject(
            source=mosaic, destination=dst,
            src_transform=src_transform, src_crs="EPSG:3857",
            dst_transform=dst_transform, dst_crs="EPSG:32653",
            src_nodata=np.nan, dst_nodata=-9999.0,
            resampling=Resampling.bilinear,
        )
        tif = job.derived / "openwaters_seascape" / "palau_seascape_approx_100m_utm53.tif"
        tif.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(tif, "w", driver="GTiff", width=width, height=height, count=1, dtype="float32", crs="EPSG:32653", transform=dst_transform, nodata=-9999.0, compress="DEFLATE", predictor=3, tiled=True, blockxsize=256, blockysize=256) as f:
            f.write(dst, 1)
            f.set_band_description(1, "approx_elevation_m_not_chart_datum")
        valid = dst[dst > -9000]
        lo, hi = (np.percentile(valid, [2, 98]) if valid.size else (-5000, 100))
        preview = np.clip((dst - lo) * 255 / max(1, hi - lo), 0, 255).astype(np.uint8)
        preview[dst <= -9000] = 0
        png = job.derived / "openwaters_seascape" / "palau_seascape_preview.png"
        Image.fromarray(preview).save(png)
        job.event(stage, "DERIVED", "Terrarium tiles to 100 m UTM53 approximate bathymetry", path=str(tif.relative_to(job.out)), bytes=tif.stat().st_size)
    except Exception as exc:
        job.event(stage, "MOSAIC_FAILED", str(exc))


def build_ledgers(job: Intake) -> None:
    entries = [
        {
            "sourceId": "osm-palau-marine-r1", "sourceType": "crowdsourced-vector", "observedQuantity": "coastline/marine-object/seamark tags",
            "license": "ODbL 1.0", "frequencyBand": "object/shoreline constraint", "confidence": "variable",
            "role": "names, coast objects, reefs/shoals where mapped, seamarks and infrastructure; never continuous bathymetry",
        },
        {
            "sourceId": "noaa-enc-palau-r1", "sourceType": "official-navigation-chart", "observedQuantity": "soundings/depth contours/depth areas/hazards",
            "license": "U.S. Government public data; NOAA terms", "frequencyBand": "nearshore chart constraints", "confidence": "authority chart, compilation-scale dependent",
            "role": "constraint points/lines/areas with chart datum; not a seamless seabed DEM",
        },
        {
            "sourceId": "noaa-ex2505-2507-rr1515", "sourceType": "measured-multibeam", "observedQuantity": "seafloor depth and survey tracks",
            "license": "U.S. Government public data", "frequencyBand": "deep measured correction", "confidence": "high inside surveyed swaths",
            "role": "highest-priority measured seabed where coverage exists",
        },
        {
            "sourceId": "iho-dcdb-csb-palau", "sourceType": "crowdsourced-soundings", "observedQuantity": "XYZT vessel soundings",
            "license": "CC0/public dissemination", "frequencyBand": "sparse local correction", "confidence": "provider/instrument dependent",
            "role": "supplementary points with uncertainty; never overrides multibeam blindly",
        },
        {
            "sourceId": "sentinel2-l2a-palau-2024-2026", "sourceType": "optical-satellite", "observedQuantity": "surface reflectance",
            "license": "Copernicus Sentinel open data", "frequencyBand": "shore/reef/material evidence", "confidence": "cloud/turbidity/depth dependent",
            "role": "coastline, sand, vegetation and reef optical constraints; not elevation",
        },
        {
            "sourceId": "allen-coral-atlas-western-micronesia", "sourceType": "reef-habitat-and-sdb", "observedQuantity": "reef habitats and satellite-derived shallow bathymetry",
            "license": "Atlas data terms; habitat maps/API and bathymetry attribution differ from visual imagery", "frequencyBand": "reef and shallow-water correction", "confidence": "bottom-visible water only",
            "role": "habitat polygons via WFS; bathymetry requires authenticated AOI download",
        },
        {
            "sourceId": "openwaters-seascape-palau", "sourceType": "open-bathymetry-mosaic", "observedQuantity": "approximate seafloor elevation/depth",
            "license": "CC BY 4.0 compilation; underlying source licenses retained", "frequencyBand": "low-frequency seabed baseline", "confidence": "approximate, mixed datum/resolution",
            "role": "initial low-frequency bathymetry only; not navigation or local truth",
        },
        {
            "sourceId": "atl24-v2-palau", "sourceType": "along-track-lidar-bathymetry", "observedQuantity": "refraction-corrected sea surface/seafloor heights and uncertainty",
            "license": "NASA Earthdata terms and citation", "frequencyBand": "shallow calibration tracks", "confidence": "product uncertainty supplied",
            "role": "future authenticated Earthdata intake; account required",
            "status": "AUTH_REQUIRED",
        },
    ]
    conductor = {
        "schema": "kaopu-palau-world-conductor/1.0",
        "principle": "one world conductor, independent evidence voices",
        "aoiWgs84": AOI_WGS84,
        "aoiUtm53": AOI_UTM53,
        "worldQuery": "PalauWorld.sample(E,N,Z,time,observationBand)",
        "landScore": "H_low + H_middle + H_high + R_local",
        "solidScore": "Phi_karst(E,N,Z,band) for overhangs, caves, arches and undercuts",
        "seabedScore": "B_deep + B_measured + B_shallow + B_reef + R_local",
        "priority": [
            "measured multibeam within swath",
            "official ENC soundings/contours as chart-datum constraints",
            "ATL24 and validated satellite-derived shallow bathymetry",
            "crowdsourced soundings with provider uncertainty",
            "Seascape/GEBCO low-frequency baseline",
        ],
        "nonHeightVoices": ["Sentinel-2 reflectance", "OSM features", "reef habitat classes"],
        "forbidden": [
            "blindly average unlike observations",
            "interpret optical imagery as elevation without calibration",
            "treat navigation-chart appearance as a seamless DEM",
            "fill unknown areas and label them measured",
            "create separate terrain for rendering, collision, fish and player",
        ],
        "sources": entries,
    }
    write_json(job.meta / "PALAU_SOURCE_LEDGER_R1.json", {"schema": "kaopu-evidence-ledger/1.0", "entries": entries})
    write_json(job.meta / "PALAU_WORLD_CONDUCTOR_R1.json", conductor)


def finalize(job: Intake) -> None:
    build_ledgers(job)
    files = []
    for p in sorted(job.out.rglob("*")):
        if p.is_file():
            files.append({"path": str(p.relative_to(job.out)), "bytes": p.stat().st_size, "sha256": sha256(p)})
    report = {
        "schema": "palau-source-intake-report/1.0",
        "generatedAt": TODAY,
        "aoiWgs84": AOI_WGS84,
        "aoiUtm53": AOI_UTM53,
        "events": [asdict(e) for e in job.events],
        "files": files,
        "successCounts": {
            "downloaded": sum(e.status == "DOWNLOADED" for e in job.events),
            "derived": sum(e.status in ("DERIVED", "PREVIEW") for e in job.events),
            "failed": sum("FAILED" in e.status for e in job.events),
        },
        "boundary": "This is evidence intake, not a fused terrain truth. Datum harmonization and wave-field distillation are separate gated stages.",
    }
    write_json(job.meta / "DOWNLOAD_REPORT.json", report)
    readme = f"""# Palau KAOPU Source Intake R1

AOI: `{AOI_WGS84}` (WGS84), canonical metric frame EPSG:32653.

This package is a first-round evidence intake for one `PalauWorld` conductor. It keeps measured bathymetry, chart constraints, crowdsourced observations, optical imagery, reef habitat maps and approximate global bathymetry separate. Nothing here is silently averaged or promoted to truth.

Key outputs:

- `metadata/PALAU_WORLD_CONDUCTOR_R1.json` — the single-conductor rule and precedence.
- `metadata/PALAU_SOURCE_LEDGER_R1.json` — licenses, observed quantities, scale bands and confidence.
- `metadata/DOWNLOAD_REPORT.json` — exact successes/failures and checksums.
- `derived/noaa_enc/*.gpkg` — official chart features when conversion succeeds.
- `derived/sentinel2/*` — open Sentinel-2 reflectance mosaic and preview; not elevation.
- `derived/openwaters_seascape/*` — approximate low-frequency bathymetry; not chart datum.
- `derived/osm/*` — OSM marine/coast/seamark features.
- `derived/allen_coral_atlas/*` — anonymous WFS habitat layers where available.

Authenticated boundaries:

- Allen Coral Atlas bathymetry GeoTIFF requires its AOI/download account workflow.
- NASA ATL24 v2 requires a free Earthdata Login.

Those two are recorded as pending evidence voices rather than faked or replaced.
"""
    (job.out / "README.md").write_text(readme, encoding="utf-8")
    # Rebuild report after README is present so the final checksum list includes it.
    files = []
    for p in sorted(job.out.rglob("*")):
        if p.is_file() and p.name != "DOWNLOAD_REPORT.json":
            files.append({"path": str(p.relative_to(job.out)), "bytes": p.stat().st_size, "sha256": sha256(p)})
    report["files"] = files
    write_json(job.meta / "DOWNLOAD_REPORT.json", report)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    job = Intake(args.out)
    stages = [
        intake_osm,
        intake_noaa_enc,
        intake_noaa_multibeam,
        intake_csb,
        intake_sentinel,
        intake_allen_coral,
        intake_seascape,
    ]
    for fn in stages:
        try:
            fn(job)
        except Exception as exc:
            job.event(fn.__name__, "UNHANDLED_FAILED", repr(exc))
    finalize(job)
    # Core gate: a usable R1 must have the conductor plus at least one authority
    # or open observation payload. Individual remote services may still fail.
    core = (job.meta / "PALAU_WORLD_CONDUCTOR_R1.json").exists()
    payloads = [p for root in (job.raw, job.derived) for p in root.rglob("*") if p.is_file()]
    print(json.dumps({"core": core, "payloadFiles": len(payloads), "events": len(job.events)}, indent=2))
    return 0 if core and payloads else 2


if __name__ == "__main__":
    raise SystemExit(main())
