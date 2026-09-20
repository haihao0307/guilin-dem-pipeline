#!/usr/bin/env python3
"""Build the Farmland Object DNA V0.2 full clean restart package.

This script is intentionally stdlib-only so that a fresh GitHub runner can
rebuild the archive without project dependencies. It packages the active
Farmland source, root production rules, validation workflows, and fixed
snapshots of the small-mother coordination documents required to restart.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

PACKAGE_VERSION = "0.2.0"
PACKAGE_ID = "FARMLAND_OBJECT_DNA_FULL_CLEAN_RESTART_V0.2.0_20260907"
PACKAGE_ROOT_NAME = "Farmland_Object_DNA_Full_Clean_Restart_2026-09-07_V0.2.0"
ARCHIVE_NAME = f"{PACKAGE_ROOT_NAME}.zip"
RECEIPT_NAME = f"{PACKAGE_ROOT_NAME}.receipt.json"
SHA_NAME = f"{PACKAGE_ROOT_NAME}.sha256"
LATEST_NAME = "LATEST.json"
ACTIVE_BRANCH = "restart/farmland-object-dna-v020-20260907"
RESTART_BASELINE = "309695a43dadec8b967c9ec543136dfc1e84addd"
COORDINATION_BRANCH = "handoff/xiaoma-mentor-v1.1-20260905"
COORDINATION_REF = f"origin/{COORDINATION_BRANCH}"
FIXED_ZIP_TIME = (2026, 9, 7, 0, 0, 0)

REPO_FILES = (
    "AGENTS.md",
    "contracts/PRODUCTION_CONTRACT.json",
    "knowledge/PUBLIC_WEB_DELIVERY_GATE.md",
    ".github/workflows/smoke-farmland-object-dna-live.yml",
    ".github/workflows/validate-farmland-object-dna-rules.yml",
    ".github/workflows/package-farmland-object-dna-full-clean-restart-v020.yml",
)

COORDINATION_FILES = (
    "docs/mother_coordination/mentor-v1.1/README.md",
    "docs/mother_coordination/mentor-v1.1/MOTHER_STARTUP.md",
    "docs/mother_coordination/learning-r1-20260905/START_HERE.md",
    "docs/mother_coordination/learning-r1-20260905/WORLD_CONSENSUS.md",
    "docs/mother_coordination/learning-r1-20260905/SKILL_INDEX.md",
    "docs/mother_coordination/learning-r1-20260905/SELF_LEARNING_PROTOCOL.md",
)

MANDATORY_FARMLAND_FILES = (
    "FARMLAND_PRODUCTION_RULES.md",
    "HANDOFF.json",
    "INTERFACE_CONTRACT.md",
    "OBJECT_DNA_CONTRACT.md",
    "PRODUCTION_RESTART_TASKS.md",
    "PUBLICATION_PROOF.json",
    "QUALITY_GATES.json",
    "README.md",
    "RESTART_START_HERE.md",
    "V001_FAILURE_REGISTER.md",
    "WORKBENCH_STATUS.md",
    "examples/README.md",
    "examples/traditional-paddy-v001.json",
    "examples/traditional-paddy-v002-research.json",
    "research/OBJECT_SOURCE_CARD_TEMPLATE.md",
    "research/YUANYANG_SYSTEM_RESEARCH_PLAN.md",
    "schema/farmland-object-dna.schema.json",
    "tools/validate_farmland_dna.py",
    "tools/build_full_clean_restart_package_v020.py",
    "workbench-v001/index.html",
)


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def git(*args: str) -> str:
    return run("git", *args).stdout.strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def write_json(path: Path, value: Any) -> None:
    write_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def copy_file(source: Path, target: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"required file missing: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def copy_farmland_tree(repo_root: Path, package_root: Path) -> list[str]:
    source_root = repo_root / "farmland-object-dna"
    target_root = package_root / "source" / "farmland-object-dna"
    copied: list[str] = []
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(source_root)
        if rel.parts and rel.parts[0] == "distributions":
            continue
        if "__pycache__" in rel.parts or path.name in {".DS_Store"}:
            continue
        copy_file(path, target_root / rel)
        copied.append(rel.as_posix())
    missing = sorted(set(MANDATORY_FARMLAND_FILES) - set(copied))
    if missing:
        raise RuntimeError(f"mandatory Farmland files missing from package: {missing}")
    return copied


def copy_repo_context(repo_root: Path, package_root: Path) -> list[str]:
    copied: list[str] = []
    for rel_text in REPO_FILES:
        rel = Path(rel_text)
        copy_file(repo_root / rel, package_root / "source" / "repository-context" / rel)
        copied.append(rel.as_posix())
    return copied


def copy_coordination_snapshots(package_root: Path) -> tuple[str, list[str]]:
    coordination_commit = git("rev-parse", COORDINATION_REF)
    copied: list[str] = []
    for rel_text in COORDINATION_FILES:
        data = run("git", "show", f"{COORDINATION_REF}:{rel_text}").stdout
        target = package_root / "coordination" / rel_text
        write_text(target, data)
        copied.append(rel_text)
    return coordination_commit, copied


def validate_json_files(root: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*.json")):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"invalid JSON {path}: {exc}") from exc
        results.append({"path": path.relative_to(root).as_posix(), "status": "pass"})
    return results


def validate_dna_examples(repo_root: Path) -> dict[str, Any]:
    validator = repo_root / "farmland-object-dna" / "tools" / "validate_farmland_dna.py"
    current = repo_root / "farmland-object-dna" / "examples" / "traditional-paddy-v002-research.json"
    rejected = repo_root / "farmland-object-dna" / "examples" / "traditional-paddy-v001.json"

    current_result = run(sys.executable, str(validator), str(current), check=False)
    if current_result.returncode != 0:
        raise RuntimeError(
            "research example did not pass strict validator:\n"
            f"stdout={current_result.stdout}\nstderr={current_result.stderr}"
        )

    rejected_result = run(sys.executable, str(validator), str(rejected), check=False)
    if rejected_result.returncode == 0:
        raise RuntimeError("rejected V0.1 example unexpectedly passed the strict validator")

    return {
        "researchExample": {
            "path": current.relative_to(repo_root).as_posix(),
            "status": "pass",
            "stdout": current_result.stdout.strip(),
        },
        "rejectedV001Example": {
            "path": rejected.relative_to(repo_root).as_posix(),
            "status": "expected_fail",
            "stdout": rejected_result.stdout.strip(),
        },
    }


def validate_restart_state(repo_root: Path) -> dict[str, Any]:
    farmland = repo_root / "farmland-object-dna"
    handoff = json.loads((farmland / "HANDOFF.json").read_text(encoding="utf-8"))
    proof = json.loads((farmland / "PUBLICATION_PROOF.json").read_text(encoding="utf-8"))
    gates = json.loads((farmland / "QUALITY_GATES.json").read_text(encoding="utf-8"))
    restart_text = (farmland / "RESTART_START_HERE.md").read_text(encoding="utf-8")
    rules_text = (farmland / "FARMLAND_PRODUCTION_RULES.md").read_text(encoding="utf-8")
    failure_text = (farmland / "V001_FAILURE_REGISTER.md").read_text(encoding="utf-8")

    checks = {
        "activeBranch": handoff.get("activeBranch") == ACTIVE_BRANCH,
        "cleanRestart": handoff.get("status", {}).get("cleanRestart") is True,
        "oldPublicShareRevoked": proof.get("shareAllowed") is False,
        "oldVisualAcceptanceFalse": proof.get("visualAcceptance") is False,
        "oldProductionReadyFalse": proof.get("productionReady") is False,
        "restartReadsStrictRules": "FARMLAND_PRODUCTION_RULES.md" in restart_text,
        "restartReadsFailureRegister": "V001_FAILURE_REGISTER.md" in restart_text,
        "rulesContainEvidenceFirst": "证据先行" in rules_text,
        "rulesContainYuanyangSystem": "元阳哈尼梯田专项规则" in rules_text,
        "rulesContainMicroscopeSequence": "Microscope" in rules_text,
        "failureRegisterRejectsV001": "status：rejected" in failure_text or "人工状态：rejected" in failure_text,
        "qualityGateCount": len(gates.get("gates", [])) >= 20,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError(f"restart-state checks failed: {failed}")
    return {"status": "pass", "checks": checks}


def build_start_here(
    source_commit: str,
    source_commit_date: str,
    coordination_commit: str,
) -> str:
    return f"""# Farmland Object DNA 全量干净重启包 V0.2.0

