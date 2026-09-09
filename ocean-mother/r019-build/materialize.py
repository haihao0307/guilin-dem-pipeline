#!/usr/bin/env python3
"""Materialize Ocean Mother R019 from deterministic gzip/base64 source parts."""
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD = Path(__file__).resolve().parent
TARGET = ROOT / "ocean-mother" / "releases" / "Ocean_Mother_R019_KAOPU_Coast_Direct_Open.html"
RECEIPT = ROOT / "ocean-mother" / "releases" / "Ocean_Mother_R019_KAOPU_Coast_RECEIPT.json"
EXPECTED_SHA256 = "aca58d13aadefdce7029edb11f241f4bf18a1ddc89ed333738409a6b62da05d9"
EXPECTED_BYTES = 50620

parts = sorted(BUILD.glob("source.part*.b64"))
if len(parts) != 4:
    raise SystemExit(f"expected 4 source parts, found {len(parts)}")

packed = "".join(p.read_text(encoding="ascii").strip() for p in parts)
html = gzip.decompress(base64.b64decode(packed, validate=True))
sha256 = hashlib.sha256(html).hexdigest()
if sha256 != EXPECTED_SHA256 or len(html) != EXPECTED_BYTES:
    raise SystemExit(
        f"source mismatch: bytes={len(html)} sha256={sha256}; "
        f"expected bytes={EXPECTED_BYTES} sha256={EXPECTED_SHA256}"
    )

text = html.decode("utf-8")
checks = {
    "utf8_decodes": True,
    "standalone_no_script_src": not bool(re.search(r"<script\s+[^>]*src=", text, re.I)),
    "standalone_no_external_asset_url": not bool(re.search(r"(?:src|href)=[\"']https?://", text, re.I)),
    "webgl2_context": "getContext('webgl2'" in text,
    "shared_surface_query": "sampleSurfaceWorld" in text and "KAOPU-WATER-R1" in text,
    "gpu_float_query": "EXT_color_buffer_float" in text and "gl.readPixels" in text,
    "infinite_ocean_no_finite_ocean_mesh": "traceWater" in text and "PlaneGeometry" not in text,
    "three_continuous_smoke_sources": all(s in text for s in ["vec2(-42,-30)", "vec2(46,-8)", "vec2(-7,47)"]),
    "terrain_solid_rejection": "smoothstep(.05,1.8,p.y-terrainHeight(p.xz))" in text,
    "mobile_default_quality": "mobileMode?0:1" in text,
    "adaptive_resolution_floor": "resolutionBias>.70" in text,
    "mobile_non_overlap_layout": "bottom:100px" in text,
}
if not all(checks.values()):
    failed = [k for k, v in checks.items() if not v]
    raise SystemExit("static checks failed: " + ", ".join(failed))

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_bytes(html)
receipt = {
    "schema": "ocean-mother-release-receipt-v1",
    "release": "R019",
    "title": "Ocean Mother R019 · KAOPU Coast",
    "status": "candidate-awaiting-user-review",
    "artifact": {
        "path": str(TARGET.relative_to(ROOT)).replace("\\", "/"),
        "bytes": len(html),
        "sha256": sha256,
        "singleFileHtml": True,
        "externalRuntimeAssets": False,
    },
    "sourceLocks": {
        "reliableReleaseBaseline": {
            "branch": "release/ocean-mother-r01815-reliable-visible-20260907",
            "commit": "a6a534aba2a9ef7442238b09dc223d0e961688c6",
        },
        "completeRuntimeReference": "ocean-mother/restart-v0311/index.html",
        "oceanLearning": {
            "branch": "work/ocean-mother-ocean-coast-r1-20260907",
            "commit": "db6f63572dec97a688f32f98b2ad5b945418e731",
        },
        "kaopuKnowledge": {
            "branch": "handoff/kaopu-world-chorus-full-v1.0-20260909",
            "commit": "f254721b7e3e23cb35b7b660fa9441dc6cef9796",
        },
    },
    "implemented": [
        "infinite analytic ocean without a finite square mesh edge",
        "shared CPU and GPU OceanSurfaceState recipe",
        "tide, terrain depth, shoaling, breaker lip and foam coupling",
        "separate water-surface Fresnel and water-volume attenuation",
        "procedural irregular island, seabed and 18-sector rock family",
        "three non-particle continuous volumetric smoke/fire sources",
        "shared wind control for waves, smoke and fire",
        "terrain rejection and terrain-following lift for smoke",
        "desktop and 390x844 mobile responsive controls",
        "mobile-first low quality plus adaptive resolution floor",
    ],
    "staticChecks": checks,
    "localBrowserEvidence": {
        "environment": "Chromium 144.0.7559.96, WebGL2 through ANGLE SwiftShader, Xvfb",
        "shaderCompile": "pass",
        "consoleErrors": 0,
        "pageErrors": 0,
        "cpuGpuQuery": {
            "pass": True,
            "heightResidualMeters": 7.152557379708213e-09,
            "gradientResidual": 0.0,
            "thresholdHeightMeters": 0.002,
            "thresholdGradient": 0.003,
        },
        "desktopLayout": {
            "viewport": [1440, 900],
            "scrollExtent": [1440, 900],
            "controlsExercised": ["coast tab", "panel close/open", "fire camera"],
            "pass": True,
        },
        "mobileLayout": {
            "viewport": [390, 844],
            "scrollExtent": [390, 844],
            "panelBottom": 744,
            "viewBarTop": 746,
            "controlsExercised": ["coast tab", "panel close/open", "fire camera"],
            "defaultQuality": "mobile",
            "pass": True,
        },
        "note": "SwiftShader validates browser execution and layout, not target-device GPU performance.",
    },
    "limitations": {
        "realBathymetryOrDEMIntegrated": False,
        "smokeIsConservativePersistentCFD": False,
        "targetMacOSIOSHardwarePerformanceMeasured": False,
        "visualAcceptance": False,
        "productionReady": False,
        "aaaClaimed": False,
    },
}
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"artifact": receipt["artifact"], "checks": checks}, ensure_ascii=False, indent=2))
