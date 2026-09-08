#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "SOILGRIDS_COMPLETE_PROFILE_R33.json"


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


def raster_summary(path: Path) -> dict:
    info = json.loads(run("gdalinfo", "-json", str(path)))
    bands = info.get("bands") or []
    return {
        "sizeColumnsRows": info.get("size"),
        "geoTransform": info.get("geoTransform"),
        "bandTypes": [b.get("type") for b in bands],
        "noDataValues": [b.get("noDataValue") for b in bands],
    }


def plan(contract: dict, group: str) -> list[dict]:
    if group == "wrb":
        return [
            {
                "property": "wrb",
                "coverageId": name,
                "depth": None,
                "statistic": "class_probability_or_most_probable",
                "resampling": "near" if name == "MostProbable" else "bilinear",
                "mappedUnit": "class code" if name == "MostProbable" else "probability score",
                "conversionFactor": 1,
                "conventionalUnit": "class code" if name == "MostProbable" else "probability score",
            }
            for name in contract["wrbCoverageIds"]
        ]
    result = []
    for prop in contract["groups"][group]:
        meta = contract["properties"][prop]
        depths = ["0-30cm"] if prop == "ocs" else contract["depths"]
        for depth in depths:
            for statistic in contract["statistics"]:
                result.append(
                    {
                        "property": prop,
                        "coverageId": f"{prop}_{depth}_{statistic}",
                        "depth": depth,
                        "statistic": statistic,
                        "resampling": meta["resampling"],
                        "mappedUnit": meta["mappedUnit"],
                        "conversionFactor": meta["conversionFactor"],
                        "conventionalUnit": meta["conventionalUnit"],
                    }
                )
    return result


