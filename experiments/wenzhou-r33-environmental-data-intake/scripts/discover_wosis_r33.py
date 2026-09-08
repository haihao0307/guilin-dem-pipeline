#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import requests

ENDPOINT = "https://maps.isric.org/mapserv"
MAP = "/map/wosis_latest.map"
BBOX = [119.8147394082622, 27.009129943046574, 122.10517761161395, 29.30263813887454]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def capabilities(session: requests.Session) -> tuple[bytes, str]:
    params = {"map": MAP, "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetCapabilities"}
    response = session.get(ENDPOINT, params=params, timeout=(30, 180))
    response.raise_for_status()
    return response.content, response.url


def parse_feature_types(content: bytes) -> list[dict]:
    root = ET.fromstring(content)
    result = []
    for node in root.iter():
        if local(node.tag) != "FeatureType":
            continue
        values: dict[str, str] = {}
        for child in list(node):
            name = local(child.tag)
            if name in {"Name", "Title", "Abstract", "DefaultCRS"} and child.text:
                values[name] = child.text.strip()
        if values.get("Name"):
            result.append({
                "name": values["Name"],
                "title": values.get("Title"),
                "abstract": values.get("Abstract"),
                "defaultCrs": values.get("DefaultCRS"),
            })
    return result


def count_hits(session: requests.Session, type_name: str, bbox_crs: str) -> dict:
    params = [
        ("map", MAP),
        ("SERVICE", "WFS"),
        ("VERSION", "2.0.0"),
        ("REQUEST", "GetFeature"),
        ("TYPENAMES", type_name),
        ("RESULTTYPE", "hits"),
        ("SRSNAME", "CRS:84"),
        ("BBOX", ",".join(map(str, BBOX)) + "," + bbox_crs),
    ]
    response = session.get(ENDPOINT, params=params, timeout=(30, 180))
    response.raise_for_status()
    root = ET.fromstring(response.content)
    number = root.attrib.get("numberMatched") or root.attrib.get("numberOfFeatures")
    if number in {None, "unknown"}:
        count = None
    else:
        count = int(number)
    return {
        "bboxCrs": bbox_crs,
        "requestUrl": response.url,
        "httpStatus": response.status_code,
        "numberMatched": count,
        "responseBytes": len(response.content),
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
    session.headers.update({"User-Agent": "Wenzhou-R3.3-WoSIS/1.0 repository=haihao0307/guilin-dem-pipeline"})

    content, request_url = capabilities(session)
    cap_path = root / "source" / "WOSIS_LATEST_WFS_2_0_0_GetCapabilities.xml"
    cap_path.parent.mkdir(parents=True, exist_ok=True)
    cap_path.write_bytes(content)
    feature_types = parse_feature_types(content)

    records = []
    for index, feature in enumerate(feature_types, 1):
        print(f"[{index}/{len(feature_types)}] {feature['name']}", flush=True)
        attempts = []
        selected = None
        errors = []
        for bbox_crs in ["CRS:84", "urn:ogc:def:crs:OGC:1.3:CRS84", "EPSG:4326"]:
            try:
                attempt = count_hits(session, feature["name"], bbox_crs)
                attempts.append(attempt)
                if attempt["numberMatched"] is not None:
                    selected = attempt
                    if attempt["numberMatched"] > 0:
                        break
            except Exception as exc:
                errors.append({"bboxCrs": bbox_crs, "error": repr(exc)})
        records.append({**feature, "selected": selected, "attempts": attempts, "errors": errors})

    hit_layers = [r for r in records if r.get("selected") and (r["selected"].get("numberMatched") or 0) > 0]
    report = {
        "schema": "wenzhou-wosis-layer-discovery/r3.3",
        "generatedAtUtc": now(),
        "passed": bool(feature_types),
        "source": {
            "provider": "ISRIC World Soil Information",
            "dataset": "WoSIS latest",
            "service": "OGC WFS 2.0.0",
            "endpoint": ENDPOINT,
            "mapfile": MAP,
            "authenticationRequired": False,
            "dynamicDataset": True,
            "recordLicensesMustBePreserved": True,
        },
        "capabilities": {"requestUrl": request_url, "path": cap_path.relative_to(root).as_posix(), "bytes": cap_path.stat().st_size, "sha256": sha(cap_path)},
        "queryBboxWgs84": BBOX,
        "featureTypeCount": len(feature_types),
        "layersWithHits": len(hit_layers),
        "hitLayers": [{"name": r["name"], "title": r.get("title"), "numberMatched": r["selected"]["numberMatched"]} for r in hit_layers],
        "records": records,
        "interpretation": {
            "identity": "external_point_observation",
            "purpose": "local calibration and contradiction checks for SoilGrids and field DNA",
            "mayInterpolateTo12p5mTruth": False,
            "positionalUncertaintyMustBeUsed": True,
            "samplingDateMustBeUsed": True,
            "analyticalMethodMustBeUsed": True,
        },
    }
    write_json(root / "reports" / "WOSIS_LAYER_DISCOVERY.json", report)
    payloads = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha(path)})
    write_json(root / "PAYLOAD_MANIFEST.json", {"schema": "wenzhou-wosis-discovery-manifest/r3.3", "generatedAtUtc": now(), "passed": bool(feature_types), "payloadCount": len(payloads), "totalBytes": sum(p["bytes"] for p in payloads), "payloads": payloads})
    print(json.dumps({"passed": bool(feature_types), "featureTypes": len(feature_types), "hitLayers": len(hit_layers), "hits": report["hitLayers"]}, ensure_ascii=False, indent=2))
    return 0 if feature_types else 2


if __name__ == "__main__":
    sys.exit(main())
