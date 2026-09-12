#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if (ROOT / "HANDOFF").is_dir():
    PACKAGE_ROOT = ROOT
    HANDOFF = ROOT / "HANDOFF"
else:
    PACKAGE_ROOT = ROOT
    HANDOFF = ROOT

required = [
    HANDOFF / "00_START_HERE.md",
    HANDOFF / "01_CURRENT_STATE.md",
    HANDOFF / "02_SOURCE_LOCKS.json",
    HANDOFF / "03_ARCHITECTURE_DECISIONS.md",
    HANDOFF / "04_USER_JUDGMENT_AND_CORRECTIONS.md",
    HANDOFF / "05_R27_NEXT_WORK.md",
    HANDOFF / "06_QA_AND_PUBLICATION_COORDINATES.md",
    HANDOFF / "07_PACKAGE_SCOPE.md",
    HANDOFF / "08_PACKAGE_CHECKLIST.json",
]

if (PACKAGE_ROOT / "HANDOFF").is_dir():
    required.extend(
        [
            PACKAGE_ROOT / "CURRENT_R26" / "index.html",
            PACKAGE_ROOT / "CURRENT_R26" / "PUBLIC_QA_MOBILE_OBSERVATION_BANDWIDTH_2026-09-11.json",
            PACKAGE_ROOT / "MOBILE_SAFE_LINE" / "r23-mobile-recovery-src" / "mobile-safe-aircraft.html",
            PACKAGE_ROOT / "FROZEN_R21_R22" / "R21" / "index.html",
            PACKAGE_ROOT / "FROZEN_R21_R22" / "R22" / "index.html",
            PACKAGE_ROOT / "FROZEN_R14" / "index.html",
            PACKAGE_ROOT / "TEN_CLOUD_R02" / "weather-mother-yohei-cloud-atlas-r02.html",
            PACKAGE_ROOT / "MANIFEST" / "SHA256SUMS.txt",
            PACKAGE_ROOT / "MANIFEST" / "TREE.txt",
            PACKAGE_ROOT / "MANIFEST" / "BUILD_RECEIPT.json",
        ]
    )

missing = [str(p.relative_to(PACKAGE_ROOT)) for p in required if not p.is_file()]
if missing:
    print(json.dumps({"ok": False, "missing": missing}, ensure_ascii=False, indent=2))
    raise SystemExit(1)

for json_file in [HANDOFF / "02_SOURCE_LOCKS.json", HANDOFF / "08_PACKAGE_CHECKLIST.json"]:
    json.loads(json_file.read_text(encoding="utf-8"))

manifest = PACKAGE_ROOT / "MANIFEST" / "SHA256SUMS.txt"
checked = 0
hash_errors: list[dict[str, str]] = []
if manifest.is_file():
    for raw in manifest.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        expected, rel = raw.split("  ", 1)
        target = PACKAGE_ROOT / rel
        if not target.is_file():
            hash_errors.append({"file": rel, "error": "missing"})
            continue
        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        checked += 1
        if actual != expected:
            hash_errors.append({"file": rel, "expected": expected, "actual": actual})

if hash_errors:
    print(json.dumps({"ok": False, "hashErrors": hash_errors}, ensure_ascii=False, indent=2))
    raise SystemExit(2)

print(
    json.dumps(
        {
            "ok": True,
            "packageRoot": str(PACKAGE_ROOT),
            "requiredFiles": len(required),
            "hashedFilesChecked": checked,
            "r27Implemented": False,
            "productionReady": False,
        },
        ensure_ascii=False,
        indent=2,
    )
)
