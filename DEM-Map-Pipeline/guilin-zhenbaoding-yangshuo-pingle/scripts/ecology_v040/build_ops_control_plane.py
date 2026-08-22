#!/usr/bin/env python3
"""Build the sanitized static `/ops/` status payload for the DEM control plane."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PROJECT_ROOT.parents[1]
CONTROL_STATE_PATH = REPO_ROOT / "ops" / "control-state.json"
RC_MANIFEST_PATH = PROJECT_ROOT / "metadata" / "ecology" / "v0.4.0" / "ecology-release-candidate.json"
WEB_OPS_DIR = PROJECT_ROOT / "web" / "ops"
SITE_OPS_DIR = PROJECT_ROOT / "site" / "public" / "terrain" / "ops"
SECRET_PATTERN = re.compile(r"(?:token|secret|password|authorization|private[_-]?key)", re.IGNORECASE)


class ControlPlaneError(ValueError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def assert_sanitized(value: Any, path: str = "$") -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            key_text = str(key)
            if SECRET_PATTERN.search(key_text):
                raise ControlPlaneError(f"sensitive key rejected at {path}.{key_text}")
            assert_sanitized(child, f"{path}.{key_text}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            assert_sanitized(child, f"{path}[{index}]")
    elif isinstance(value, str):
        if SECRET_PATTERN.search(value) and ("=" in value or len(value) > 80):
            raise ControlPlaneError(f"possible sensitive value rejected at {path}")


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ControlPlaneError(f"missing required JSON file: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ControlPlaneError(f"top-level JSON object required: {path}")
    return value


def build_status_document(
    control_state: Mapping[str, Any],
    release_candidate: Mapping[str, Any],
    *,
    generated_at: str | None = None,
) -> dict[str, Any]:
    state = copy.deepcopy(dict(control_state))
    candidate = copy.deepcopy(dict(release_candidate))
    assert_sanitized(state)
    assert_sanitized(candidate)
    generated_at = generated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    workers = []
    for worker in state.get("workers", []):
        if not isinstance(worker, Mapping):
            continue
        workers.append({
            "id": worker.get("id"),
            "title": worker.get("title"),
            "branch": worker.get("branch"),
            "issue": worker.get("issue"),
            "pull_request": worker.get("pull_request"),
            "state": worker.get("state"),
            "tests_passed": int(worker.get("tests_passed", 0) or 0),
            "phase_b_pending": list(worker.get("phase_b_pending", [])),
        })

    completed = list(state.get("completed_gates", []))
    pending = list(state.get("release_gates_pending", []))
    status = {
        "schema": "dem_ops_public_status@1.0",
        "generated_at": generated_at,
        "repository": state.get("repository"),
        "status": state.get("status"),
        "stable_branch": state.get("stable_branch"),
        "integration_branch": state.get("integration_branch"),
        "stable_release": state.get("stable_ecology_release"),
        "target_release": state.get("target_ecology_release"),
        "default_runtime_release": state.get("default_runtime_release"),
        "release_candidate": {
            "release_id": candidate.get("release_id"),
            "status": candidate.get("status"),
            "default_runtime": bool(candidate.get("default_runtime", False)),
            "rollback_release": candidate.get("rollback_release"),
            "release_blockers": list(candidate.get("release_blockers", [])),
        },
        "workers": workers,
        "tests": {
            "focused_passed": sum(int(worker.get("tests_passed", 0) or 0) for worker in workers),
            "completed_gates": completed,
            "pending_release_gates": pending,
        },
        "links": {
            "main_view": "../",
            "live_terrain_view": "../live-terrain.html",
            "github_repository": "https://github.com/haihao0307/guilin-dem-pipeline",
            "terrain_pr": "https://github.com/haihao0307/guilin-dem-pipeline/pull/4",
            "ecology_pr": "https://github.com/haihao0307/guilin-dem-pipeline/pull/5",
            "runtime_pr": "https://github.com/haihao0307/guilin-dem-pipeline/pull/6"
        }
    }
    status["payload_sha256"] = sha256_json(status)
    assert_sanitized(status)
    return status


def write_outputs(status: Mapping[str, Any], *, check: bool = False) -> list[Path]:
    payload = json.dumps(status, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    source_html = WEB_OPS_DIR / "index.html"
    if not source_html.is_file():
        raise ControlPlaneError(f"missing ops page template: {source_html}")
    html_payload = source_html.read_text(encoding="utf-8")
    outputs = [WEB_OPS_DIR / "status.json", SITE_OPS_DIR / "status.json", SITE_OPS_DIR / "index.html"]
    expected = {outputs[0]: payload, outputs[1]: payload, outputs[2]: html_payload}
    for path, content in expected.items():
        if check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                raise ControlPlaneError(f"generated output is stale: {path}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when committed outputs are stale")
    parser.add_argument("--generated-at", help="fixed ISO timestamp for reproducible CI output")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    control_state = load_json(CONTROL_STATE_PATH)
    release_candidate = load_json(RC_MANIFEST_PATH)
    status = build_status_document(control_state, release_candidate, generated_at=args.generated_at)
    outputs = write_outputs(status, check=args.check)
    print(json.dumps({"outputs": [str(path) for path in outputs], "payload_sha256": status["payload_sha256"]}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
