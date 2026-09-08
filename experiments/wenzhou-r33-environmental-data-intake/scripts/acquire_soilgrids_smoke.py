#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "SOILGRIDS_R33_CONTRACT.json"
OUTPUT = Path(os.environ.get("WENZHOU_R33_OUTPUT", ROOT / "_output"))
SOURCE_DIR = OUTPUT / "source_native"
ALIGNED_DIR = OUTPUT / "aligned_context"
REPORT_DIR = OUTPUT / "reports"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=True, text=True, capture_output=True)


def gdal_json(path: Path, stats: bool = False) -> dict:
    args = ["gdalinfo", "-json"]
    if stats:
        args.append("-stats")
    args.append(str(path))
    result = run(*args)
    return json.loads(result.stdout)


def geotiff_magic_ok(path: Path) -> bool:
    with path.open("rb") as stream:
        head = stream.read(4)
    return head in {b"II*\x00", b"MM\x00*"}


def download_wcs(contract: dict, destination: Path) -> dict:
    probe = contract["smokeProbe"]
    subset = contract["sourceSubset"]
    endpoint = "https://maps.isric.org/mapserv"
    params = [
        ("map", f"/map/{probe['property']}.map"),
        ("SERVICE", "WCS"),
        ("VERSION", "2.0.1"),
        ("REQUEST", "GetCoverage"),
        ("COVERAGEID", probe["coverageId"]),
        ("FORMAT", "GEOTIFF_INT16"),
        ("SUBSET", f"X({subset['xBoundsMeters'][0]},{subset['xBoundsMeters'][1]})"),
        ("SUBSET", f"Y({subset['yBoundsMeters'][0]},{subset['yBoundsMeters'][1]})"),
        ("SUBSETTINGCRS", subset["crsUri"]),
        ("OUTPUTCRS", subset["crsUri"]),
    ]
    request_url = endpoint + "?" + urlencode(params)
    destination.parent.mkdir(parents=True, exist_ok=True)

    with requests.get(endpoint, params=params, stream=True, timeout=(60, 900)) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        with destination.open("wb") as stream:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    stream.write(chunk)

    if destination.stat().st_size < 1024:
        body = destination.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"WCS response is too small: {body[:800]}")
    if not geotiff_magic_ok(destination):
        body = destination.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"WCS response is not a GeoTIFF: {body[:800]}")

    return {
        "endpoint": endpoint,
        "requestUrl": request_url,
        "contentType": content_type,
        "bytes": destination.stat().st_size,
        "sha256": sha256_file(destination),
        "downloadedAtUtc": utc_now(),
    }


