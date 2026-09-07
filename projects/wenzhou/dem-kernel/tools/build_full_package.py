#!/usr/bin/env python3
"""Build a deterministic full restart package for Wenzhou DEM Kernel R1."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[4]
PACKAGE_BASENAME = "WENZHOU_DEM_KERNEL_R1_FULL_PACKAGE_2026-09-07"
PACKAGE_DIR = ROOT / "projects/wenzhou/dem-kernel/packages"
TASK_COMMIT = "3eb58693235505b9bb35dbb340c1cfd3007b8e01"
FIXED_ZIP_TIME = (2026, 9, 7, 0, 0, 0)

CURRENT_PATHS = (
    Path("projects/wenzhou/dem-kernel"),
    Path(".github/workflows/wenzhou-dem-kernel-r1.yml"),
    Path(".github/workflows/wenzhou-dem-kernel-r1-package.yml"),
    Path("projects/wenzhou/v200/web/workbench-v060/V060_TERRAIN_CONTRACT.md"),
    Path("projects/wenzhou/v200/reports/v060/V060_CURRENT_STATE.json"),
    Path("tools/wenzhou/v060/preflight_truth.py"),
    Path("tools/wenzhou/v060/build_truth_pyramid.py"),
    Path("tools/wenzhou/v060/qa_truth_pyramid.py"),
)

TASK_SOURCES = {
    "docs/mother_coordination/world_knowledge_lab_v1/mother_packages/WENZHOU_DEM_CLEAN_SYSTEM_R1.md": "source-knowledge/WENZHOU_DEM_CLEAN_SYSTEM_R1.md",
    "docs/mother_coordination/world_knowledge_lab_v1/reviews/2026-09-07-dem-wave-hierarchy-r1.md": "source-knowledge/2026-09-07-dem-wave-hierarchy-r1.md",
    "docs/mother_coordination/world_knowledge_lab_v1/reviews/2026-09-07-dem-ocean-field-world-r2.md": "source-knowledge/2026-09-07-dem-ocean-field-world-r2.md",
    "docs/mother_coordination/learning-r1-20260905/TERRAIN_CORE.md": "source-knowledge/TERRAIN_CORE.md",
    "docs/mother_coordination/world_knowledge_lab_v1/core/WORLD_KERNEL_CORE_CHARTER_R1.md": "source-knowledge/WORLD_KERNEL_CORE_CHARTER_R1.md",
}


def run_text(*args: str) -> str:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return (
        "packages" in parts
        or "__pycache__" in parts
        or path.suffix in {".pyc", ".pyo"}
    )


def copy_path(source: Path, destination_root: Path) -> None:
    absolute = ROOT / source
    if not absolute.exists():
        raise FileNotFoundError(absolute)

    if absolute.is_file():
        destination = destination_root / source
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(absolute, destination)
        return

    for file_path in sorted(absolute.rglob("*")):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(ROOT)
        if should_skip(relative):
            continue
        destination = destination_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, destination)


def export_fixed_commit_files(destination_root: Path) -> None:
    for source_path, relative_destination in TASK_SOURCES.items():
        data = subprocess.run(
            ["git", "show", f"{TASK_COMMIT}:{source_path}"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
        destination = destination_root / relative_destination
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)


def load_json_if_present(path: Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def iter_payload_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def write_start_here(package_root: Path, source_commit: str, source_branch: str) -> None:
    text = f"""# 小温州 DEM Kernel R1 全量重启包

包名：`{PACKAGE_BASENAME}.zip`

生产实验分支：`{source_branch}`

打包源提交：`{source_commit}`

小妈任务包提交：`{TASK_COMMIT}`

Draft PR：`#64`

## 阅读顺序

1. `source-knowledge/WENZHOU_DEM_CLEAN_SYSTEM_R1.md`
2. `projects/wenzhou/dem-kernel/RESTART_START_HERE.md`
3. `projects/wenzhou/dem-kernel/CONTRACT.json`
4. `projects/wenzhou/dem-kernel/qa/KEEP_ARCHIVE_DROP_R1.json`
5. `projects/wenzhou/dem-kernel/qa/MATH_PROBE_RESULTS_R1.json`
6. `projects/wenzhou/dem-kernel/qa/REAL_WINDOW_STATUS_R1.json`
7. `projects/wenzhou/dem-kernel/qa/REAL_WINDOW_RECOVERY_SEARCH_R1.json`

## 已完成

已经建立温州专属干净实验线、真值身份合同、资产去留总账、整数可逆 CDF 5/3 二维变换、NoData 独立掩膜、哈希容器、局部频带重构、真实窗口来源门禁、单元测试与 GitHub Actions 门禁。

## 当前硬阻塞

