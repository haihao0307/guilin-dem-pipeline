#!/usr/bin/env python3
"""Validate the v0.4 control plane, release candidate, rollback, and static runtime files."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PROJECT_ROOT.parents[1]
REPORT_PATH = PROJECT_ROOT / "reports" / "ECOLOGY_V040_RUNTIME_QA.json"
SECRET_PATTERN = re.compile(r"(?:token|secret|password|authorization|private[_-]?key)", re.IGNORECASE)


class RuntimeQAError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeQAError(f"object JSON required: {path}")
    return value


def scan_sensitive(value: Any, path: str = "$") -> list[str]:
    findings: list[str] = []
    if isinstance(value, Mapping):
        for key, child in value.items():
            key_text = str(key)
            if SECRET_PATTERN.search(key_text):
                findings.append(f"sensitive key at {path}.{key_text}")
            findings.extend(scan_sensitive(child, f"{path}.{key_text}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(scan_sensitive(child, f"{path}[{index}]"))
    elif isinstance(value, str):
        if SECRET_PATTERN.search(value) and ("=" in value or len(value) > 80):
            findings.append(f"possible sensitive value at {path}")
    return findings


def check(condition: bool, check_id: str, detail: str, results: list[dict[str, Any]]) -> None:
    results.append({"id": check_id, "passed": bool(condition), "detail": detail})


def run_checks() -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    required_files = [
        REPO_ROOT / "ops" / "control-state.json",
        PROJECT_ROOT / "scripts" / "ecology_v040" / "terrain_field_compiler.py",
        PROJECT_ROOT / "scripts" / "ecology_v040" / "ecology_agriculture_compiler.py",
        PROJECT_ROOT / "scripts" / "ecology_v040" / "build_ops_control_plane.py",
        PROJECT_ROOT / "metadata" / "ecology" / "v0.4.0" / "ecology-knowledge.json",
        PROJECT_ROOT / "metadata" / "ecology" / "v0.4.0" / "agriculture-config.json",
        PROJECT_ROOT / "metadata" / "ecology" / "v0.4.0" / "ecology-release-candidate.json",
        PROJECT_ROOT / "web" / "ops" / "index.html",
        PROJECT_ROOT / "web" / "ops" / "status.json",
        PROJECT_ROOT / "metadata" / "ecology" / "v0.3.1" / "ecology-release-manifest.json",
        PROJECT_ROOT / "web" / "assets" / "ecology" / "v0.3.1" / "trees.bin",
        PROJECT_ROOT / "web" / "assets" / "ecology" / "v0.3.1" / "shrubs.bin",
        PROJECT_ROOT / "web" / "assets" / "ecology" / "v0.3.1" / "rice.bin",
    ]
    for path in required_files:
        check(path.is_file(), f"file:{path.relative_to(REPO_ROOT)}", "required file exists", results)

    if all(path.is_file() for path in required_files[:9]):
        control_state = load_json(required_files[0])
        knowledge = load_json(required_files[4])
        agriculture = load_json(required_files[5])
        candidate = load_json(required_files[6])
        public_status = load_json(required_files[8])
        check(not scan_sensitive(control_state), "control_state_sanitized", "control state contains no sensitive keys or values", results)
        check(not scan_sensitive(public_status), "public_status_sanitized", "public status contains no sensitive keys or values", results)
        check(len(knowledge.get("prototypes", [])) >= 18, "prototype_count", "at least 18 ecology prototypes are declared", results)
        check(len(agriculture.get("crop_palettes", [])) >= 8, "crop_palette_count", "at least eight crop palettes are declared", results)
        check(candidate.get("default_runtime") is False, "candidate_not_default", "v0.4.0 candidate remains disabled", results)
        check(candidate.get("rollback_release") == "v0.3.1", "rollback_release", "v0.3.1 is the declared rollback", results)
        check(public_status.get("stable_release") == "v0.3.1", "public_stable_release", "public status keeps v0.3.1 stable", results)
        check(public_status.get("target_release") == "v0.4.0-rc1", "public_target_release", "public status identifies v0.4.0-rc1 target", results)

    ops_html_path = PROJECT_ROOT / "web" / "ops" / "index.html"
    if ops_html_path.is_file():
        html = ops_html_path.read_text(encoding="utf-8")
        check("fetch(\"./status.json\"" in html, "ops_fetch_status", "ops page fetches sanitized status JSON", results)
        check("../live-terrain.html" in html, "ops_live_link", "ops page links to live terrain validation", results)
        check("浏览器页面不保存" in html, "ops_security_notice", "ops page includes security notice", results)
        check("<script src=" not in html.lower(), "ops_no_external_script", "ops page has no external script dependency", results)

    stable_files = [path for path in required_files[9:] if path.is_file()]
    stable_checksums = {str(path.relative_to(PROJECT_ROOT)): sha256_file(path) for path in stable_files}
    check(len(stable_files) == len(required_files[9:]), "v031_rollback_assets", "all v0.3.1 rollback manifest and instance streams exist", results)

    failed = [item for item in results if not item["passed"]]
    report = {
        "schema": "dem_ecology_runtime_qa@1.0",
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "project": "guilin-zhenbaoding-yangshuo-pingle",
        "stable_release": "v0.3.1",
        "candidate_release": "v0.4.0-rc1",
        "passed": not failed,
        "summary": {"checks": len(results), "passed": len(results) - len(failed), "failed": len(failed)},
        "checks": results,
        "stable_asset_checksums": stable_checksums,
    }
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate only and do not write the report")
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    report = run_checks()
    if not args.check:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"] | {"passed": report["passed"]}, ensure_ascii=False, sort_keys=True))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
