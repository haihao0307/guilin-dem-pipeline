#!/usr/bin/env python3
"""Collect evidence only for the Airai / Stone Money Island focused world.

This script does not merge datums or claim a completed seabed. It downloads and
clips evidence voices into one focused AOI, then writes a provenance receipt.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

import requests

AOI = {
    "name": "PALAU_AIRAI_STONE_MONEY_R01",
    "bbox_wgs84": [134.5305390567, 7.3128140607, 134.6029523562, 7.3852485779],
    "candidate_anchor": [134.5667427743, 7.3490326380],
    "airai_airport": [134.5443, 7.3673],
}
NOAA_CATALOG = "https://www.charts.noaa.gov/ENCs/ENCProdCat.xml"
NOAA_ZIP = "https://www.charts.noaa.gov/ENCs/{cell}.zip"
FALLBACK_CELLS = ["US5TB3P1", "US5TB4S1", "US5TB4S2", "US4TB3P0", "US4TB4S0"]
OSM_GPKG = "https://download.geofabrik.de/australia-oceania/palau-latest-free.gpkg.zip"
SENTINEL_SEARCH = "https://earth-search.aws.element84.com/v1/search"
ALLEN_WFS = "https://allencoralatlas.org/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities"
ALLEN_WMS = "https://allencoralatlas.org/geoserver/ows?service=WMS&version=1.3.0&request=GetCapabilities"
GMRT = "https://www.gmrt.org/services/GridServer"
USER_AGENT = "KAOPU-Palau-Airai-R01/1.0"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download(session: requests.Session, url: str, path: Path, optional: bool = False) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with session.get(url, stream=True, timeout=180) as response:
            response.raise_for_status()
            tmp = path.with_suffix(path.suffix + ".part")
            with tmp.open("wb") as f:
                for chunk in response.iter_content(1024 * 1024):
                    if chunk:
                        f.write(chunk)
            tmp.replace(path)
        return {"url": url, "path": str(path), "status": "OK", "bytes": path.stat().st_size, "sha256": sha256(path)}
    except Exception as exc:
        if not optional:
            print(f"download failed: {url}: {exc}", file=sys.stderr)
        return {"url": url, "path": str(path), "status": "OPTIONAL_FAILED" if optional else "FAILED", "error": str(exc)}


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def text_map(node: ET.Element) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for element in node.iter():
        if element.text and element.text.strip():
            out.setdefault(local(element.tag), []).append(element.text.strip())
    return out


def first_number(values: list[str] | None) -> float | None:
    if not values:
        return None
    for value in values:
        match = re.search(r"[-+]?\d+(?:\.\d+)?", value)
        if match:
            try:
                return float(match.group())
            except ValueError:
                pass
    return None


def intersects(bounds: list[float], aoi: list[float]) -> bool:
    west, south, east, north = bounds
    aw, a_s, ae, an = aoi
    return not (east < aw or west > ae or north < a_s or south > an)


def parse_catalog(path: Path) -> list[dict]:
    try:
        root = ET.parse(path).getroot()
    except Exception:
        return []
    found: dict[str, dict] = {}
    for node in root.iter():
        values = text_map(node)
        candidates = []
        for key, entries in values.items():
            if any(token in key for token in ("name", "cell", "dsnm", "title")):
                candidates.extend(entries)
        cell = None
        for candidate in candidates:
            match = re.search(r"\bUS[1-6][A-Z0-9]{5,7}\b", candidate)
            if match:
                cell = match.group(0)
                break
        if not cell:
            continue
        def pick(*tokens: str) -> float | None:
            for key, entries in values.items():
                if all(token in key for token in tokens):
                    number = first_number(entries)
                    if number is not None:
                        return number
            return None
        west = pick("west")
        east = pick("east")
        south = pick("south")
        north = pick("north")
        if None not in (west, east, south, north):
            found[cell] = {"cell": cell, "bounds": [west, south, east, north]}
    return sorted(found.values(), key=lambda item: item["cell"])


def select_cells(catalog: list[dict]) -> list[dict]:
    selected = [item for item in catalog if intersects(item["bounds"], AOI["bbox_wgs84"])]
    if selected:
        return selected
    return [{"cell": cell, "bounds": None, "selection": "fallback_candidate"} for cell in FALLBACK_CELLS]


def ogr_clip_enc(zip_path: Path, out_dir: Path, bbox: list[float]) -> dict:
    cell = zip_path.stem
    unpack = out_dir / "_unpack" / cell
    shutil.rmtree(unpack, ignore_errors=True)
    unpack.mkdir(parents=True)
    try:
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(unpack)
        base = next(iter(unpack.rglob("*.000")), None)
        if not base:
            return {"cell": cell, "status": "NO_BASE_CELL"}
        gpkg = out_dir / f"{cell}_focus.gpkg"
        cmd = [
            "ogr2ogr", "-f", "GPKG", str(gpkg), str(base),
            "-spat", *map(str, bbox), "-skipfailures",
            "--config", "OGR_S57_OPTIONS",
            "RETURN_PRIMITIVES=OFF,RETURN_LINKAGES=OFF,SPLIT_MULTIPOINT=ON,ADD_SOUNDG_DEPTH=ON",
        ]
        completed = subprocess.run(cmd, text=True, capture_output=True)
        result = {"cell": cell, "status": "OK" if completed.returncode == 0 else "FAILED", "stderr": completed.stderr[-3000:]}
        if gpkg.exists():
            result.update({"path": str(gpkg), "bytes": gpkg.stat().st_size, "sha256": sha256(gpkg)})
        return result
    except Exception as exc:
        return {"cell": cell, "status": "FAILED", "error": str(exc)}
    finally:
        shutil.rmtree(unpack, ignore_errors=True)


def sentinel_query(session: requests.Session, out: Path) -> dict:
    payload = {
        "collections": ["sentinel-2-c1-l2a"],
        "bbox": AOI["bbox_wgs84"],
        "datetime": "2022-01-01T00:00:00Z/..",
        "query": {"eo:cloud_cover": {"lt": 25}},
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        "limit": 40,
    }
    path = out / "sentinel2" / "stac_search.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        response = session.post(SENTINEL_SEARCH, json=payload, timeout=180)
        response.raise_for_status()
        path.write_bytes(response.content)
        doc = response.json()
        scenes = []
        for feature in doc.get("features", [])[:12]:
            props = feature.get("properties", {})
            scenes.append({
                "id": feature.get("id"),
                "datetime": props.get("datetime"),
                "cloudCover": props.get("eo:cloud_cover"),
                "assets": {key: value.get("href") for key, value in feature.get("assets", {}).items() if key in {"blue", "green", "red", "nir", "scl", "visual"}},
            })
        (path.parent / "selected_scenes.json").write_text(json.dumps(scenes, indent=2) + "\n")
        return {"status": "OK", "path": str(path), "scenes": len(scenes), "sha256": sha256(path)}
    except Exception as exc:
        return {"status": "FAILED", "error": str(exc)}


def gmrt_download(session: requests.Session, out: Path, layer: str, resolution: str) -> dict:
    west, south, east, north = AOI["bbox_wgs84"]
    query = urllib.parse.urlencode({"north": north, "south": south, "east": east, "west": west, "layer": layer, "format": "geotiff", "resolution": resolution})
    return download(session, f"{GMRT}?{query}", out / "gmrt" / f"{layer}_{resolution}.tif", optional=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    records: dict = {"worldId": AOI["name"], "aoi": AOI, "status": "RUNNING"}

    catalog_record = download(session, NOAA_CATALOG, out / "noaa_enc" / "ENCProdCat.xml")
    records["noaaCatalog"] = catalog_record
    catalog = parse_catalog(out / "noaa_enc" / "ENCProdCat.xml") if catalog_record["status"] == "OK" else []
    selected = select_cells(catalog)
    (out / "noaa_enc" / "selected_cells.json").write_text(json.dumps(selected, indent=2) + "\n")
    records["selectedENC"] = selected
    enc_downloads = []
    enc_converted = []
    for item in selected:
        cell = item["cell"]
        path = out / "noaa_enc" / f"{cell}.zip"
        rec = download(session, NOAA_ZIP.format(cell=cell), path, optional=True)
        enc_downloads.append(rec)
        if rec["status"] == "OK" and shutil.which("ogr2ogr"):
            enc_converted.append(ogr_clip_enc(path, out / "noaa_enc" / "clipped", AOI["bbox_wgs84"]))
    records["encDownloads"] = enc_downloads
    records["encConversion"] = enc_converted

    records["osm"] = download(session, OSM_GPKG, out / "osm" / "palau-latest-free.gpkg.zip", optional=True)
    records["sentinel2"] = sentinel_query(session, out)
    records["allenWFS"] = download(session, ALLEN_WFS, out / "allen" / "wfs_capabilities.xml", optional=True)
    records["allenWMS"] = download(session, ALLEN_WMS, out / "allen" / "wms_capabilities.xml", optional=True)
    records["gmrtMeasured"] = gmrt_download(session, out, "topo-mask", "max")
    records["gmrtContext"] = gmrt_download(session, out, "topo", "high")

    records["datumBoundary"] = {
        "landDEM": "WGS84 ellipsoidal source branch; local sea mode is only a local anchor",
        "ENC": "chart datum per M_SDAT / cell metadata",
        "multibeam": "read cruise/BAG metadata before fusion",
        "rule": "no silent averaging across datums",
    }
    records["status"] = "COMPLETE_WITH_EXPLICIT_FAILURES"
    receipt = out / "FOCUS_SOURCE_RECEIPT.json"
    receipt.write_text(json.dumps(records, indent=2) + "\n")
    print(receipt)


if __name__ == "__main__":
    main()
