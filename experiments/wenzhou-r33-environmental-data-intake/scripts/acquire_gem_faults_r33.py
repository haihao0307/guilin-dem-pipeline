#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

import requests

SOURCE_REPO = "GEMScienceTools/gem-global-active-faults"
SOURCE_COMMIT = "56816508ad92fd6846dad1163b1c8c01376a2cd1"
SOURCE_BLOB_SHA = "fb164770b529695544fa864abe2cc9dd8aa5793d"
SOURCE_SIZE = 10622730
BASE = f"https://raw.githubusercontent.com/{SOURCE_REPO}/{SOURCE_COMMIT}"
LOCKED_BOUNDS = [190475.0, 2991275.0, 411250.0, 3241862.5]
CONTEXT_BOUNDS = [90475.0, 2891275.0, 511250.0, 3341862.5]


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


def download(session: requests.Session, url: str, destination: Path) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with session.get(url, stream=True, timeout=(30, 600)) as response:
        response.raise_for_status()
        headers = {k.lower(): v for k, v in response.headers.items()}
        with destination.open("wb") as f:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)
    return {
        "url": url,
        "bytes": destination.stat().st_size,
        "sha256": sha(destination),
        "etag": headers.get("etag"),
        "lastModified": headers.get("last-modified"),
        "downloadedAtUtc": now(),
    }


def count_geojson(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    return len(data.get("features") or [])


def clip(source: Path, target: Path, bounds: list[float]) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.unlink(missing_ok=True)
    xmin, ymin, xmax, ymax = map(str, bounds)
    run(
        "ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:32651",
        "-clipsrc", xmin, ymin, xmax, ymax, "-clipsrc_srs", "EPSG:32651",
        "-lco", "RFC7946=NO", "-lco", "COORDINATE_PRECISION=3",
        str(target), str(source),
    )
    return {
        "path": target.as_posix(),
        "bytes": target.stat().st_size,
        "sha256": sha(target),
        "featureCount": count_geojson(target),
        "crs": "EPSG:32651",
        "clipBounds": bounds,
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
    session.headers.update({"User-Agent": "Wenzhou-R3.3-GEM-Faults/1.0 repository=haihao0307/guilin-dem-pipeline"})

    source = root / "source_native" / "gem_active_faults_harmonized.geojson"
    license_path = root / "source_native" / "LICENSE.txt"
    readme_path = root / "source_native" / "README.md"
    source_record = download(session, f"{BASE}/geojson/gem_active_faults_harmonized.geojson", source)
    license_record = download(session, f"{BASE}/LICENSE.txt", license_path)
    readme_record = download(session, f"{BASE}/README.md", readme_path)

    if source.stat().st_size != SOURCE_SIZE:
        raise RuntimeError(f"source size changed at fixed commit: {source.stat().st_size} vs {SOURCE_SIZE}")
    source_json = json.loads(source.read_text(encoding="utf-8"))
    source_features = len(source_json.get("features") or [])

    context_target = root / "derived" / "GEM_ACTIVE_FAULTS_100KM_CONTEXT_EPSG32651.geojson"
    exact_target = root / "derived" / "GEM_ACTIVE_FAULTS_LOCKED_DOMAIN_EPSG32651.geojson"
    context_record = clip(source, context_target, CONTEXT_BOUNDS)
    exact_record = clip(source, exact_target, LOCKED_BOUNDS)
    context_record["path"] = context_target.relative_to(root).as_posix()
    exact_record["path"] = exact_target.relative_to(root).as_posix()

    passed = source_record["bytes"] == SOURCE_SIZE and bool(source_record["sha256"]) and context_target.is_file() and exact_target.is_file()
    report = {
        "schema": "wenzhou-gem-active-faults/r3.3",
        "generatedAtUtc": now(),
        "passed": passed,
        "source": {
            "provider": "Global Earthquake Model Foundation",
            "repository": SOURCE_REPO,
            "commit": SOURCE_COMMIT,
            "gitBlobSha": SOURCE_BLOB_SHA,
            "license": "CC BY-SA 4.0",
            "sourceFeatureCount": source_features,
            "data": source_record,
            "licenseFile": license_record,
            "readmeFile": readme_record,
        },
        "lockedDomain": {"crs": "EPSG:32651", "bounds": LOCKED_BOUNDS},
        "context": context_record,
        "exactDomain": exact_record,
        "interpretation": {
            "identity": "external_geological_hazard_evidence",
            "uses": ["regional tectonic context", "geomorphology plausibility check", "seismic and landslide hazard priors"],
            "localEngineeringFaultTruth": False,
            "localLithologyOrParentMaterialMap": False,
            "mayModifyCanonicalDem": False,
            "shareAlikeAppliesToDerivatives": True,
            "productionReady": False,
        },
    }
    write_json(root / "reports" / "GEM_ACTIVE_FAULTS_ACQUISITION.json", report)
    payloads = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    write_json(root / "PAYLOAD_MANIFEST.json", {
        "schema": "wenzhou-gem-active-faults-manifest/r3.3", "generatedAtUtc": now(), "passed": passed,
        "payloadCount": len(payloads), "totalBytes": sum(x["bytes"] for x in payloads), "payloads": payloads,
    })
    print(json.dumps({"passed": passed, "sourceFeatures": source_features, "contextFeatures": context_record["featureCount"], "exactFeatures": exact_record["featureCount"], "payloadCount": len(payloads)}, ensure_ascii=False, indent=2))
    return 0 if passed else 2


if __name__ == "__main__":
    sys.exit(main())
