#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import base64
import gzip
import hashlib
import json

HERE = Path(__file__).resolve().parent
receipt = json.loads((HERE / "BUILD_RECEIPT.json").read_text(encoding="utf-8"))
expected_names = [f"part-{index:02d}.txt" for index in range(receipt["parts"])]
parts = [HERE / name for name in expected_names]

missing = [path.name for path in parts if not path.is_file()]
if missing:
    raise SystemExit(f"Missing payload parts: {missing}")

base64_text = "".join(path.read_text(encoding="ascii").strip() for path in parts)
gzip_bytes = base64.b64decode(base64_text, validate=True)
html_bytes = gzip.decompress(gzip_bytes)
html_sha = hashlib.sha256(html_bytes).hexdigest()
gzip_sha = hashlib.sha256(gzip_bytes).hexdigest()
base64_sha = hashlib.sha256(base64_text.encode("ascii")).hexdigest()

checks = {
    "partNamesAndCount": len(parts) == receipt["parts"] == 8,
    "fullHtmlBytes": len(html_bytes) == receipt["fullHtmlBytes"],
    "gzipBytes": len(gzip_bytes) == receipt["gzipBytes"],
    "base64Bytes": len(base64_text) == receipt["base64Bytes"],
    "fullHtmlSha256": html_sha == receipt["fullHtmlSha256"],
    "gzipSha256": gzip_sha == receipt["gzipSha256"],
    "base64Sha256": base64_sha == receipt["base64Sha256"],
    "worldId": b"PALAU_AIRAI_STONE_MONEY_R03C_FOCUSED" in html_bytes,
    "oneWorldQuery": b"window.PalauWorld=" in html_bytes and b"PalauWorld.sample" in html_bytes,
    "qaExport": b"window.__PALAU_R03C_QA__" in html_bytes,
    "noTraditionalLod": receipt["traditionalLOD"] is False,
    "sameWorldField": receipt["sameWorldField"] is True,
    "localTruthQuality": receipt["quantizationQA"]["localResidualQuantRMSEM"] < 0.08,
    "visualNotPreapproved": receipt["visualAcceptance"] is False,
    "oceanMotherBoundaryDeclared": receipt["acceptedOceanMotherIntegrated"] is False,
}

report = {
    "version": receipt["version"],
    "worldId": receipt["worldId"],
    "passed": all(checks.values()),
    "checks": checks,
    "hashes": {
        "fullHtmlSha256": html_sha,
        "gzipSha256": gzip_sha,
        "base64Sha256": base64_sha,
    },
    "bytes": {
        "fullHtml": len(html_bytes),
        "gzip": len(gzip_bytes),
        "base64": len(base64_text),
    },
    "parts": expected_names,
    "visualAcceptance": False,
}

(HERE / "STATIC_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["passed"]:
    raise SystemExit(1)
