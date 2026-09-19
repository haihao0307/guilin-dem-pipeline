#!/usr/bin/env python3
"""Build the deterministic Farmland R025 Xiaoma/TLO/DEM bridge package.

The package is built only from a named Git source commit. Working-tree bytes
are never copied, which lets CI reproduce the exact archive after the archive
itself is committed in a later commit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Iterable


TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from verify_bridge_package_r025 import (  # noqa: E402
    ARCHIVE_NAME,
    BRIDGE_ID,
    BRIDGE_REL,
    DIST_REL,
    EXPECTED_GATES,
    GENERATED_RECORDS,
    LATEST_NAME,
    MANIFEST_SCHEMA,
    PACKAGE_ROOT_NAME,
    PACKAGE_SCHEMA,
    RECEIPT_NAME,
    RECEIPT_SCHEMA,
    REPOSITORY_CONTEXT,
    R025_BASELINE,
    SHA_NAME,
    TOP_LEVEL_SOURCE_COPIES,
    VALIDATION_SCHEMA,
    selected_source_paths,
    validate_bridge_contract,
    validate_package_scope,
    verify_bridge_package,
)


ACTIVE_BRANCH = "restart/farmland-object-dna-v020-20260907"
PACKAGE_BUILT_AT = "2026-09-11T00:00:00Z"
FIXED_ZIP_TIME = (2026, 9, 11, 0, 0, 0)
MANIFEST_RULE = (
    "entries exclude PACKAGE_MANIFEST.json and SHA256SUMS.txt; "
    "SHA256SUMS covers every file except itself"
)
MANDATORY_SOURCE_FILES = {
    "AGENTS.md",
    "contracts/PRODUCTION_CONTRACT.json",
    "knowledge/PUBLIC_WEB_DELIVERY_GATE.md",
    ".github/workflows/validate-farmland-object-dna-rules.yml",
    "farmland-object-dna/RESTART_START_HERE.md",
    "farmland-object-dna/FARMLAND_PRODUCTION_RULES.md",
    "farmland-object-dna/V001_FAILURE_REGISTER.md",
    "farmland-object-dna/HANDOFF.json",
    "farmland-object-dna/QUALITY_GATES.json",
    "farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/README.md",
    "farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/XIAOMA_TLO_DEM_INTAKE.json",
    "farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/FARMLAND_TLO_CHECKPOINT.json",
    "farmland-object-dna/tools/cross_mother_intake.py",
    "farmland-object-dna/tools/probe_cross_mother_intake_r025.py",
    "farmland-object-dna/tools/test_cross_mother_intake_r025.py",
    "farmland-object-dna/tools/build_bridge_package_r025.py",
    "farmland-object-dna/tools/verify_bridge_package_r025.py",
    "farmland-object-dna/tools/test_bridge_package_r025.py",
}


def _run(
    command: list[str],
    cwd: Path,
    *,
    check: bool = True,
    text: bool = True,
) -> subprocess.CompletedProcess[Any]:
    result = subprocess.run(
        command,
        cwd=cwd,
        text=text,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    if check and result.returncode != 0:
        stdout = result.stdout if text else result.stdout.decode("utf-8", "replace")
        stderr = result.stderr if text else result.stderr.decode("utf-8", "replace")
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout={stdout}\nstderr={stderr}"
        )
    return result


def _git_text(repo_root: Path, *args: str) -> str:
    return _run(["git", *args], repo_root).stdout.strip()


def _git_bytes(repo_root: Path, source_commit: str, path: str) -> bytes:
    return _run(
        ["git", "show", f"{source_commit}:{path}"], repo_root, text=False
    ).stdout


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def _write_text(path: Path, value: str) -> None:
    _write_bytes(path, value.encode("utf-8"))


def _write_json(path: Path, value: Any) -> None:
    _write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def _iter_files(root: Path, exclude: Iterable[str] = ()) -> list[Path]:
    excluded = set(exclude)
    return [
        path
        for path in sorted(root.rglob("*"))
        if path.is_file()
        and "__pycache__" not in path.relative_to(root).parts
        and path.suffix != ".pyc"
        and path.name != ".DS_Store"
        and path.relative_to(root).as_posix() not in excluded
    ]


def _manifest_entries(root: Path, exclude: Iterable[str] = ()) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in _iter_files(root, exclude):
        data = path.read_bytes()
        entries.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": len(data),
                "sha256": _sha256_bytes(data),
            }
        )
    return entries


def _write_deterministic_zip(package_root: Path, archive_path: Path) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        archive_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for path in _iter_files(package_root):
            rel = path.relative_to(package_root).as_posix()
            info = zipfile.ZipInfo(f"{PACKAGE_ROOT_NAME}/{rel}", FIXED_ZIP_TIME)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(
                info,
                path.read_bytes(),
                compress_type=zipfile.ZIP_DEFLATED,
                compresslevel=9,
            )


def _parse_test_count(stdout: str, stderr: str) -> int:
    match = re.search(r"Ran (\d+) tests?", f"{stdout}\n{stderr}")
    if not match:
        raise RuntimeError("could not read unittest count")
    return int(match.group(1))


def _copy_git_snapshot(
    repo_root: Path,
    source_commit: str,
    package_root: Path,
) -> list[str]:
    tracked = _git_text(repo_root, "ls-tree", "-r", "--name-only", source_commit).splitlines()
    selected = selected_source_paths(tracked)
    missing = sorted(MANDATORY_SOURCE_FILES - set(selected))
    if missing:
        raise RuntimeError(f"mandatory bridge source files missing: {missing}")
    for path in selected:
        _write_bytes(
            package_root / "source/repository" / path,
            _git_bytes(repo_root, source_commit, path),
        )
    for name in sorted(TOP_LEVEL_SOURCE_COPIES):
        source = package_root / "source/repository" / BRIDGE_REL / name
        if not source.is_file():
            raise RuntimeError(f"bridge source document missing: {name}")
        _write_bytes(package_root / name, source.read_bytes())
    return selected


def _validate_source_snapshot(package_root: Path) -> dict[str, Any]:
    source = package_root / "source/repository"
    farmland = source / "farmland-object-dna"
    bridge = source / BRIDGE_REL

    contract = json.loads((bridge / "BRIDGE_CONTRACT.json").read_text(encoding="utf-8"))
    scope = json.loads((bridge / "PACKAGE_SCOPE.json").read_text(encoding="utf-8"))
    contract_result = validate_bridge_contract(contract)
    scope_result = validate_package_scope(scope)

    json_count = 0
    for path in sorted(source.rglob("*.json")):
        json.loads(path.read_text(encoding="utf-8"))
        json_count += 1

    prohibited: list[str] = []
    for path in _iter_files(source):
        rel = path.relative_to(source).as_posix()
        lower = rel.lower()
        if lower.endswith((".tif", ".tiff", ".zip")):
            prohibited.append(rel)
        if lower.endswith(".bin") and "native-" in lower:
            prohibited.append(rel)
    if prohibited:
        raise RuntimeError(f"prohibited payloads entered source snapshot: {prohibited}")

    intake = farmland / "research/r025-xiaoma-tlo-dem-intake/XIAOMA_TLO_DEM_INTAKE.json"
    checkpoint = farmland / "research/r025-xiaoma-tlo-dem-intake/FARMLAND_TLO_CHECKPOINT.json"
    r025 = _run(
        [sys.executable, str(farmland / "tools/cross_mother_intake.py"), str(intake), str(checkpoint)],
        source,
    )
    r025_result = json.loads(r025.stdout)
    if (
        r025_result.get("intake", {}).get("ok") is not True
        or r025_result.get("checkpoint", {}).get("ok") is not True
    ):
        raise RuntimeError("R025 fixed-source validator did not pass in the package snapshot")

    tests = _run(
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(farmland / "tools"),
            "-p",
            "test_*.py",
            "-v",
        ],
        source,
    )
    test_count = _parse_test_count(tests.stdout, tests.stderr)
    if test_count < R025_BASELINE["test_count"]:
        raise RuntimeError(
            f"unit test count regressed below R025 baseline: {test_count}"
        )

    return {
        "bridgeContract": {"status": "pass", **contract_result},
        "packageScope": {"status": "pass", **scope_result},
        "sourceJson": {"status": "pass", "count": json_count},
        "payloadBoundary": {"status": "pass", "prohibitedFileCount": 0},
        "r025FixedSourceIntake": {
            "status": "pass",
            "lockedSourceFileCount": 14,
            "numericTerrainConnected": False,
        },
        "unitTests": {"status": "pass", "count": test_count},
    }


def build_package(repo_root: Path, source_ref: str, output_dir: Path) -> dict[str, Any]:
    source_commit = _git_text(repo_root, "rev-parse", f"{source_ref}^{{commit}}")
    if not re.fullmatch(r"[0-9a-f]{40}", source_commit):
        raise RuntimeError("source ref did not resolve to a full commit SHA")
    source_tree = _git_text(repo_root, "rev-parse", f"{source_commit}^{{tree}}")
    source_commit_date = _git_text(repo_root, "show", "-s", "--format=%cI", source_commit)
    baseline_exists = subprocess.run(
        ["git", "cat-file", "-e", f"{R025_BASELINE['commit']}^{{commit}}"],
        cwd=repo_root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if baseline_exists.returncode == 0:
        ancestry = subprocess.run(
            ["git", "merge-base", "--is-ancestor", R025_BASELINE["commit"], source_commit],
            cwd=repo_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if ancestry.returncode != 0:
            raise RuntimeError("package source commit does not descend from the published R025 baseline")

    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / ARCHIVE_NAME
    receipt_path = output_dir / RECEIPT_NAME
    sha_path = output_dir / SHA_NAME
    latest_path = output_dir / LATEST_NAME

    with tempfile.TemporaryDirectory(prefix="farmland-r025-bridge-build-") as temp_dir:
        package_root = Path(temp_dir) / PACKAGE_ROOT_NAME
        package_root.mkdir(parents=True)
        source_paths = _copy_git_snapshot(repo_root, source_commit, package_root)
        checks = _validate_source_snapshot(package_root)
        test_count = checks["unitTests"]["count"]
        farmland_count = sum(path.startswith("farmland-object-dna/") for path in source_paths)

        metadata = {
            "schema": PACKAGE_SCHEMA,
            "bridgeId": BRIDGE_ID,
            "packageRoot": PACKAGE_ROOT_NAME,
            "archive": ARCHIVE_NAME,
            "builtAt": PACKAGE_BUILT_AT,
            "repository": R025_BASELINE["repository"],
            "sourceBranch": ACTIVE_BRANCH,
            "sourceCommit": source_commit,
            "sourceTree": source_tree,
            "sourceCommitDate": source_commit_date,
            "r025BaselineCommit": R025_BASELINE["commit"],
            "r025BaselineTree": R025_BASELINE["tree"],
            "pullRequest": R025_BASELINE["pull_request"],
            "sourceSnapshotFileCount": len(source_paths),
            "copiedFarmlandFileCount": farmland_count,
            "copiedRepositoryContextFileCount": len(REPOSITORY_CONTEXT),
            "unitTestCount": test_count,
            "reproducibility": {
                "source": "git object bytes only",
                "zipTimestamp": "2026-09-11T00:00:00Z",
                "compression": "deflate level 9",
                "fileMode": "100644",
            },
            "gates": EXPECTED_GATES,
        }
        _write_json(package_root / "PACKAGE_METADATA.json", metadata)

        validation = {
            "schema": VALIDATION_SCHEMA,
            "bridgeId": BRIDGE_ID,
            "sourceCommit": source_commit,
            "sourceTree": source_tree,
            "checks": checks,
            "archive": "created after this non-recursive report and verified by external receipt",
            "overall": "pass",
            "gates": EXPECTED_GATES,
        }
        _write_json(package_root / "VALIDATION_REPORT.json", validation)

        initial_entries = _manifest_entries(
            package_root, {"PACKAGE_MANIFEST.json", "SHA256SUMS.txt"}
        )
        manifest = {
            "schema": MANIFEST_SCHEMA,
            "bridgeId": BRIDGE_ID,
            "sourceCommit": source_commit,
            "sourceTree": source_tree,
            "entries": initial_entries,
            "entryCount": len(initial_entries),
            "payloadBytes": sum(item["bytes"] for item in initial_entries),
            "manifestRule": MANIFEST_RULE,
        }
        _write_json(package_root / "PACKAGE_MANIFEST.json", manifest)

        checksum_entries = _manifest_entries(package_root, {"SHA256SUMS.txt"})
        _write_text(
            package_root / "SHA256SUMS.txt",
            "".join(f"{item['sha256']}  {item['path']}\n" for item in checksum_entries),
        )

        _write_deterministic_zip(package_root, archive_path)
        archive_digest = _sha256_file(archive_path)
        payload_files = _iter_files(package_root)
        receipt = {
            "schema": RECEIPT_SCHEMA,
            "bridgeId": BRIDGE_ID,
            "archive": ARCHIVE_NAME,
            "archivePath": f"{DIST_REL.as_posix()}/{ARCHIVE_NAME}",
            "archiveBytes": archive_path.stat().st_size,
            "archiveSha256": archive_digest,
            "packageRoot": PACKAGE_ROOT_NAME,
            "payloadFileCount": len(payload_files),
            "payloadBytes": sum(path.stat().st_size for path in payload_files),
            "sourceBranch": ACTIVE_BRANCH,
            "sourceCommit": source_commit,
            "sourceTree": source_tree,
            "sourceCommitDate": source_commit_date,
            "r025BaselineCommit": R025_BASELINE["commit"],
            "unitTestCount": test_count,
            "validation": "pass",
            "visualAcceptance": False,
            "productionReady": False,
        }
        _write_json(receipt_path, receipt)
        _write_text(sha_path, f"{archive_digest}  {ARCHIVE_NAME}\n")
        _write_json(
            latest_path,
            {
                "schema": "farmland-xiaoma-tlo-dem-bridge-latest/v1",
                "bridgeId": BRIDGE_ID,
                "archive": ARCHIVE_NAME,
                "receipt": RECEIPT_NAME,
                "sha256File": SHA_NAME,
                "sourceBranch": ACTIVE_BRANCH,
                "sourceCommit": source_commit,
                "sourceTree": source_tree,
                "validation": "pass",
                "visualAcceptance": False,
                "productionReady": False,
            },
        )

    verification = verify_bridge_package(
        repo_root,
        archive_path,
        receipt_path,
        sha_path,
        run_runtime_tests=True,
    )
    return {
        "ok": True,
        "receipt": receipt,
        "verification": {
            "ok": verification["ok"],
            "archiveSha256": verification["archiveSha256"],
            "payloadFileCount": verification["payloadFileCount"],
            "unitTestCount": verification["runtime"]["unitTestCount"],
        },
    }


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-ref",
        required=True,
        help="fixed Git commit/ref whose tracked bytes become the package source",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repo_root / DIST_REL,
        help="directory for the ZIP, receipt, checksum, and LATEST record",
    )
    args = parser.parse_args()
    result = build_package(repo_root, args.source_ref, args.output_dir.resolve())
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"BRIDGE_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
