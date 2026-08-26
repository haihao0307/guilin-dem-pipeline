#!/usr/bin/env python3
"""Fail-closed static validator for terrain/hydrology workbench v1.0."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    root = args.root.resolve()
    web = root / "web/terrain-hydrology-workbench-v100"
    required = [
        web / "index.html",
        web / "style.css",
        web / "app.js",
        web / "real-slices.json",
        root / "skills/dem-procedural-landscape/TERRAIN_HYDROLOGY_SCOPE.md",
        root / "skills/dem-procedural-landscape/schemas/reference-intake-v1.schema.json",
        root / "skills/dem-procedural-landscape/schemas/distilled-knowledge-v1.schema.json",
        root / "knowledge/terrain-hydrology/README.md",
        root / "knowledge/terrain-hydrology/shared/inbox/README.md",
        root / "knowledge/terrain-hydrology/shared/distilled/WORKBENCH_OPERATING_RULES_V1.md",
        root / "knowledge/terrain-hydrology/guilin/inbox/README.md",
        root / "knowledge/terrain-hydrology/wenzhou/inbox/README.md",
        root / "knowledge/terrain-hydrology/kunming/inbox/README.md",
        root / "tools/terrain_hydrology/compile_real_slice.py",
        root / "tools/terrain_hydrology/package_local.py",
        root / "tools/terrain_hydrology/local_package/START_WORKBENCH.cmd",
        root / "tools/terrain_hydrology/local_package/start_workbench.py",
        root / "tools/terrain_hydrology/local_package/README_CN.txt",
    ]
    errors: list[str] = []
    for path in required:
        if not path.is_file():
            errors.append(f"missing: {path.relative_to(root)}")

    if errors:
        print(json.dumps({"passed": False, "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    manifest = json.loads((web / "real-slices.json").read_text(encoding="utf-8"))
    ids = [region["id"] for region in manifest.get("regions", [])]
    if ids != ["guilin", "wenzhou", "kunming"]:
        errors.append(f"unexpected region order: {ids}")
    if manifest.get("vegetationOwnedBy") != "dem-ecology-surface":
        errors.append("vegetation ownership is not externalized")
    if manifest.get("scope") != ["terrain", "terrace", "hydrology"]:
        errors.append("production scope is not frozen to terrain/terrace/hydrology")
    if manifest.get("release", {}).get("vegetationRuntimeIncluded") is not False:
        errors.append("vegetation runtime must be false")
    if manifest.get("release", {}).get("syntheticGapFill") is not False:
        errors.append("synthetic gap fill must be false")

    by_id = {region["id"]: region for region in manifest["regions"]}
    guilin = by_id["guilin"]
    if guilin.get("state") != "mounted-real-height":
        errors.append("Guilin real height slice must be mounted")
    if guilin.get("source", {}).get("spacingMeters") != 12.5:
        errors.append("Guilin spacing must be 12.5 m")
    if guilin.get("slice", {}).get("areaKm2") != 100.0:
        errors.append("Guilin target slice must be 100 km2")
    for region_id in ("wenzhou", "kunming"):
        region = by_id[region_id]
        if region.get("viewerMode") != "locked-until-real-slice":
            errors.append(f"{region_id} must remain locked until a real slice exists")
        if region.get("slice", {}).get("exact") is not False:
            errors.append(f"{region_id} exact slice claim must be false")

    html = (web / "index.html").read_text(encoding="utf-8")
    js = (web / "app.js").read_text(encoding="utf-8")
    for token in ("data-note", "data-images", "data-gallery", "exportAll", "focusDialog"):
        if token not in html and token not in js:
            errors.append(f"workbench control missing: {token}")
    if len(re.findall(r'knowledge/terrain-hydrology/', html + (web / "real-slices.json").read_text(encoding="utf-8"))) < 4:
        errors.append("GitHub knowledge paths are incomplete")
    forbidden_runtime_terms = ["data-layer=\"ecology\"", "data-layer=\"vegetation\"", "植被开关", "树木密度"]
    for token in forbidden_runtime_terms:
        if token in html or token in js:
            errors.append(f"vegetation runtime control found: {token}")

    for schema_name in ("reference-intake-v1.schema.json", "distilled-knowledge-v1.schema.json"):
        schema = json.loads((root / "skills/dem-procedural-landscape/schemas" / schema_name).read_text(encoding="utf-8"))
        if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
            errors.append(f"schema draft mismatch: {schema_name}")

    report = {
        "schema": "terrain-hydrology-workbench-validation@1.0.0",
        "passed": not errors,
        "regions": ids,
        "guilinRealSliceMounted": guilin.get("state") == "mounted-real-height",
        "wenzhouRealSliceMounted": by_id["wenzhou"].get("state") == "mounted-real-height",
        "kunmingRealSliceMounted": by_id["kunming"].get("state") == "mounted-real-height",
        "vegetationRuntimeIncluded": manifest["release"]["vegetationRuntimeIncluded"],
        "localPackageContract": True,
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
