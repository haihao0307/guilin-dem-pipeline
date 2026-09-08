#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

import requests

LOCKED = {
    "crs": "EPSG:32651",
    "bounds": [190475.0, 2991275.0, 411250.0, 3241862.5],
    "canonicalResolutionMeters": 12.5,
    "canonicalRowsCols": [20047, 17662],
}
WGS84_ENVELOPE = [119.8147394082622, 27.009129943046574, 122.10517761161395, 29.30263813887454]
BASE = "https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/Aggregated/VER1-5"
TILES = ["110E_30N", "120E_30N"]
PRODUCTS = {
    "occurrence": {
        "role": "water occurrence percentage",
        "period": "1984-2024 aggregated",
        "kind": "continuous_integer_percentage",
    },
    "recurrence": {
        "role": "interannual recurrence percentage",
        "period": "1984-2024 aggregated",
        "kind": "continuous_integer_percentage",
        "caveat": "JRC reports an unresolved sparse-observation issue in monthly recurrence; this file is the published aggregated recurrence product.",
    },
    "transitions": {
        "role": "long-term surface-water transition class",
        "period": "1984-2024 aggregated",
        "kind": "categorical",
    },
    "change": {
        "role": "occurrence change intensity",
        "period": "1984-2024 aggregated",
        "kind": "signed_or_encoded_change",
    },
    "seasonality": {
        "role": "number of months water is present",
        "period": "V1.5 published 2022-2024 component",
        "kind": "integer_month_count",
        "caveat": "A complete 1984-2024 seasonality history requires merging earlier assets with the corrected 2016-2021 and new 2022-2024 components.",
    },
    "extent": {
        "role": "maximum water extent",
        "period": "V1.5 published 2022-2024 component",
        "kind": "binary_or_categorical",
        "caveat": "Do not label this as a complete historical maximum without checking the merged earlier release.",
    },
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(*args: str, env: dict[str, str] | None = None) -> str:
    return subprocess.run(args, check=True, text=True, capture_output=True, env=env).stdout


def gdal_env() -> dict[str, str]:
    env = os.environ.copy()
    env.update({
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
        "GDAL_HTTP_MULTIRANGE": "YES",
        "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
        "CPL_VSIL_CURL_USE_HEAD": "NO",
        "VSI_CACHE": "TRUE",
        "VSI_CACHE_SIZE": str(64 * 1024 * 1024),
    })
    return env


def remote_record(session: requests.Session, url: str) -> dict:
    with session.get(url, headers={"Range": "bytes=0-3"}, timeout=(30, 120)) as response:
        response.raise_for_status()
        body = response.content
        if body[:4] not in {b"II*\x00", b"MM\x00*"}:
            raise RuntimeError(f"remote source lacks TIFF magic: {url}; status={response.status_code}; body={body[:120]!r}")
        headers = {k.lower(): v for k, v in response.headers.items()}
        total = None
        content_range = headers.get("content-range")
        if content_range and "/" in content_range:
            total_text = content_range.rsplit("/", 1)[1]
            if total_text.isdigit():
                total = int(total_text)
        return {
            "url": url,
            "httpStatus": response.status_code,
            "rangeRequest": "bytes=0-3",
            "tiffMagic": True,
            "contentRange": content_range,
            "remoteBytes": total,
            "etag": headers.get("etag"),
            "lastModified": headers.get("last-modified"),
            "contentType": headers.get("content-type"),
            "checkedAtUtc": now(),
        }


def raster_summary(path_or_vsi: str, env: dict[str, str], approximate_stats: bool = False) -> dict:
    args = ["gdalinfo", "-json"]
    if approximate_stats:
        args.append("-approx_stats")
    args.append(path_or_vsi)
    info = json.loads(run(*args, env=env))
    bands = info.get("bands") or []
    return {
        "driver": (info.get("driverShortName") or info.get("driverLongName")),
        "sizeColumnsRows": info.get("size"),
        "geoTransform": info.get("geoTransform"),
        "coordinateSystemWkt": (info.get("coordinateSystem") or {}).get("wkt"),
        "bandTypes": [b.get("type") for b in bands],
        "noDataValues": [b.get("noDataValue") for b in bands],
        "minimums": [b.get("minimum") for b in bands],
        "maximums": [b.get("maximum") for b in bands],
        "means": [b.get("mean") for b in bands],
    }


def aligned_extent(bounds: list[float], resolution: float) -> list[float]:
    xmin, ymin, xmax, ymax = bounds
    return [
        math.floor(xmin / resolution) * resolution,
        math.floor(ymin / resolution) * resolution,
        math.ceil(xmax / resolution) * resolution,
        math.ceil(ymax / resolution) * resolution,
    ]


def build_domain_mask(root: Path, extent: list[float], resolution: float, env: dict[str, str]) -> dict:
    xmin, ymin, xmax, ymax = LOCKED["bounds"]
    geojson = root / "reports" / "LOCKED_DOMAIN_EPSG32651.geojson"
    mask = root / "aligned_context" / "LOCKED_DOMAIN_MASK_EPSG32651_30M.tif"
    write_json(geojson, {
        "type": "FeatureCollection",
        "name": "Wenzhou locked domain R3.3",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32651"}},
        "features": [{
            "type": "Feature",
            "properties": {"role": "locked_canonical_domain"},
            "geometry": {"type": "Polygon", "coordinates": [[[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]]]},
        }],
    })
    exmin, eymin, exmax, eymax = map(str, extent)
    res = str(resolution)
    mask.parent.mkdir(parents=True, exist_ok=True)
    temp = mask.with_suffix(".work.tif")
    run(
        "gdal_rasterize", "-burn", "1", "-init", "0", "-ot", "Byte", "-a_nodata", "0",
        "-te", exmin, eymin, exmax, eymax, "-tr", res, res, "-tap",
        "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE",
        str(geojson), str(temp), env=env,
    )
    run("gdal_translate", "-of", "COG", "-co", "COMPRESS=DEFLATE", str(temp), str(mask), env=env)
    temp.unlink(missing_ok=True)
    return {
        "path": mask.relative_to(root).as_posix(),
        "bytes": mask.stat().st_size,
        "sha256": sha(mask),
        "gdal": raster_summary(str(mask), env),
    }


def materialize_product(root: Path, product: str, env: dict[str, str], session: requests.Session, extent: list[float], resolution: float) -> dict:
    urls = [f"{BASE}/{product}/{product}_{tile}_v1_5_2024.tif" for tile in TILES]
    remote = [remote_record(session, url) for url in urls]
    vsi = [f"/vsicurl/{url}" for url in urls]
    source_info = [raster_summary(path, env) for path in vsi]

    target = root / "aligned_context" / f"JRC_GSW_V1_5_2024_{product.upper()}_EPSG32651_30M_COG.tif"
    temp = target.with_suffix(".work.tif")
    target.parent.mkdir(parents=True, exist_ok=True)
    exmin, eymin, exmax, eymax = map(str, extent)
    res = str(resolution)
    target.unlink(missing_ok=True)
    temp.unlink(missing_ok=True)
    try:
        run(
            "gdalwarp", "-overwrite", "-t_srs", "EPSG:32651",
            "-te", exmin, eymin, exmax, eymax, "-tr", res, res, "-tap",
            "-r", "near", "-multi", "-wo", "NUM_THREADS=ALL_CPUS",
            "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=2", "-co", "BIGTIFF=IF_SAFER",
            *vsi, str(temp), env=env,
        )
        run(
            "gdal_translate", "-of", "COG", "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=YES", "-co", "LEVEL=6",
            str(temp), str(target), env=env,
        )
    finally:
        temp.unlink(missing_ok=True)
    summary = raster_summary(str(target), env, approximate_stats=True)
    cols, rows = summary["sizeColumnsRows"]
    expected_cols = int(round((extent[2] - extent[0]) / resolution))
    expected_rows = int(round((extent[3] - extent[1]) / resolution))
    if [cols, rows] != [expected_cols, expected_rows]:
        raise RuntimeError(f"{product} grid mismatch: {[cols, rows]} vs {[expected_cols, expected_rows]}")
    return {
        "product": product,
        **PRODUCTS[product],
        "sourceTiles": remote,
        "sourceTileGdal": source_info,
        "aligned": {
            "path": target.relative_to(root).as_posix(),
            "bytes": target.stat().st_size,
            "sha256": sha(target),
            "gdal": summary,
        },
        "checks": {
            "twoSourceTilesVerified": len(remote) == 2 and all(r["tiffMagic"] for r in remote),
            "alignedGridMatches": True,
            "canonicalDemUntouched": True,
            "doesNotClaim12p5mWaterTruth": True,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.output
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    env = gdal_env()
    session = requests.Session()
    session.headers.update({"User-Agent": "Wenzhou-R3.3-JRC-GSW/1.0 repository=haihao0307/guilin-dem-pipeline"})

    resolution = 30.0
    extent = aligned_extent(LOCKED["bounds"], resolution)
    records, failures = [], []
    for index, product in enumerate(PRODUCTS, 1):
        print(f"[{index}/{len(PRODUCTS)}] {product}", flush=True)
        try:
            records.append(materialize_product(root, product, env, session, extent, resolution))
        except Exception as exc:
            failures.append({"product": product, "error": repr(exc)})
            break

    mask = build_domain_mask(root, extent, resolution, env)
    passed = not failures and len(records) == len(PRODUCTS)
    report = {
        "schema": "wenzhou-jrc-global-surface-water/r3.3",
        "generatedAtUtc": now(),
        "passed": passed,
        "source": {
            "provider": "European Commission Joint Research Centre",
            "dataset": "Global Surface Water V1.5",
            "release": "1984-2024, published 2026-08-26",
            "baseUrl": BASE,
            "license": "Copernicus Programme, free of charge without restriction of use, attribution required",
            "attribution": "Source: EC JRC/Google",
            "sourceTileScheme": "10 degree by 10 degree",
            "sourceTileNames": TILES,
        },
        "lockedDomain": LOCKED,
        "lockedDomainWgs84Envelope": WGS84_ENVELOPE,
        "alignedContextGrid": {
            "crs": "EPSG:32651",
            "bounds": extent,
            "resolutionMeters": resolution,
            "rowsCols": [int(round((extent[3]-extent[1])/resolution)), int(round((extent[2]-extent[0])/resolution))],
            "role": "historical surface-water observation and constraint",
            "canonicalTruth": False,
        },
        "domainMask": mask,
        "records": records,
        "failures": failures,
        "interpretation": {
            "identity": "external_observation_and_historical_evidence",
            "landSeaTopologyReplacement": False,
            "riverNetworkReplacement": False,
            "productionReady": False,
            "requiredCrossChecks": ["OSM waterways and water polygons", "canonical DEM", "coastline topology", "local imagery and field evidence"],
        },
    }
    write_json(root / "reports" / "JRC_GSW_V1_5_ACQUISITION.json", report)
    payloads = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    write_json(root / "PAYLOAD_MANIFEST.json", {
        "schema": "wenzhou-jrc-gsw-payload-manifest/r3.3",
        "generatedAtUtc": now(),
        "passed": passed,
        "payloadCount": len(payloads),
        "totalBytes": sum(item["bytes"] for item in payloads),
        "payloads": payloads,
    })
    print(json.dumps({"passed": passed, "products": len(records), "failures": failures, "payloadCount": len(payloads), "totalBytes": sum(x["bytes"] for x in payloads)}, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
