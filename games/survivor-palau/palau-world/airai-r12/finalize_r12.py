#!/usr/bin/env python3
"""Finalize Airai R12 QA and progress receipts from actual build outputs."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
RUNTIME = HERE / "runtime"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def browser_summary(item: dict) -> dict:
    initial = item.get("initial", {})
    after = item.get("afterInteraction", {})
    qa = initial.get("qa", {})
    return {
        "name": item.get("name"),
        "viewport": item.get("viewport"),
        "actualWebGL2": bool(qa.get("actualWebGL2")),
        "consoleErrors": sum(1 for x in item.get("console", []) if x.get("type") == "error"),
        "consoleWarnings": sum(1 for x in item.get("console", []) if x.get("type") == "warning"),
        "pageErrors": item.get("pageErrors", []),
        "glErrorAfterInteraction": after.get("glError"),
        "fpsSoftwareRenderer": after.get("fps"),
        "overflow": initial.get("overflow"),
        "interactionMode": after.get("mode"),
        "sampleText": after.get("sampleText"),
        "canvas": initial.get("canvas"),
        "status": initial.get("status"),
    }


def file_record(path: Path) -> dict:
    return {
        "path": path.relative_to(HERE).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    numeric_path = EVIDENCE / "numeric-qa.json"
    browser_path = EVIDENCE / "browser-qa.json"
    manifest_path = RUNTIME / "manifest.json"
    for required in (numeric_path, browser_path, manifest_path):
        if not required.is_file():
            raise SystemExit(f"missing required finalization input: {required}")

    numeric = read_json(numeric_path)
    browser_full = read_json(browser_path)
    manifest = read_json(manifest_path)
    browser = [browser_summary(x) for x in browser_full]

    browser_failures = []
    for b in browser:
        if not b["actualWebGL2"]:
            browser_failures.append(f'{b["name"]}: WebGL2 false')
        if b["consoleErrors"] or b["consoleWarnings"]:
            browser_failures.append(f'{b["name"]}: console errors/warnings')
        if b["pageErrors"]:
            browser_failures.append(f'{b["name"]}: page errors')
        if b["glErrorAfterInteraction"] != 0:
            browser_failures.append(f'{b["name"]}: glError={b["glErrorAfterInteraction"]}')
        if b["overflow"] != {"x": 0, "y": 0}:
            browser_failures.append(f'{b["name"]}: overflow={b["overflow"]}')

    screenshots = [file_record(p) for p in sorted(EVIDENCE.glob("*.png"))]
    qa = {
        "schema": "kaopu.palau.airai-r12-qa/1.1",
        "version": manifest["version"],
        "numeric": numeric,
        "browser": browser,
        "browserStatus": "PASS" if not browser_failures else "FAIL",
        "browserFailures": browser_failures,
        "screenshots": screenshots,
        "performanceBoundary": (
            "FPS values are from a software renderer under Xvfb/SwiftShader and prove only that the shipped WebGL2 path runs. "
            "They are not a production desktop-GPU, mobile-GPU, or integrated-world performance claim."
        ),
        "buildContext": {
            "githubRepository": os.getenv("GITHUB_REPOSITORY"),
            "githubRunId": os.getenv("GITHUB_RUN_ID"),
            "githubSha": os.getenv("GITHUB_SHA"),
            "githubRefName": os.getenv("GITHUB_REF_NAME"),
        },
    }
    (HERE / "R12_QA_RECEIPT.json").write_text(
        json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    excluded = {"R12_PROGRESS_RECEIPT.json"}
    files = []
    for path in sorted(p for p in HERE.rglob("*") if p.is_file()):
        rel = path.relative_to(HERE).as_posix()
        if rel in excluded or rel.startswith("__pycache__/") or "/__pycache__/" in rel:
            continue
        files.append(file_record(path))

    checks = {
        "numeric": numeric.get("status"),
        "deterministicRebuild": "PASS" if numeric.get("deterministicRebuild") else "FAIL",
        "sampler": numeric.get("sampler", {}).get("status"),
        "desktopBrowser": "PASS" if any(x["name"] == "desktop_1440x900" and x["actualWebGL2"] for x in browser) else "FAIL",
        "mobileBrowser": "PASS" if any(x["name"] == "mobile_390x844" and x["actualWebGL2"] for x in browser) else "FAIL",
        "consoleErrors": sum(x["consoleErrors"] for x in browser),
        "consoleWarnings": sum(x["consoleWarnings"] for x in browser),
        "pageErrors": sum(len(x["pageErrors"]) for x in browser),
        "glErrors": sum(1 for x in browser if x["glErrorAfterInteraction"] != 0),
    }
    progress = {
        "schema": "kaopu.palau.airai-r12-progress/1.1",
        "version": manifest["version"],
        "implemented": [
            "deterministic vector-to-grid rebuild",
            "browser-loadable PalauWorld.sample()",
            "real WebGL2 3D diagnostic",
            "numeric deterministic QA",
            "desktop and mobile browser QA",
            "takeover source-gap audit",
            "branch-rebuild workflow with pinned geospatial dependencies",
        ],
        "counts": manifest["counts"],
        "checks": checks,
        "historicalReceiptComparison": manifest["historicalReceiptComparison"],
        "gates": {
            "visualAcceptance": False,
            "productionReady": False,
            "publicShareAllowed": False,
        },
        "blockingConditions": [
            "exact full-Palau first-view authority assets are not restored into the auditable Git baseline",
            "accepted Palau land DEM numeric storage is absent from this runtime",
            "local chart datum to MSL transformation is unresolved",
            "R10 workbench source is absent from Git history",
            "Ocean Mother visual coupling and complete visual acceptance are not yet executed",
            "public HTTPS deployment and PUBLICATION_PROOF shareAllowed=true are absent",
        ],
        "nextBoundedIncrement": (
            "Recover exact full-Palau authority assets and R10 source, then bind accepted land DEM and an explicit vertical datum "
            "before Ocean Mother visual integration."
        ),
        "files": files,
    }
    (HERE / "R12_PROGRESS_RECEIPT.json").write_text(
        json.dumps(progress, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    if numeric.get("status") != "PASS" or browser_failures:
        raise SystemExit(json.dumps({"numeric": numeric.get("status"), "browserFailures": browser_failures}, ensure_ascii=False))
    print(json.dumps({
        "status": "PASS",
        "files": len(files),
        "screenshots": len(screenshots),
        "checks": checks,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