包号：`{PACKAGE_ID}`

构建日期：2026-09-07

来源仓库：`haihao0307/guilin-dem-pipeline`

来源分支：`{ACTIVE_BRANCH}`

来源提交：`{source_commit}`

来源提交时间：`{source_commit_date}`

小妈协调分支：`{COORDINATION_BRANCH}`

小妈协调提交：`{coordination_commit}`

## 这是什么

本包是 Farmland Object DNA 在 V0.1 被用户否决以后形成的完整干净重启快照。它保存严格生产规则、失败登记、对象合同、跨 Mother 接口、元阳整体系统研究、机器 schema、验证器、工作单、旧失败网页负面对照、发布状态和小妈启动规则快照。

本包可以恢复研究与生产组织状态。它不表示新水田结构、3A 视觉候选或最终生产资产已经完成。

## 唯一启动顺序

1. 阅读 `source/repository-context/AGENTS.md`。
2. 阅读 `source/farmland-object-dna/RESTART_START_HERE.md`。
3. 阅读 `source/farmland-object-dna/FARMLAND_PRODUCTION_RULES.md`。
4. 阅读 `source/farmland-object-dna/V001_FAILURE_REGISTER.md`。
5. 阅读 `source/farmland-object-dna/HANDOFF.json`。
6. 阅读 `source/farmland-object-dna/PRODUCTION_RESTART_TASKS.md`。
7. 阅读 `source/farmland-object-dna/OBJECT_DNA_CONTRACT.md`。
8. 阅读 `source/farmland-object-dna/INTERFACE_CONTRACT.md`。
9. 阅读 `source/farmland-object-dna/QUALITY_GATES.json`。
10. 阅读 `source/farmland-object-dna/research/OBJECT_SOURCE_CARD_TEMPLATE.md`。
11. 阅读 `source/farmland-object-dna/research/YUANYANG_SYSTEM_RESEARCH_PLAN.md`。
12. 阅读 `coordination/docs/mother_coordination/mentor-v1.1/MOTHER_STARTUP.md`。
13. 阅读 `coordination/docs/mother_coordination/learning-r1-20260905/WORLD_CONSENSUS.md`。
14. 运行 `source/farmland-object-dna/tools/validate_farmland_dna.py` 检查候选 DNA。
15. 核对 `VALIDATION_REPORT.json`、`PACKAGE_MANIFEST.json` 和 `SHA256SUMS.txt`。