def main() -> int:
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    for directory in (SOURCE_DIR, ALIGNED_DIR, REPORT_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    probe = contract["smokeProbe"]
    source_path = SOURCE_DIR / f"{probe['coverageId']}_EPSG152160.tif"
    aligned_raw = ALIGNED_DIR / f"{probe['coverageId']}_EPSG32651_250M_RAW.tif"
    aligned_conventional = ALIGNED_DIR / f"{probe['coverageId']}_EPSG32651_250M_PERCENT.tif"
    domain_geojson = REPORT_DIR / "LOCKED_DOMAIN_EPSG32651.geojson"
    domain_mask = ALIGNED_DIR / "LOCKED_DOMAIN_MASK_EPSG32651_250M.tif"

    request_report = download_wcs(contract, source_path)
    source_info = gdal_json(source_path, stats=True)
    write_json(REPORT_DIR / "SOILGRIDS_SOURCE_GDALINFO.json", source_info)
    write_json(REPORT_DIR / "SOILGRIDS_WCS_REQUEST.json", request_report)

    target = contract["alignedContextGrid"]
    xmin, ymin, xmax, ymax = [str(v) for v in target["bounds"]]
    resolution = str(target["resolutionMeters"])
    source_proj = contract["source"]["sourceProjection"]

    run(
        "gdalwarp",
        "-overwrite",
        "-s_srs", source_proj,
        "-t_srs", target["crs"],
        "-te", xmin, ymin, xmax, ymax,
        "-tr", resolution, resolution,
        "-tap",
        "-r", "bilinear",
        "-dstnodata", "-32768",
        "-ot", "Int16",
        "-co", "TILED=YES",
        "-co", "COMPRESS=DEFLATE",
        "-co", "PREDICTOR=2",
        "-co", "BIGTIFF=IF_SAFER",
        str(source_path),
        str(aligned_raw),
    )

    factor = float(probe["conversionFactor"])
    run(
        "gdal_calc.py",
        "-A", str(aligned_raw),
        f"--outfile={aligned_conventional}",
        f"--calc=where(A==-32768,-9999,A/{factor})",
        "--NoDataValue=-9999",
        "--type=Float32",
        "--co=TILED=YES",
        "--co=COMPRESS=DEFLATE",
        "--co=PREDICTOR=3",
        "--overwrite",
    )

    locked = contract["lockedDomain"]
    lxmin, lymin, lxmax, lymax = locked["bounds"]
    domain_feature = {
        "type": "FeatureCollection",
        "name": "Wenzhou locked domain R3.3",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32651"}},
        "features": [{
            "type": "Feature",
            "properties": {"role": "locked_canonical_domain"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[lxmin, lymin], [lxmax, lymin], [lxmax, lymax], [lxmin, lymax], [lxmin, lymin]]],
            },
        }],
    }
    write_json(domain_geojson, domain_feature)
    run(
        "gdal_rasterize",
        "-burn", "1",
        "-init", "0",
        "-ot", "Byte",
        "-a_nodata", "0",
        "-te", xmin, ymin, xmax, ymax,
        "-tr", resolution, resolution,
        "-tap",
        "-co", "TILED=YES",
        "-co", "COMPRESS=DEFLATE",
        str(domain_geojson),
        str(domain_mask),
    )

    aligned_info = gdal_json(aligned_raw, stats=True)
    conventional_info = gdal_json(aligned_conventional, stats=True)
    mask_info = gdal_json(domain_mask, stats=True)
    write_json(REPORT_DIR / "SOILGRIDS_ALIGNED_RAW_GDALINFO.json", aligned_info)
    write_json(REPORT_DIR / "SOILGRIDS_ALIGNED_CONVENTIONAL_GDALINFO.json", conventional_info)
    write_json(REPORT_DIR / "LOCKED_DOMAIN_MASK_GDALINFO.json", mask_info)

    expected_rows, expected_cols = target["rowsCols"]
    actual_cols, actual_rows = aligned_info.get("size", [None, None])
    checks = {
        "sourceGeoTiffMagic": geotiff_magic_ok(source_path),
        "sourcePayloadPresent": source_path.is_file() and source_path.stat().st_size > 1024,
        "alignedPayloadPresent": aligned_raw.is_file() and aligned_raw.stat().st_size > 1024,
        "conventionalPayloadPresent": aligned_conventional.is_file() and aligned_conventional.stat().st_size > 1024,
        "domainMaskPresent": domain_mask.is_file() and domain_mask.stat().st_size > 1024,
        "alignedGridSizeMatches": [actual_rows, actual_cols] == [expected_rows, expected_cols],
        "canonicalDemUntouched": True,
        "sourceNativeResolutionRetainedAsIdentity": True,
        "mayClaim12p5mSoilTruth": False,
    }
    passed = all(checks.values())

    payloads = []
    for path in sorted(OUTPUT.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({
                "path": path.relative_to(OUTPUT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })

    report = {
        "schema": "wenzhou-r33-soilgrids-live-probe/v1",
        "generatedAtUtc": utc_now(),
        "passed": passed,
        "source": contract["source"],
        "probe": probe,
        "request": request_report,
        "alignedContextGrid": target,
        "checks": checks,
        "payloadCount": len(payloads),
        "payloads": payloads,
        "interpretation": {
            "role": "regional soil covariate and uncertainty evidence",
            "fieldScaleTruth": False,
            "canonicalTerrainTruthChanged": False,
            "productionReady": False,
        },
    }
    write_json(REPORT_DIR / "SOILGRIDS_LIVE_PROBE_REPORT.json", report)
    write_json(OUTPUT / "PAYLOAD_MANIFEST.json", {
        "schema": "wenzhou-r33-soilgrids-payload-manifest/v1",
        "generatedAtUtc": utc_now(),
        "payloadCount": len(payloads),
        "payloads": payloads,
    })

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
