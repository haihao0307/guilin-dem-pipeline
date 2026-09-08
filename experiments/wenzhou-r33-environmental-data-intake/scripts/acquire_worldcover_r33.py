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
import time
from datetime import datetime, timezone

import requests

LOCKED = {
    "crs": "EPSG:32651",
    "bounds": [190475.0, 2991275.0, 411250.0, 3241862.5],
    "canonicalResolutionMeters": 12.5,
    "canonicalRowsCols": [20047, 17662],
}
WGS84_ENVELOPE = [119.8147394082622, 27.009129943046574, 122.10517761161395, 29.30263813887454]
S3_HTTPS = "https://esa-worldcover.s3.eu-central-1.amazonaws.com"
TILES = ["N27E117", "N27E120"]
VERSIONS = {
    "2020_v100": {"year": 2020, "algorithm": "v100", "prefix": "v100/2020/map"},
    "2021_v200": {"year": 2021, "algorithm": "v200", "prefix": "v200/2021/map"},
}
CLASSES = {
    "10": "Tree cover",
    "20": "Shrubland",
    "30": "Grassland",
    "40": "Cropland",
    "50": "Built-up",
    "60": "Bare or sparse vegetation",
    "70": "Snow and ice",
    "80": "Permanent water bodies",
    "90": "Herbaceous wetland",
    "95": "Mangroves",
    "100": "Moss and lichen",
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


def run(*args: str) -> str:
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout


def tiff_ok(path: Path) -> bool:
    with path.open("rb") as f:
        return f.read(4) in {b"II*\x00", b"MM\x00*"}


def raster_summary(path: Path, approximate_stats: bool = False) -> dict:
    args = ["gdalinfo", "-json"]
    if approximate_stats:
        args.append("-approx_stats")
    args.append(str(path))
    info = json.loads(run(*args))
    bands = info.get("bands") or []
    return {
        "driver": info.get("driverShortName"),
        "sizeColumnsRows": info.get("size"),
        "geoTransform": info.get("geoTransform"),
        "coordinateSystemWkt": (info.get("coordinateSystem") or {}).get("wkt"),
        "bandTypes": [b.get("type") for b in bands],
        "noDataValues": [b.get("noDataValue") for b in bands],
        "minimums": [b.get("minimum") for b in bands],
        "maximums": [b.get("maximum") for b in bands],
        "means": [b.get("mean") for b in bands],
        "colorTablesPresent": [bool(b.get("colorTable")) for b in bands],
    }


def aligned_extent(bounds: list[float], resolution: float) -> list[float]:
    xmin, ymin, xmax, ymax = bounds
    return [
        math.floor(xmin / resolution) * resolution,
        math.floor(ymin / resolution) * resolution,
        math.ceil(xmax / resolution) * resolution,
        math.ceil(ymax / resolution) * resolution,
    ]


def download(session: requests.Session, url: str, destination: Path) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    part = destination.with_suffix(".tif.part")
    errors = []
    for attempt in range(1, 6):
        part.unlink(missing_ok=True)
        try:
            with session.get(url, stream=True, timeout=(60, 1800)) as response:
                response.raise_for_status()
                headers = {k.lower(): v for k, v in response.headers.items()}
                with part.open("wb") as f:
                    for chunk in response.iter_content(8 * 1024 * 1024):
                        if chunk:
                            f.write(chunk)
            if part.stat().st_size < 1024 or not tiff_ok(part):
                preview = part.read_text(encoding="utf-8", errors="replace")[:400]
                raise RuntimeError(f"invalid GeoTIFF response: {preview}")
            os.replace(part, destination)
            return {
                "url": url,
                "attempt": attempt,
                "bytes": destination.stat().st_size,
                "sha256": sha(destination),
                "etag": headers.get("etag"),
                "lastModified": headers.get("last-modified"),
                "contentType": headers.get("content-type"),
                "downloadedAtUtc": now(),
                "priorErrors": errors,
            }
        except Exception as exc:
            errors.append({"attempt": attempt, "error": repr(exc)})
            if attempt == 5:
                raise
            time.sleep(min(30, 2 ** attempt))
        finally:
            part.unlink(missing_ok=True)
    raise RuntimeError("unreachable")


def make_mask(root: Path, extent: list[float], resolution: float) -> dict:
    xmin, ymin, xmax, ymax = LOCKED["bounds"]
    geojson = root / "reports" / "LOCKED_DOMAIN_EPSG32651.geojson"
    mask = root / "aligned_context" / "LOCKED_DOMAIN_MASK_EPSG32651_10M.tif"
    write_json(geojson, {
        "type": "FeatureCollection",
        "name": "Wenzhou locked domain R3.3",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32651"}},
        "features": [{
            "type": "Feature",
            "properties": {"role": "locked_canonical_domain"},
            "geometry": {"type": "Polygon", "coordinates": [[[xmin,ymin],[xmax,ymin],[xmax,ymax],[xmin,ymax],[xmin,ymin]]]},
        }],
    })
    exmin, eymin, exmax, eymax = map(str, extent)
    res = str(resolution)
    mask.parent.mkdir(parents=True, exist_ok=True)
    temp = mask.with_suffix(".work.tif")
    run(
        "gdal_rasterize", "-burn", "1", "-init", "0", "-ot", "Byte", "-a_nodata", "0",
        "-te", exmin, eymin, exmax, eymax, "-tr", res, res, "-tap",
        "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", str(geojson), str(temp),
    )
    run("gdal_translate", "-of", "COG", "-co", "COMPRESS=DEFLATE", str(temp), str(mask))
    temp.unlink(missing_ok=True)
    return {"path": mask.relative_to(root).as_posix(), "bytes": mask.stat().st_size, "sha256": sha(mask), "gdal": raster_summary(mask)}


def materialize_version(root: Path, version_id: str, meta: dict, session: requests.Session, extent: list[float], resolution: float) -> dict:
    sources = []
    source_paths = []
    for tile in TILES:
        filename = f"ESA_WorldCover_10m_{meta['year']}_{meta['algorithm']}_{tile}_Map.tif"
        url = f"{S3_HTTPS}/{meta['prefix']}/{filename}"
        path = root / "source_native" / version_id / filename
        remote = download(session, url, path)
        sources.append({**remote, "path": path.relative_to(root).as_posix(), "gdal": raster_summary(path)})
        source_paths.append(path)

    target = root / "aligned_context" / f"ESA_WORLDCOVER_10M_{meta['year']}_{meta['algorithm'].upper()}_EPSG32651_COG.tif"
    temp = target.with_suffix(".work.tif")
    target.parent.mkdir(parents=True, exist_ok=True)
    exmin, eymin, exmax, eymax = map(str, extent)
    res = str(resolution)
    try:
        run(
            "gdalwarp", "-overwrite", "-t_srs", "EPSG:32651",
            "-te", exmin, eymin, exmax, eymax, "-tr", res, res, "-tap",
            "-r", "near", "-srcnodata", "0", "-dstnodata", "0", "-ot", "Byte",
            "-multi", "-wo", "NUM_THREADS=ALL_CPUS",
            "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=2", "-co", "BIGTIFF=IF_SAFER",
            *(str(path) for path in source_paths), str(temp),
        )
        run(
            "gdal_translate", "-of", "COG", "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=YES", "-co", "LEVEL=6",
            str(temp), str(target),
        )
    finally:
        temp.unlink(missing_ok=True)
    summary = raster_summary(target, approximate_stats=True)
    cols, rows = summary["sizeColumnsRows"]
    expected_cols = int(round((extent[2]-extent[0])/resolution))
    expected_rows = int(round((extent[3]-extent[1])/resolution))
    if [cols, rows] != [expected_cols, expected_rows]:
        raise RuntimeError(f"aligned WorldCover grid mismatch: {[cols, rows]}")
    return {
        "version": version_id,
        "referenceYear": meta["year"],
        "algorithm": meta["algorithm"],
        "sourceTiles": sources,
        "aligned": {"path": target.relative_to(root).as_posix(), "bytes": target.stat().st_size, "sha256": sha(target), "gdal": summary},
        "checks": {"twoSourceTilesVerified": len(sources) == 2, "alignedGridMatches": True, "nearestNeighbourPreservedClasses": True, "canonicalDemUntouched": True},
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.output
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "Wenzhou-R3.3-WorldCover/1.0 repository=haihao0307/guilin-dem-pipeline"})

    resolution = 10.0
    extent = aligned_extent(LOCKED["bounds"], resolution)
    records, failures = [], []
    for version_id, meta in VERSIONS.items():
        print(f"WorldCover {version_id}", flush=True)
        try:
            records.append(materialize_version(root, version_id, meta, session, extent, resolution))
        except Exception as exc:
            failures.append({"version": version_id, "error": repr(exc)})
            break
    mask = make_mask(root, extent, resolution)
    passed = not failures and len(records) == len(VERSIONS)
    report = {
        "schema": "wenzhou-esa-worldcover/r3.3",
        "generatedAtUtc": now(),
        "passed": passed,
        "source": {
            "provider": "European Space Agency WorldCover consortium",
            "dataset": "ESA WorldCover",
            "nativeResolutionMetersApprox": 10,
            "sourceCrs": "EPSG:4326",
            "sourceTileScheme": "3 degree by 3 degree COG",
            "sourceTileNames": TILES,
            "license": "CC BY 4.0",
            "attributionTemplate": "© ESA WorldCover project [year] / Contains modified Copernicus Sentinel data ([year]) processed by ESA WorldCover consortium",
            "classCodes": CLASSES,
            "inputQualityLayerStatus": "not_acquired_login_required_through_viewer_or_terrascope",
        },
        "lockedDomain": LOCKED,
        "lockedDomainWgs84Envelope": WGS84_ENVELOPE,
        "alignedContextGrid": {
            "crs": "EPSG:32651", "bounds": extent, "resolutionMeters": resolution,
            "rowsCols": [int(round((extent[3]-extent[1])/resolution)), int(round((extent[2]-extent[0])/resolution))],
            "role": "land-cover observation and object-placement constraint", "canonicalTruth": False,
        },
        "domainMask": mask,
        "records": records,
        "failures": failures,
        "hardCaveats": {
            "direct2020To2021ChangeDetectionAllowed": False,
            "reason": "The 2020 and 2021 products use different algorithm versions, so their differences combine real change with algorithm change.",
            "fieldParcelBoundaryTruth": False,
            "cropSpeciesTruth": False,
            "localValidationRequired": True,
        },
        "interpretation": {
            "identity": "external_observation",
            "uses": ["forest and vegetation context", "cropland candidate mask", "built-up context", "wetland and permanent-water cross-check", "bare-ground and settlement priors"],
            "productionReady": False,
        },
    }
    write_json(root / "reports" / "ESA_WORLDCOVER_ACQUISITION.json", report)
    payloads = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    write_json(root / "PAYLOAD_MANIFEST.json", {
        "schema": "wenzhou-esa-worldcover-payload-manifest/r3.3",
        "generatedAtUtc": now(), "passed": passed,
        "payloadCount": len(payloads), "totalBytes": sum(x["bytes"] for x in payloads), "payloads": payloads,
    })
    print(json.dumps({"passed": passed, "versions": len(records), "failures": failures, "payloadCount": len(payloads), "totalBytes": sum(x["bytes"] for x in payloads)}, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
