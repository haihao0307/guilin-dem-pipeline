#!/usr/bin/env python3
"""Build and verify the KAOPU World Chorus full handoff ZIP."""

from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Any

PACKAGE_STEM = "KAOPU_WORLD_CHORUS_FULL_HANDOFF_V1.0_2026-09-09"
PACKAGE_FILE = f"{PACKAGE_STEM}.zip"
HANDOFF_BRANCH = "handoff/kaopu-world-chorus-full-v1.0-20260909"
PRIMARY_COMMIT = "65cb81d8f66ac2d2a08151d128bb52bd36f72da4"
OPENAI_ROUND_COMMIT = "db985c179fafc50fb5bba9a88712f2194a9c9e49"
FROZEN_R1_COMMIT = "cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330"
PRIMARY_PATH = "docs/mother_coordination/world_knowledge_lab_v1"
OPENAI_ROUND_PATH = f"{PRIMARY_PATH}/experiments/openai-round-01-20260909"
FIXED_ZIP_TIME = (2026, 9, 9, 0, 0, 0)

HANDOFF_DIR = Path(__file__).resolve().parent
REPO_ROOT = HANDOFF_DIR.parents[3]
BUILD_DIR = HANDOFF_DIR / "_build"
RELEASE_DIR = HANDOFF_DIR / "releases"
STAGE_ROOT = BUILD_DIR / PACKAGE_STEM
SNAPSHOT_ROOT = STAGE_ROOT / "repository_snapshot"


class BuildError(RuntimeError):
    pass


