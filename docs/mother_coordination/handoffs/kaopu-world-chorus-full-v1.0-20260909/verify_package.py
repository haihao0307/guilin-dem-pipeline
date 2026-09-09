#!/usr/bin/env python3
"""Verify the extracted KAOPU World Chorus full handoff package."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
EXPECTED_FREEZE = "cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330"
EXPECTED_PRIMARY = "65cb81d8f66ac2d2a08151d128bb52bd36f72da4"
EXPECTED_OPENAI_ROUND = "db985c179fafc50fb5bba9a88712f2194a9c9e49"


class VerificationError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise VerificationError(f"invalid JSON: {path}: {exc}") from exc


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def parse_manifest(root: Path) -> dict[str, str]:
    manifest_path = root / "MANIFEST.sha256"
    require(manifest_path.is_file(), "MANIFEST.sha256 is missing")
    entries: dict[str, str] = {}
    for line_no, raw_line in enumerate(manifest_path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line:
            continue
        parts = line.split("  ", 1)
        require(len(parts) == 2, f"malformed manifest line {line_no}")
        digest, relative = parts
        require(bool(SHA256_RE.match(digest)), f"invalid SHA-256 at line {line_no}")
        relative_path = Path(relative)
        require(not relative_path.is_absolute(), f"absolute path in manifest: {relative}")
        require(".." not in relative_path.parts, f"path traversal in manifest: {relative}")
        require(relative not in entries, f"duplicate manifest entry: {relative}")
        entries[relative] = digest
    require(entries, "manifest contains no files")
    return entries


def verify_manifest(root: Path) -> int:
    entries = parse_manifest(root)
    for relative, expected in sorted(entries.items()):
        path = root / relative
        require(path.is_file(), f"manifest file missing: {relative}")
        actual = sha256_file(path)
        require(actual == expected, f"SHA-256 mismatch: {relative}")

    actual_files: set[str] = set()
    for path in root.rglob("*"):
        require(not path.is_symlink(), f"symlink is forbidden in package: {path.relative_to(root)}")
        if path.is_file() and path.name != "MANIFEST.sha256":
            actual_files.add(path.relative_to(root).as_posix())

    listed_files = set(entries)
    missing_from_manifest = actual_files - listed_files
    stale_manifest_entries = listed_files - actual_files
    require(not missing_from_manifest, f"unlisted payload files: {sorted(missing_from_manifest)}")
    require(not stale_manifest_entries, f"stale manifest entries: {sorted(stale_manifest_entries)}")
    return len(entries)


def verify_required_files(root: Path) -> None:
    checklist = load_json(root / "07_PACKAGE_CHECKLIST.json")
    for relative in checklist["requiredHandoffFiles"]:
        require((root / relative).is_file(), f"required handoff file missing: {relative}")
    for relative in checklist["requiredSnapshotFiles"]:
        require((root / relative).is_file(), f"required snapshot file missing: {relative}")


def verify_json_files(root: Path) -> int:
    count = 0
    for path in sorted(root.rglob("*.json")):
        load_json(path)
        count += 1
    require(count > 0, "package contains no JSON files")
    return count


def verify_source_locks(root: Path) -> None:
    locks = load_json(root / "02_SOURCE_LOCKS.json")
    frozen = {item["commit"] for item in locks["frozenPoints"]}
    commits = {item["commit"] for item in locks["stableAndCandidateCommits"]}
    require(EXPECTED_FREEZE in frozen, "frozen R1 commit is not locked")
    require(EXPECTED_PRIMARY in commits, "KAOPU AGO dialogue commit is not locked")
    require(EXPECTED_OPENAI_ROUND in commits, "OpenAI pilot commit is not locked")
    boundaries = locks["boundaries"]
    require(boundaries["anthropicUsed"] is False, "Anthropic boundary changed")
    require(boundaries["claudeCodeUsed"] is False, "Claude Code boundary changed")
    require(boundaries["productionMotherModified"] is False, "production modification boundary changed")
    require(boundaries["frozenR1Modified"] is False, "frozen R1 modification boundary changed")
    require(boundaries["formalKaopuR2Frozen"] is False, "formal R2 was incorrectly marked frozen")
    require(boundaries["productionReady"] is False, "package incorrectly claims production readiness")
    require(boundaries["realWenzhouFixtureCompleted"] is False, "package incorrectly claims real Wenzhou completion")


def verify_semantic_fixture(root: Path) -> None:
    snapshot = root / "repository_snapshot" / "docs" / "mother_coordination" / "world_knowledge_lab_v1"
    fixture = load_json(snapshot / "experiments" / "openai-round-01-20260909" / "FIXTURE_CUIHU_SYNTHETIC_R01.json")
    require(fixture["fixture"]["synthetic"] is True, "Cuihu fixture lost its synthetic declaration")
    require(
        "No record is asserted as real Kunming history" in fixture["fixture"]["purpose"],
        "Cuihu fixture purpose no longer protects real history",
    )

    invariants = load_json(
        snapshot
        / "experiments"
        / "kaopu-world-chorus-ago-dialogue-r1-20260909"
        / "KAOPU_INVARIANTS_R1.json"
    )
    serialized = json.dumps(invariants, ensure_ascii=False)
    require("靠谱" in serialized or "KAOPU" in serialized, "KAOPU invariant registry has no KAOPU identity")


def run_verifier(script: Path, expected_fragment: str) -> str:
    require(script.is_file(), f"bundled verifier missing: {script}")
    completed = subprocess.run(
        [sys.executable, script.name],
        cwd=script.parent,
        text=True,
        capture_output=True,
        check=False,
    )
    output = (completed.stdout + completed.stderr).strip()
    require(completed.returncode == 0, f"bundled verifier failed: {script.name}\n{output}")
    require(expected_fragment in output, f"unexpected verifier output from {script.name}: {output}")
    return output


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
    require(root.is_dir(), f"package root does not exist: {root}")

    file_count = verify_manifest(root)
    verify_required_files(root)
    json_count = verify_json_files(root)
    verify_source_locks(root)
    verify_semantic_fixture(root)

    snapshot = root / "repository_snapshot" / "docs" / "mother_coordination" / "world_knowledge_lab_v1"
    openai_output = run_verifier(
        snapshot / "experiments" / "openai-round-01-20260909" / "verify_round_01.py",
        "RESULT 16/16 checks passed",
    )
    kaopu_output = run_verifier(
        snapshot
        / "experiments"
        / "kaopu-world-chorus-ago-dialogue-r1-20260909"
        / "verify_kaopu_invariants.py",
        "RESULT 20/20 checks passed",
    )

    metadata = load_json(root / "PACKAGE_METADATA.json")
    require(metadata["package"]["name"] == "KAOPU_WORLD_CHORUS_FULL_HANDOFF_V1.0_2026-09-09.zip", "wrong package name")
    require(metadata["status"]["productionReady"] is False, "metadata incorrectly claims production readiness")
    require(metadata["status"]["realWenzhouFixtureCompleted"] is False, "metadata incorrectly claims Wenzhou completion")

    print(f"PASS manifest: {file_count} payload files")
    print(f"PASS JSON parse: {json_count} files")
    print(f"PASS source locks: {EXPECTED_FREEZE}")
    print(f"PASS OpenAI pilot: {openai_output.splitlines()[-1]}")
    print(f"PASS KAOPU invariants: {kaopu_output.splitlines()[-1]}")
    print("RESULT KAOPU full handoff package verified")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except VerificationError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)