def download(session: requests.Session, contract: dict, item: dict, destination: Path) -> dict:
    src = contract["source"]
    subset = contract["sourceSubset"]
    params = [
        ("map", f"/map/{item['property']}.map"),
        ("SERVICE", "WCS"),
        ("VERSION", "2.0.1"),
        ("REQUEST", "GetCoverage"),
        ("COVERAGEID", item["coverageId"]),
        ("FORMAT", "GEOTIFF_INT16"),
        ("SUBSET", f"X({subset['xBoundsMeters'][0]},{subset['xBoundsMeters'][1]})"),
        ("SUBSET", f"Y({subset['yBoundsMeters'][0]},{subset['yBoundsMeters'][1]})"),
        ("SUBSETTINGCRS", subset["crsUri"]),
        ("OUTPUTCRS", subset["crsUri"]),
    ]
    destination.parent.mkdir(parents=True, exist_ok=True)
    part = destination.with_suffix(".tif.part")
    errors = []
    for attempt in range(1, 6):
        part.unlink(missing_ok=True)
        try:
            with session.get(src["endpoint"], params=params, stream=True, timeout=(60, 900)) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                with part.open("wb") as f:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            f.write(chunk)
            if part.stat().st_size < 1024 or not tiff_ok(part):
                preview = part.read_text(encoding="utf-8", errors="replace")[:800]
                raise RuntimeError(f"invalid GeoTIFF response: {preview}")
            os.replace(part, destination)
            return {
                "requestUrl": src["endpoint"] + "?" + urlencode(params),
                "attempt": attempt,
                "contentType": content_type,
                "bytes": destination.stat().st_size,
                "sha256": sha(destination),
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


def align(contract: dict, item: dict, source: Path, target: Path) -> dict:
    grid = contract["alignedContextGrid"]
    xmin, ymin, xmax, ymax = map(str, grid["bounds"])
    res = str(grid["resolutionMeters"])
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(".work.tif")
    target.unlink(missing_ok=True)
    temp.unlink(missing_ok=True)
    try:
        run(
            "gdalwarp", "-overwrite",
            "-s_srs", contract["source"]["sourceProjection"],
            "-t_srs", grid["crs"],
            "-te", xmin, ymin, xmax, ymax,
            "-tr", res, res, "-tap",
            "-r", item["resampling"],
            "-srcnodata", "-32768", "-dstnodata", "-32768",
            "-ot", "Int16", "-multi", "-wo", "NUM_THREADS=ALL_CPUS",
            "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=2",
            str(source), str(temp),
        )
        run(
            "gdal_translate", "-of", "COG",
            "-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=YES", "-co", "LEVEL=6",
            str(temp), str(target),
        )
    finally:
        temp.unlink(missing_ok=True)
    info = raster_summary(target)
    cols, rows = info["sizeColumnsRows"]
    expected_rows, expected_cols = grid["rowsCols"]
    if [rows, cols] != [expected_rows, expected_cols]:
        raise RuntimeError(f"aligned grid mismatch: got {[rows, cols]}")
    return {"bytes": target.stat().st_size, "sha256": sha(target), "gdal": info}


def make_mask(contract: dict, root: Path) -> dict:
    grid = contract["alignedContextGrid"]
    xmin, ymin, xmax, ymax = contract["lockedDomain"]["bounds"]
    geojson = root / "reports" / "LOCKED_DOMAIN_EPSG32651.geojson"
    mask = root / "aligned_context" / "LOCKED_DOMAIN_MASK_EPSG32651_250M.tif"
    write_json(
        geojson,
        {
            "type": "FeatureCollection",
            "name": "Wenzhou locked domain R3.3",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32651"}},
            "features": [{
                "type": "Feature",
                "properties": {"role": "locked_canonical_domain"},
                "geometry": {"type": "Polygon", "coordinates": [[[xmin,ymin],[xmax,ymin],[xmax,ymax],[xmin,ymax],[xmin,ymin]]]},
            }],
        },
    )
    txmin, tymin, txmax, tymax = map(str, grid["bounds"])
    res = str(grid["resolutionMeters"])
    mask.parent.mkdir(parents=True, exist_ok=True)
    run(
        "gdal_rasterize", "-burn", "1", "-init", "0", "-ot", "Byte", "-a_nodata", "0",
        "-te", txmin, tymin, txmax, tymax, "-tr", res, res, "-tap",
        "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", str(geojson), str(mask),
    )
    return {"path": mask.relative_to(root).as_posix(), "bytes": mask.stat().st_size, "sha256": sha(mask), "gdal": raster_summary(mask)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", required=True, choices=["physical_texture", "chemical_carbon", "hydraulic", "wrb"])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    group = args.group
    output = args.output or Path(os.environ.get("WENZHOU_R33_OUTPUT", ROOT / f"_output_{group}"))
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    items = plan(contract, group)
    expected = contract["coverageCounts"][group]
    if len(items) != expected:
        raise RuntimeError(f"planned {len(items)} coverages, expected {expected}")

    session = requests.Session()
    session.headers.update({"User-Agent": "Wenzhou-R3.3-SoilGrids/1.0 repository=haihao0307/guilin-dem-pipeline"})
    mask_record = make_mask(contract, output)
    records, failures = [], []
    for index, item in enumerate(items, 1):
        cid = item["coverageId"]
        print(f"[{index}/{expected}] {cid}", flush=True)
        src = output / "source_native" / item["property"] / f"{cid}_EPSG152160.tif"
        dst = output / "aligned_context" / item["property"] / f"{cid}_EPSG32651_250M.tif"
        record = {**item, "index": index, "startedAtUtc": now()}
        try:
            request = download(session, contract, item, src)
            aligned = align(contract, item, src, dst)
            record.update({
                "passed": True,
                "request": request,
                "sourceNative": {"path": src.relative_to(output).as_posix(), "bytes": src.stat().st_size, "sha256": sha(src), "gdal": raster_summary(src)},
                "alignedContext": {"path": dst.relative_to(output).as_posix(), **aligned},
                "checks": {"sourceGeoTiffMagic": tiff_ok(src), "alignedGridSizeMatches": True, "doesNotClaim12p5mSoilTruth": True},
                "completedAtUtc": now(),
            })
        except Exception as exc:
            record.update({"passed": False, "error": repr(exc), "completedAtUtc": now()})
            failures.append({"coverageId": cid, "error": repr(exc)})
        records.append(record)
        if failures:
            break
        time.sleep(0.10)

    passed = not failures and len(records) == expected and all(r.get("passed") for r in records)
    report = {
        "schema": "wenzhou-soilgrids-group-acquisition/r3.3",
        "generatedAtUtc": now(),
        "group": group,
        "passed": passed,
        "expectedCoverageCount": expected,
        "completedCoverageCount": sum(bool(r.get("passed")) for r in records),
        "source": contract["source"],
        "sourceSubset": contract["sourceSubset"],
        "alignedContextGrid": contract["alignedContextGrid"],
        "lockedDomain": contract["lockedDomain"],
        "domainMask": mask_record,
        "failures": failures,
        "records": records,
        "interpretation": {"role": "regional soil profile, class and uncertainty evidence", "fieldScaleTruth": False, "canonicalTerrainTruthChanged": False, "productionReady": False, "localCalibrationRequired": True},
    }
    write_json(output / "reports" / f"SOILGRIDS_{group.upper()}_ACQUISITION.json", report)
    payloads = []
    for path in sorted(output.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({"path": path.relative_to(output).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    manifest = {"schema": "wenzhou-soilgrids-group-payload-manifest/r3.3", "generatedAtUtc": now(), "group": group, "passed": passed, "payloadCount": len(payloads), "totalBytes": sum(p["bytes"] for p in payloads), "payloads": payloads}
    write_json(output / "PAYLOAD_MANIFEST.json", manifest)
    print(json.dumps({"group": group, "passed": passed, "expected": expected, "completed": report["completedCoverageCount"], "payloadCount": manifest["payloadCount"], "totalBytes": manifest["totalBytes"], "failures": failures}, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