固定的完整 17 片 12.5 米 COG 仍未挂载。活动树中没有带原始 Int16 载荷、整数源窗口和载荷 SHA256 的合格 R12 或 R13 窗口。因此真实温州压缩率、全域性能与视觉结论保持未产生。

## 继续工作的入口

先运行：

```bash
python -m unittest discover -s projects/wenzhou/dem-kernel/tests -p 'test_*.py'
python projects/wenzhou/dem-kernel/transform/math_probe.py
python projects/wenzhou/dem-kernel/transform/probe_real_window.py \
  --manifest projects/wenzhou/dem-kernel/truth/REAL_WINDOW_MANIFEST_TEMPLATE.json
```

真实窗口探针必须先通过来源清单、固定 COG 身份、整数窗口、载荷字节和 SHA256 检查。任何生成数据只能用于数学验证。

## 冻结边界

本包不修改 V0.5.9、V0.6.0、温州真值、公开工作台、Weather、Cloud、Ocean、水文或人工接受状态。旧七层精确节点金字塔继续作为冻结对照。
"""
    (package_root / "START_HERE.md").write_text(text, encoding="utf-8")


def build_zip(source_root: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(
        zip_path,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for path in iter_payload_files(source_root):
            relative = Path(PACKAGE_BASENAME) / path.relative_to(source_root)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=FIXED_ZIP_TIME)
            mode = 0o755 if path.suffix == ".py" else 0o644
            info.external_attr = mode << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def main() -> int:
    source_commit = run_text("git", "rev-parse", "HEAD")
    source_branch = os.environ.get("GITHUB_REF_NAME") or run_text(
        "git", "rev-parse", "--abbrev-ref", "HEAD"
    )
    source_commit_time = run_text("git", "show", "-s", "--format=%cI", source_commit)

    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = PACKAGE_DIR / f"{PACKAGE_BASENAME}.zip"
    sidecar_path = PACKAGE_DIR / f"{PACKAGE_BASENAME}.zip.sha256"
    report_path = PACKAGE_DIR / "PACKAGE_BUILD_REPORT.json"

    with tempfile.TemporaryDirectory(prefix="wenzhou-dem-package-") as temporary:
        package_root = Path(temporary) / PACKAGE_BASENAME
        package_root.mkdir(parents=True)

        for current_path in CURRENT_PATHS:
            copy_path(current_path, package_root)
        export_fixed_commit_files(package_root)
        write_start_here(package_root, source_commit, source_branch)

        math_report = load_json_if_present(
            package_root / "projects/wenzhou/dem-kernel/qa/MATH_PROBE_RESULTS_R1.json"
        )
        real_status = load_json_if_present(
            package_root / "projects/wenzhou/dem-kernel/qa/REAL_WINDOW_STATUS_R1.json"
        )

        payload_records = []
        for path in iter_payload_files(package_root):
            relative = path.relative_to(package_root).as_posix()
            if relative in {"PACKAGE_MANIFEST.json", "SHA256SUMS"}:
                continue
            payload_records.append(
                {
                    "path": relative,
                    "bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                }
            )

        manifest = {
            "schema": "wenzhou-dem-kernel-full-package/v1",
            "packageName": f"{PACKAGE_BASENAME}.zip",
            "sourceRepository": "haihao0307/guilin-dem-pipeline",
            "sourceBranch": source_branch,
            "sourceCommit": source_commit,
            "sourceCommitTime": source_commit_time,
            "taskPackageCommit": TASK_COMMIT,
            "draftPullRequest": 64,
            "fileCountExcludingManifestAndSums": len(payload_records),
            "files": payload_records,
            "status": {
                "mathProbePassed": bool(math_report.get("passed", False)),
                "realSourceProbePassed": bool(real_status.get("realSourceProbePassed", False)),
                "productionIntegration": False,
                "visualAcceptance": False,
                "productionReady": False,
            },
        }
        manifest_path = package_root / "PACKAGE_MANIFEST.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        sum_lines = []
        for path in iter_payload_files(package_root):
            if path.name == "SHA256SUMS":
                continue
            sum_lines.append(
                f"{sha256_file(path)}  {path.relative_to(package_root).as_posix()}"
            )
        (package_root / "SHA256SUMS").write_text(
            "\n".join(sum_lines) + "\n", encoding="utf-8"
        )

        build_zip(package_root, zip_path)

    zip_sha256 = sha256_file(zip_path)
    sidecar_path.write_text(f"{zip_sha256}  {zip_path.name}\n", encoding="utf-8")
    report = {
        "schema": "wenzhou-dem-kernel-package-build/v1",
        "package": zip_path.as_posix(),
        "bytes": zip_path.stat().st_size,
        "sha256": zip_sha256,
        "sourceCommit": source_commit,
        "taskPackageCommit": TASK_COMMIT,
        "deterministicZipTimestamp": list(FIXED_ZIP_TIME),
        "artifactReady": True,
    }
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
