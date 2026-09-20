#!/usr/bin/env python3
"""Acquire official/open evidence for the user-confirmed Airai reef AOI.

This script downloads evidence only. It never merges vertical datums and never
labels an interpolated surface as survey truth.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import time
from typing import Any
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

CONTEXT = [134.49, 7.27, 134.64, 7.42]  # west,south,east,north
CORE = [134.535, 7.315, 134.605, 7.385]
ANCHOR = [134.5667427743189, 7.349032638038719]
ENC_CELLS = [
    "US4TB3C0", "US4TB3J0", "US4TB3P0",
    "US5TB3P1", "US5TB4S1", "US5TB4S2", "US5TB4Y1", "US5TB4Y3",
]
USER_AGENT = "KAOPU-Palau-Airai-Reef-R01/1.0 (research intake)"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "POST"}),
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({"User-Agent": USER_AGENT})
    return s


class Intake:
    def __init__(self, out: Path) -> None:
        self.out = out
        self.raw = out / "raw"
        self.meta = out / "metadata"
        self.raw.mkdir(parents=True, exist_ok=True)
        self.meta.mkdir(parents=True, exist_ok=True)
        self.http = session()
        self.records: list[dict[str, Any]] = []

    def record(self, source: str, url: str, path: Path, status: str, error: str | None = None) -> None:
        item: dict[str, Any] = {
            "time": dt.datetime.now(dt.timezone.utc).isoformat(),
            "source": source,
            "url": url,
            "path": str(path.relative_to(self.out)) if path.exists() else str(path),
            "status": status,
        }
        if path.exists() and path.is_file():
            item.update({"bytes": path.stat().st_size, "sha256": sha256(path)})
        if error:
            item["error"] = error
        self.records.append(item)
        print(f"[{status:8}] {source}: {path.name}")

    def get(self, source: str, url: str, rel: str, optional: bool = True) -> Path | None:
        path = self.out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.stat().st_size:
            self.record(source, url, path, "EXISTS")
            return path
        try:
            with self.http.get(url, timeout=180, stream=True) as r:
                r.raise_for_status()
                tmp = path.with_suffix(path.suffix + ".part")
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1024 * 1024):
                        if chunk:
                            f.write(chunk)
                tmp.replace(path)
            self.record(source, url, path, "OK")
            return path
        except Exception as exc:
            self.record(source, url, path, "SKIPPED" if optional else "FAILED", str(exc))
            return None

    def get_json(self, source: str, url: str, rel: str, params: dict[str, Any] | None = None) -> Path | None:
        path = self.out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        final_url = url + ("?" + urlencode(params, doseq=True) if params else "")
        try:
            r = self.http.get(url, params=params, timeout=180)
            r.raise_for_status()
            data = r.json()
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            self.record(source, final_url, path, "OK")
            return path
        except Exception as exc:
            self.record(source, final_url, path, "SKIPPED", str(exc))
            return None

    def post_json(self, source: str, url: str, rel: str, payload: dict[str, Any]) -> Path | None:
        path = self.out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            r = self.http.post(url, json=payload, timeout=240)
            r.raise_for_status()
            data = r.json()
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            self.record(source, url, path, "OK")
            return path
        except Exception as exc:
            self.record(source, url, path, "SKIPPED", str(exc))
            return None

    def finish(self) -> None:
        receipt = {
            "schema": "kaopu.palau.airai-source-receipt/1.0",
            "created": dt.datetime.now(dt.timezone.utc).isoformat(),
            "contextBBoxWGS84": CONTEXT,
            "coreBBoxWGS84": CORE,
            "userConfirmedAnchorWGS84": ANCHOR,
            "records": self.records,
        }
        (self.out / "DOWNLOAD_RECEIPT.json").write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        sums = []
        for path in sorted(self.out.rglob("*")):
            if path.is_file() and path.name != "SHA256SUMS.txt":
                sums.append(f"{sha256(path)}  {path.relative_to(self.out).as_posix()}")
        (self.out / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")


def arcgis_query(intake: Intake, name: str, layer_url: str, rel: str, bbox: list[float]) -> None:
    west, south, east, north = bbox
    intake.get_json(
        name,
        layer_url.rstrip("/") + "/query",
        rel,
        {
            "where": "1=1",
            "geometry": f"{west},{south},{east},{north}",
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "true",
            "f": "geojson",
        },
    )


def acquire(out: Path, include_sentinel_assets: bool) -> None:
    it = Intake(out)

    # NOAA official ENC: chart soundings, contours, depth areas, quality and datum.
    it.get("NOAA_ENC_CATALOG", "https://www.charts.noaa.gov/ENCs/ENCProdCat.xml", "metadata/noaa_enc/ENCProdCat.xml")
    for cell in ENC_CELLS:
        it.get("NOAA_ENC", f"https://charts.noaa.gov/ENCs/{cell}.zip", f"raw/noaa_enc/{cell}.zip")
        it.get("NOAA_ENC_META", f"https://charts.noaa.gov/ENCs/{cell}_19115.xml", f"metadata/noaa_enc/{cell}_19115.xml")

    # NOAA/NCEI survey discovery services.
    for layer in (0, 1, 2):
        arcgis_query(
            it,
            f"NOAA_NOS_HYDRO_LAYER_{layer}",
            f"https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/nos_hydro_dynamic/MapServer/{layer}",
            f"metadata/noaa_surveys/nos_hydro_layer_{layer}.geojson",
            CONTEXT,
        )
    arcgis_query(
        it,
        "NOAA_MULTIBEAM_FOOTPRINTS",
        "https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/multibeam_dynamic/FeatureServer/0",
        "metadata/noaa_surveys/multibeam.geojson",
        CONTEXT,
    )

    # GMRT: continuous context plus measured-only mask.
    gmrt_base = "https://www.gmrt.org/services/GridServer"
    west, south, east, north = CONTEXT
    common = {"west": west, "south": south, "east": east, "north": north, "format": "geotiff"}
    it.get("GMRT_TOPO", gmrt_base + "?" + urlencode({**common, "layer": "topo", "resolution": "max"}), "raw/gmrt/airai_topo_max.tif")
    it.get("GMRT_TOPO_MASK", gmrt_base + "?" + urlencode({**common, "layer": "topo-mask", "resolution": "max"}), "raw/gmrt/airai_topo_mask_max.tif")
    it.get("GMRT_METADATA", gmrt_base + "?" + urlencode({"west": west, "south": south, "east": east, "north": north, "layer": "metadata", "mformat": "json"}), "metadata/gmrt/airai_metadata.json")

    # Palau OSM semantic evidence.
    it.get("GEOFABRIK_OSM", "https://download.geofabrik.de/australia-oceania/palau-latest.osm.pbf", "raw/osm/palau-latest.osm.pbf")
    it.get("GEOFABRIK_POLY", "https://download.geofabrik.de/australia-oceania/palau.poly", "metadata/osm/palau.poly")

    # Allen Coral Atlas: habitat/reef services. Bathymetry itself may require login.
    it.get("ALLEN_WMS", "https://allencoralatlas.org/geoserver/ows?service=wms&version=2.0.0&request=GetCapabilities", "metadata/allen/wms_capabilities.xml")
    it.get("ALLEN_WFS", "https://allencoralatlas.org/geoserver/ows?service=wfs&version=2.0.0&request=GetCapabilities", "metadata/allen/wfs_capabilities.xml")
    it.get_json("ALLEN_MAP_METADATA", "https://allencoralatlas.org/mapping/maps", "metadata/allen/maps.json")

    # Sentinel-2 open STAC discovery for shallow-water optical evidence.
    payload = {
        "collections": ["sentinel-2-c1-l2a"],
        "bbox": CONTEXT,
        "datetime": "2023-01-01T00:00:00Z/..",
        "query": {"eo:cloud_cover": {"lt": 20}},
        "sortby": [
            {"field": "properties.eo:cloud_cover", "direction": "asc"},
            {"field": "properties.datetime", "direction": "desc"},
        ],
        "limit": 40,
    }
    stac = it.post_json("SENTINEL2_STAC", "https://earth-search.aws.element84.com/v1/search", "metadata/sentinel2/search.json", payload)
    (out / "metadata/sentinel2/search_payload.json").write_text(json.dumps(payload, indent=2) + "\n")
    if include_sentinel_assets and stac and stac.exists():
        doc = json.loads(stac.read_text())
        scenes = doc.get("features", [])[:3]
        wanted = {"blue", "green", "red", "nir", "scl"}
        for scene in scenes:
            sid = scene.get("id", "scene")
            for key, asset in scene.get("assets", {}).items():
                if key.lower() in wanted and asset.get("href"):
                    suffix = Path(asset["href"].split("?", 1)[0]).suffix or ".tif"
                    it.get("SENTINEL2_ASSET", asset["href"], f"raw/sentinel2/{sid}/{key}{suffix}")

    # Record manual/auth-gated source state without pretending it was downloaded.
    gated = {
        "allenCoralAtlasBathymetry": {
            "status": "LOGIN_OR_INTERACTIVE_EXPORT_REQUIRED",
            "role": "10 m shallow-water bathymetry candidate; validate against ENC soundings",
        },
        "icesat2ATL24": {
            "status": "EARTHDATA_TOKEN_REQUIRED",
            "role": "along-track shallow-water calibration",
        },
        "rule": "Neither source may be reported as acquired until bytes and hashes exist.",
    }
    (out / "metadata/AUTH_GATED_SOURCES.json").write_text(json.dumps(gated, indent=2) + "\n")

    it.finish()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--sentinel-assets", action="store_true")
    args = ap.parse_args()
    acquire(args.output.resolve(), args.sentinel_assets)


if __name__ == "__main__":
    main()