def run(command: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    if check and completed.returncode != 0:
        raise BuildError(
            f"command failed ({completed.returncode}): {' '.join(command)}\n"
            f"stdout:\n{completed.stdout}\n"
            f"stderr:\n{completed.stderr}"
        )
    return completed


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def safe_extract_tar(data: bytes, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as archive:
        for member in archive.getmembers():
            target = (destination / member.name).resolve()
            try:
                target.relative_to(root)
            except ValueError as exc:
                raise BuildError(f"unsafe archive path: {member.name}") from exc
            if member.issym() or member.islnk():
                raise BuildError(f"links are forbidden in source archive: {member.name}")
        archive.extractall(destination)


def export_git_path(commit: str, repo_path: str, destination: Path) -> Path:
    completed = subprocess.run(
        ["git", "archive", "--format=tar", commit, repo_path],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise BuildError(
            f"git archive failed for {commit}:{repo_path}\n{completed.stderr.decode('utf-8', errors='replace')}"
        )
    safe_extract_tar(completed.stdout, destination)
    exported = destination / repo_path
    if not exported.exists():
        raise BuildError(f"git archive did not produce {repo_path}")
    return exported


def copy_handoff_files() -> None:
    excluded = {"_build", "releases", ".DS_Store"}
    for source in sorted(HANDOFF_DIR.iterdir()):
        if source.name in excluded:
            continue
        target = STAGE_ROOT / source.name
        if source.is_symlink():
            raise BuildError(f"symlink is forbidden in handoff source: {source}")
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True)
        elif source.is_file():
            shutil.copy2(source, target)


def prepare_snapshot() -> None:
    with tempfile.TemporaryDirectory(prefix="kaopu-primary-") as temp_primary:
        primary_export = export_git_path(PRIMARY_COMMIT, PRIMARY_PATH, Path(temp_primary))
        destination = SNAPSHOT_ROOT / PRIMARY_PATH
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(primary_export, destination, dirs_exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="kaopu-openai-round-") as temp_extra:
        extra_export = export_git_path(OPENAI_ROUND_COMMIT, OPENAI_ROUND_PATH, Path(temp_extra))
        destination = SNAPSHOT_ROOT / OPENAI_ROUND_PATH
        if destination.exists():
            shutil.rmtree(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(extra_export, destination)


def run_bundled_verifiers() -> str:
    lab = SNAPSHOT_ROOT / PRIMARY_PATH
    scripts = [
        (
            lab / "experiments" / "openai-round-01-20260909" / "verify_round_01.py",
            "RESULT 16/16 checks passed",
        ),
        (
            lab
            / "experiments"
            / "kaopu-world-chorus-ago-dialogue-r1-20260909"
            / "verify_kaopu_invariants.py",
            "RESULT 20/20 checks passed",
        ),
    ]
    sections: list[str] = []
    for script, expected in scripts:
        if not script.is_file():
            raise BuildError(f"missing bundled verifier: {script}")
        completed = run([sys.executable, script.name], cwd=script.parent, check=False)
        output = (completed.stdout + completed.stderr).strip()
        if completed.returncode != 0 or expected not in output:
            raise BuildError(f"bundled verifier failed: {script}\n{output}")
        sections.append(f"## {script.name}\n{output}\n")
    result = "\n".join(sections)
    write_text(STAGE_ROOT / "verification" / "EXPERIMENT_VERIFIERS.txt", result)
    return result


def validate_json_payload() -> int:
    count = 0
    for path in sorted(STAGE_ROOT.rglob("*.json")):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise BuildError(f"invalid JSON in staged package: {path}: {exc}") from exc
        count += 1
    return count


def file_count_without_manifest() -> int:
    return sum(1 for path in STAGE_ROOT.rglob("*") if path.is_file() and path.name != "MANIFEST.sha256")


def build_metadata(build_commit: str, json_count: int) -> None:
    metadata = {
        "schema": "kaopu-world-chorus-full-handoff/1.0",
        "package": {
            "name": PACKAGE_FILE,
            "rootDirectory": PACKAGE_STEM,
            "version": "1.0",
            "date": "2026-09-09",
            "deterministicZipTimestamp": "2026-09-09T00:00:00",
            "payloadFileCountExcludingManifest": 0,
            "jsonFileCount": json_count,
        },
        "repository": {
            "name": "haihao0307/guilin-dem-pipeline",
            "handoffBranch": HANDOFF_BRANCH,
            "packageBuildCommit": build_commit,
        },
        "sources": {
            "frozenR1Commit": FROZEN_R1_COMMIT,
            "primarySnapshotCommit": PRIMARY_COMMIT,
            "openAiPilotCommit": OPENAI_ROUND_COMMIT,
        },
        "verification": {
            "openAiPilot": "16/16 PASS",
            "kaopuInvariants": "20/20 PASS",
            "manifestAlgorithm": "SHA-256",
            "fullZipExtractionRequired": True,
        },
        "status": {
            "officialWorkingName": "靠谱",
            "machineIdentifier": "KAOPU",
            "firstRealRegionScore": "Wenzhou",
            "formalR2Frozen": False,
            "productionReady": False,
            "visualAcceptance": False,
            "realWenzhouFixtureCompleted": False,
            "productionMotherModified": False,
            "anthropicUsed": False,
            "claudeCodeUsed": False,
            "makeUsedForLongTermLearning": False,
        },
        "nextGate": "Complete one real Wenzhou KAOPU region-score fixture with typed wave generation, independent observations, uncertainty, view policy and rollback.",
    }
    path = STAGE_ROOT / "PACKAGE_METADATA.json"
    write_json(path, metadata)
    metadata["package"]["payloadFileCountExcludingManifest"] = file_count_without_manifest()
    write_json(path, metadata)


def generate_manifest() -> int:
    manifest_path = STAGE_ROOT / "MANIFEST.sha256"
    if manifest_path.exists():
        manifest_path.unlink()
    lines: list[str] = []
    for path in sorted(STAGE_ROOT.rglob("*"), key=lambda item: item.relative_to(STAGE_ROOT).as_posix()):
        if path.is_symlink():
            raise BuildError(f"symlink is forbidden in staged package: {path}")
        if path.is_file() and path.name != "MANIFEST.sha256":
            relative = path.relative_to(STAGE_ROOT).as_posix()
            lines.append(f"{sha256_file(path)}  {relative}")
    write_text(manifest_path, "\n".join(lines) + "\n")
    return len(lines)


def run_package_verifier(package_root: Path) -> str:
    script = package_root / "verify_package.py"
    completed = run([sys.executable, script.name], cwd=package_root, check=False)
    output = (completed.stdout + completed.stderr).strip()
    if completed.returncode != 0 or "RESULT KAOPU full handoff package verified" not in output:
        raise BuildError(f"package verifier failed at {package_root}\n{output}")
    return output


def create_deterministic_zip() -> Path:
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RELEASE_DIR / PACKAGE_FILE
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(STAGE_ROOT.rglob("*"), key=lambda item: item.relative_to(STAGE_ROOT).as_posix()):
            if not path.is_file():
                continue
            relative = Path(PACKAGE_STEM) / path.relative_to(STAGE_ROOT)
            info = zipfile.ZipInfo(relative.as_posix(), FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            mode = 0o755 if path.suffix == ".py" else 0o644
            info.external_attr = mode << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return zip_path


def verify_extracted_zip(zip_path: Path) -> str:
    with tempfile.TemporaryDirectory(prefix="kaopu-extract-") as temp_dir:
        temp_root = Path(temp_dir)
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(temp_root)
        extracted = temp_root / PACKAGE_STEM
        if not extracted.is_dir():
            raise BuildError("ZIP does not contain the expected package root")
        return run_package_verifier(extracted)


def write_release_records(
    zip_path: Path,
    build_commit: str,
    manifest_count: int,
    json_count: int,
    stage_verify: str,
    extract_verify: str,
) -> None:
    zip_sha = sha256_file(zip_path)
    zip_bytes = zip_path.stat().st_size
    write_text(RELEASE_DIR / f"{PACKAGE_FILE}.sha256", f"{zip_sha}  {PACKAGE_FILE}\n")

    receipt = {
        "schema": "kaopu-world-chorus-package-receipt/1.0",
        "package": PACKAGE_FILE,
        "sha256": zip_sha,
        "bytes": zip_bytes,
        "payloadFilesExcludingManifest": manifest_count,
        "jsonFiles": json_count,
        "handoffBranch": HANDOFF_BRANCH,
        "packageBuildCommit": build_commit,
        "sources": {
            "frozenR1Commit": FROZEN_R1_COMMIT,
            "primarySnapshotCommit": PRIMARY_COMMIT,
            "openAiPilotCommit": OPENAI_ROUND_COMMIT,
        },
        "verification": {
            "stage": "PASS",
            "fullZipExtraction": "PASS",
            "openAiPilot": "16/16 PASS",
            "kaopuInvariants": "20/20 PASS",
        },
        "status": {
            "formalR2Frozen": False,
            "productionReady": False,
            "realWenzhouFixtureCompleted": False,
        },
    }
    receipt_path = RELEASE_DIR / "PACKAGE_RECEIPT.json"
    write_json(receipt_path, receipt)

    log = (
        f"PACKAGE {PACKAGE_FILE}\n"
        f"SHA256 {zip_sha}\n"
        f"BYTES {zip_bytes}\n"
        f"PAYLOAD_FILES_EXCLUDING_MANIFEST {manifest_count}\n"
        f"JSON_FILES {json_count}\n"
        f"BUILD_COMMIT {build_commit}\n\n"
        f"STAGE VERIFICATION\n{stage_verify}\n\n"
        f"FULL ZIP EXTRACTION VERIFICATION\n{extract_verify}\n"
    )
    log_path = RELEASE_DIR / "BUILD_LOG.txt"
    write_text(log_path, log)

    checksummed = [zip_path, RELEASE_DIR / f"{PACKAGE_FILE}.sha256", receipt_path, log_path]
    lines = [f"{sha256_file(path)}  {path.name}" for path in checksummed]
    write_text(RELEASE_DIR / "SHA256SUMS.txt", "\n".join(lines) + "\n")


def main() -> int:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    for old in RELEASE_DIR.iterdir():
        if old.is_file():
            old.unlink()
        elif old.is_dir():
            shutil.rmtree(old)

    build_commit = run(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT).stdout.strip()
    prepare_snapshot()
    copy_handoff_files()
    run_bundled_verifiers()
    json_count = validate_json_payload()
    build_metadata(build_commit, json_count)

    generate_manifest()
    first_verify = run_package_verifier(STAGE_ROOT)
    write_text(STAGE_ROOT / "verification" / "PACKAGE_VERIFY_PREZIP.txt", first_verify + "\n")
    build_metadata(build_commit, validate_json_payload())
    manifest_count = generate_manifest()
    stage_verify = run_package_verifier(STAGE_ROOT)

    zip_path = create_deterministic_zip()
    extract_verify = verify_extracted_zip(zip_path)
    json_count = validate_json_payload()
    write_release_records(
        zip_path,
        build_commit,
        manifest_count,
        json_count,
        stage_verify,
        extract_verify,
    )

    print(f"PACKAGE={zip_path}")
    print(f"SHA256={sha256_file(zip_path)}")
    print(f"BYTES={zip_path.stat().st_size}")
    print(f"PAYLOAD_FILES={manifest_count}")
    print("RESULT KAOPU package build and full extraction verification passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BuildError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)