## 冻结边界

`FARMLAND_DNA_WB_V0.1.0_20260907` 只允许作为负面对照。禁止从圆管水渠、圆管田埂、假水深、孤立节点、机械格网、重复条带梯田和圆锥水稻继续开发。

当前没有可分享的新公开视觉候选。`visualAcceptance=false`，`productionReady=false`。

## 重启后的首轮工作

先建立构件来源卡、渠道和田埂截面、元阳森林到河谷的完整系统图、平坝和梯田闭合水路、水深与水量守恒，以及水稻各生育阶段的独立结构。通过以后再做内部结构真值台、3A 材质与 Microscope 微观细节。

## 包内目录

`source/farmland-object-dna/`：Farmland 当前完整源码、规则、研究、schema、验证器与失败对照。

`source/repository-context/`：根生产规则、共享合同和相关工作流。

`coordination/`：小妈启动规则、世界共识和学习制度的固定快照。

`PACKAGE_METADATA.json`：包身份与来源。

`VALIDATION_REPORT.json`：构建时验证结果。

`PACKAGE_MANIFEST.json`：文件清单、字节数和 SHA256。

`SHA256SUMS.txt`：完整载荷校验表。
"""


def iter_payload_files(package_root: Path, exclude: Iterable[str] = ()) -> list[Path]:
    excluded = set(exclude)
    return [
        path
        for path in sorted(package_root.rglob("*"))
        if path.is_file() and path.relative_to(package_root).as_posix() not in excluded
    ]


def manifest_entries(package_root: Path, exclude: Iterable[str] = ()) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in iter_payload_files(package_root, exclude):
        rel = path.relative_to(package_root).as_posix()
        entries.append(
            {
                "path": rel,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    return entries


def write_deterministic_zip(package_root: Path, archive_path: Path) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    if archive_path.exists():
        archive_path.unlink()
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in iter_payload_files(package_root):
            rel = path.relative_to(package_root).as_posix()
            info = zipfile.ZipInfo(f"{PACKAGE_ROOT_NAME}/{rel}", FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def verify_archive(archive_path: Path, expected_root: str, expected_files: int) -> dict[str, Any]:
    with zipfile.ZipFile(archive_path, "r") as archive:
        bad = archive.testzip()
        if bad is not None:
            raise RuntimeError(f"archive CRC failed at {bad}")
        names = [name for name in archive.namelist() if not name.endswith("/")]
        if len(names) != expected_files:
            raise RuntimeError(f"archive file count mismatch: {len(names)} != {expected_files}")
        if any(not name.startswith(f"{expected_root}/") for name in names):
            raise RuntimeError("archive contains a path outside the expected package root")
    return {"crc": "pass", "fileCount": expected_files, "singleRoot": expected_root}


def main() -> int:
    script_path = Path(__file__).resolve()
    repo_root = script_path.parents[2]
    distributions = repo_root / "farmland-object-dna" / "distributions"
    distributions.mkdir(parents=True, exist_ok=True)

    actual_branch = os.environ.get("GITHUB_REF_NAME") or git("branch", "--show-current")
    if actual_branch != ACTIVE_BRANCH:
        raise RuntimeError(f"package must be built from {ACTIVE_BRANCH}; got {actual_branch}")

    source_commit = git("rev-parse", "HEAD")
    source_commit_date = git("show", "-s", "--format=%cI", "HEAD")
    if not git("status", "--porcelain") == "":
        raise RuntimeError("working tree must be clean before package generation")

    with tempfile.TemporaryDirectory(prefix="farmland-v020-") as temp_dir:
        temp = Path(temp_dir)
        package_root = temp / PACKAGE_ROOT_NAME
        package_root.mkdir(parents=True)

        copied_farmland = copy_farmland_tree(repo_root, package_root)
        copied_context = copy_repo_context(repo_root, package_root)
        coordination_commit, copied_coordination = copy_coordination_snapshots(package_root)

        write_text(
            package_root / "00_START_HERE.md",
            build_start_here(source_commit, source_commit_date, coordination_commit),
        )

        metadata = {
            "schema": "farmland-full-clean-restart-package-v1",
            "packageId": PACKAGE_ID,
            "packageVersion": PACKAGE_VERSION,
            "packageRoot": PACKAGE_ROOT_NAME,
            "builtAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "repository": "haihao0307/guilin-dem-pipeline",
            "sourceBranch": actual_branch,
            "sourceCommit": source_commit,
            "sourceCommitDate": source_commit_date,
            "restartBaseline": RESTART_BASELINE,
            "coordinationBranch": COORDINATION_BRANCH,
            "coordinationCommit": coordination_commit,
            "copiedFarmlandFiles": len(copied_farmland),
            "copiedRepositoryContextFiles": len(copied_context),
            "copiedCoordinationFiles": len(copied_coordination),
            "rejectedPredecessor": {
                "id": "FARMLAND_DNA_WB_V0.1.0_20260907",
                "status": "rejected",
                "allowedUse": "negative_reference_only",
            },
            "status": {
                "cleanRestart": True,
                "researchGate": "in_progress",
                "activePublicCandidate": None,
                "visualAcceptance": False,
                "productionReady": False,
            },
        }
        write_json(package_root / "PACKAGE_METADATA.json", metadata)

        validation = {
            "schema": "farmland-full-clean-restart-validation-v1",
            "packageId": PACKAGE_ID,
            "sourceCommit": source_commit,
            "jsonParsing": validate_json_files(package_root / "source"),
            "dnaExamples": validate_dna_examples(repo_root),
            "restartState": validate_restart_state(repo_root),
            "coordinationSnapshots": {
                "status": "pass",
                "branch": COORDINATION_BRANCH,
                "commit": coordination_commit,
                "files": list(copied_coordination),
            },
            "archive": "pending",
            "overall": "pass",
        }
        write_json(package_root / "VALIDATION_REPORT.json", validation)

        initial_entries = manifest_entries(
            package_root,
            exclude={"PACKAGE_MANIFEST.json", "SHA256SUMS.txt"},
        )
        manifest = {
            "schema": "farmland-full-clean-restart-manifest-v1",
            "packageId": PACKAGE_ID,
            "packageVersion": PACKAGE_VERSION,
            "sourceBranch": actual_branch,
            "sourceCommit": source_commit,
            "coordinationCommit": coordination_commit,
            "entries": initial_entries,
            "entryCount": len(initial_entries),
            "payloadBytes": sum(item["bytes"] for item in initial_entries),
            "manifestRule": "entries exclude PACKAGE_MANIFEST.json and SHA256SUMS.txt; SHA256SUMS covers every file except itself",
        }
        write_json(package_root / "PACKAGE_MANIFEST.json", manifest)

        checksum_entries = manifest_entries(package_root, exclude={"SHA256SUMS.txt"})
        checksum_text = "".join(f"{item['sha256']}  {item['path']}\n" for item in checksum_entries)
        write_text(package_root / "SHA256SUMS.txt", checksum_text)

        final_files = iter_payload_files(package_root)
        archive_path = distributions / ARCHIVE_NAME
        write_deterministic_zip(package_root, archive_path)
        archive_check = verify_archive(archive_path, PACKAGE_ROOT_NAME, len(final_files))
        archive_sha = sha256_file(archive_path)
        archive_bytes = archive_path.stat().st_size

        receipt = {
            "schema": "farmland-full-clean-restart-receipt-v1",
            "packageId": PACKAGE_ID,
            "packageVersion": PACKAGE_VERSION,
            "archive": ARCHIVE_NAME,
            "archivePath": f"farmland-object-dna/distributions/{ARCHIVE_NAME}",
            "archiveBytes": archive_bytes,
            "archiveSha256": archive_sha,
            "archiveValidation": archive_check,
            "packageRoot": PACKAGE_ROOT_NAME,
            "payloadFileCount": len(final_files),
            "payloadBytes": sum(path.stat().st_size for path in final_files),
            "sourceBranch": actual_branch,
            "sourceCommit": source_commit,
            "sourceCommitDate": source_commit_date,
            "coordinationBranch": COORDINATION_BRANCH,
            "coordinationCommit": coordination_commit,
            "validation": "pass",
            "v001Rejected": True,
            "visualAcceptance": False,
            "productionReady": False,
        }
        write_json(distributions / RECEIPT_NAME, receipt)
        write_text(distributions / SHA_NAME, f"{archive_sha}  {ARCHIVE_NAME}\n")
        write_json(
            distributions / LATEST_NAME,
            {
                "packageId": PACKAGE_ID,
                "packageVersion": PACKAGE_VERSION,
                "archive": ARCHIVE_NAME,
                "receipt": RECEIPT_NAME,
                "sha256File": SHA_NAME,
                "sourceBranch": actual_branch,
                "sourceCommit": source_commit,
                "validation": "pass",
                "visualAcceptance": False,
                "productionReady": False,
            },
        )

        print(json.dumps(receipt, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"PACKAGE_BUILD_FAILED: {exc}", file=sys.stderr)
        raise
