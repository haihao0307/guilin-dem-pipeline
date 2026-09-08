#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import requests

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("WENZHOU_R33_CATALOG_OUTPUT", ROOT / "_catalog_output"))
PROPERTIES = [
    "bdod", "cec", "cfvo", "clay", "nitrogen", "ocd", "ocs", "phh2o",
    "sand", "silt", "soc", "wv0010", "wv0033", "wv1500", "wrb"
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_coverage_ids(xml_bytes: bytes) -> list[str]:
    root = ET.fromstring(xml_bytes)
    ids: set[str] = set()
    for element in root.iter():
        if local_name(element.tag) in {"CoverageId", "Identifier"} and element.text:
            text = element.text.strip()
            if text:
                ids.add(text)
    return sorted(ids)


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    endpoint = "https://maps.isric.org/mapserv"
    records = []
    all_ok = True

    for prop in PROPERTIES:
        params = {
            "map": f"/map/{prop}.map",
            "SERVICE": "WCS",
            "VERSION": "2.0.1",
            "REQUEST": "GetCapabilities",
        }
        record = {"property": prop, "requestedAtUtc": utc_now()}
        try:
            response = requests.get(endpoint, params=params, timeout=(30, 180))
            record["httpStatus"] = response.status_code
            record["contentType"] = response.headers.get("content-type", "")
            record["requestUrl"] = response.url
            response.raise_for_status()
            xml_path = OUTPUT / f"{prop}_WCS_2_0_1_GetCapabilities.xml"
            xml_path.write_bytes(response.content)
            coverage_ids = parse_coverage_ids(response.content)
            record.update({
                "passed": True,
                "bytes": xml_path.stat().st_size,
                "sha256": sha256_file(xml_path),
                "coverageCount": len(coverage_ids),
                "coverageIds": coverage_ids,
            })
        except Exception as exc:
            all_ok = False
            record.update({"passed": False, "error": repr(exc)})
        records.append(record)

    report = {
        "schema": "soilgrids-wcs-catalog-discovery/r3.3",
        "generatedAtUtc": utc_now(),
        "endpoint": endpoint,
        "passed": all_ok,
        "propertyCount": len(PROPERTIES),
        "records": records,
    }
    report_path = OUTPUT / "SOILGRIDS_WCS_CATALOG_DISCOVERY.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    payloads = []
    for path in sorted(OUTPUT.glob("*")):
        if path.is_file() and path.name != "PAYLOAD_MANIFEST.json":
            payloads.append({
                "path": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })
    (OUTPUT / "PAYLOAD_MANIFEST.json").write_text(
        json.dumps({
            "schema": "soilgrids-wcs-catalog-discovery-manifest/r3.3",
            "generatedAtUtc": utc_now(),
            "payloadCount": len(payloads),
            "payloads": payloads,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())
