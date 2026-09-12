#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

PACKAGE_STEM = "Ocean_Mother_Current_Full_Handoff_R0197_2026-09-12"
RUNTIME_COMMIT = "b5be782a135d43d54253cbe20e664b53f2c726c6"
VISUAL_SOURCE_COMMIT = "7b6bba5f9affb9cfcfea5dabfafa5e7931bb492d"
METHOD_COMMIT = "f254721b7e3e23cb35b7b660fa9441dc6cef9796"
FIXED_ZIP_TIME = (2026, 9, 12, 0, 0, 0)

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
OCEAN = REPO / "ocean-mother"
BUILD_PARENT = OCEAN / ".handoff_build"
PACKAGE_ROOT = BUILD_PARENT / PACKAGE_STEM
DIST = OCEAN / "distributions"
ZIP_PATH = DIST / f"{PACKAGE_STEM}.zip"
RECEIPT_PATH = DIST / f"{PACKAGE_STEM}.receipt.json"
SHA_PATH = DIST / f"{PACKAGE_STEM}.sha256.txt"
POINTER_PATH = OCEAN / "CURRENT_FULL_HANDOFF.md"

FORBIDDEN_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".glb", ".gltf", ".fbx", ".obj"}
SKIP_EXTS = FORBIDDEN_EXTS | {".zip"}
SKIP_PARTS = {"node_modules", "__pycache__", ".pytest_cache", "playwright-browsers", ".git"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def should_skip(path: Path) -> bool:
    low_parts = {part.lower() for part in path.parts}
    if low_parts & SKIP_PARTS:
        return True
    if path.suffix.lower() in SKIP_EXTS:
        return True
    if path.name in {".DS_Store", "Thumbs.db"}:
        return True
    return False


def copy_file(src: Path, dst: Path) -> None:
    if not src.is_file():
        raise FileNotFoundError(src)
    if should_skip(src):
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(src: Path, dst: Path) -> None:
    if not src.is_dir():
        raise FileNotFoundError(src)
    for path in sorted(src.rglob("*")):
        if path.is_symlink() or not path.is_file() or should_skip(path.relative_to(src)):
            continue
        copy_file(path, dst / path.relative_to(src))


def git_head() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_manifest() -> dict:
    entries = []
    total = 0
    for path in sorted(PACKAGE_ROOT.rglob("*")):
        if not path.is_file() or path.name == "MANIFEST.json":
            continue
        rel = path.relative_to(PACKAGE_ROOT).as_posix()
        size = path.stat().st_size
        entries.append({"path": rel, "sha256": sha256(path), "bytes": size})
        total += size
    return {
        "schema": "ocean-mother-package-manifest-v1",
        "packageName": f"{PACKAGE_STEM}.zip",
        "generatedAt": "2026-09-12",
        "repository": "haihao0307/guilin-dem-pipeline",
        "handoffBuildSourceCommit": git_head(),
        "runtimeCandidateCommit": RUNTIME_COMMIT,
        "frozenVisualSourceCommit": VISUAL_SOURCE_COMMIT,
        "methodSourceCommit": METHOD_COMMIT,
        "fileCount": len(entries),
        "totalBytes": total,
        "entries": entries,
    }


def deterministic_zip() -> None:
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(PACKAGE_ROOT.rglob("*")):
            if not path.is_file():
                continue
            rel = Path(PACKAGE_STEM) / path.relative_to(PACKAGE_ROOT)
            info = zipfile.ZipInfo(rel.as_posix(), FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            mode = 0o755 if path.suffix == ".py" else 0o644
            info.external_attr = mode << 16
            zf.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def main() -> int:
    shutil.rmtree(BUILD_PARENT, ignore_errors=True)
    PACKAGE_ROOT.mkdir(parents=True, exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)

    root_docs = [
        "START_HERE.md",
        "CURRENT_STATE.md",
        "SOURCE_LOCKS.json",
        "HANDOFF.json",
        "METHOD_GUIDANCE_KAOPU_LEARN_R0.1.md",
        "PACKAGE_SCOPE.md",
        "PUBLIC_PREVIEWS.md",
        "PACKAGE_CHECKLIST.json",
        "verify_package.py",
    ]
    for name in root_docs:
        copy_file(HERE / name, PACKAGE_ROOT / name)
    copy_file(HERE / "build_package.py", PACKAGE_ROOT / "tools/build_package.py")

    copy_tree(OCEAN / "restart-v0311", PACKAGE_ROOT / "frozen_visual_source/restart-v0311")

    copy_file(
        OCEAN / "releases/Ocean_Mother_R0197_Mobile_Heightfield_Direct_Open.html",
        PACKAGE_ROOT / "current_mobile_candidate/Ocean_Mother_R0197_Mobile_Heightfield_Direct_Open.html",
    )
    copy_file(
        OCEAN / "r0197-mobile-heightfield/apply_r0197.py",
        PACKAGE_ROOT / "runtime_lineage/r0197/apply_r0197.py",
    )
    copy_file(
        OCEAN / "releases/Ocean_Mother_R0196_Mobile_Lite_Quality_Direct_Open.html",
        PACKAGE_ROOT / "runtime_lineage/r0196/Ocean_Mother_R0196_Mobile_Lite_Quality_Direct_Open.html",
    )
    copy_file(
        OCEAN / "r0196-mobile-lite/apply_r0196.py",
        PACKAGE_ROOT / "runtime_lineage/r0196/apply_r0196.py",
    )
    copy_file(
        OCEAN / "r0196-mobile-lite/fix_compile_r0196.py",
        PACKAGE_ROOT / "runtime_lineage/r0196/fix_compile_r0196.py",
    )

    copy_tree(OCEAN / "learning/ocean-coast-r1", PACKAGE_ROOT / "learning/ocean-coast-r1")
    copy_file(
        REPO / "docs/mother_coordination/world_knowledge_lab_v1/adapters/OCEAN_COAST_ADAPTER_R1.md",
        PACKAGE_ROOT / "method/OCEAN_COAST_ADAPTER_R1.md",
    )

    for workflow in (
        "ocean-r0196-mobile-lite-quality.yml",
        "ocean-r0197-mobile-heightfield.yml",
    ):
        copy_file(REPO / ".github/workflows" / workflow, PACKAGE_ROOT / "ci" / workflow)

    write_json(PACKAGE_ROOT / "PUBLICATION_EVIDENCE.json", {
        "r0197WorkflowRun": 34541616079,
        "workflowConclusion": "success",
        "publishedCommit": RUNTIME_COMMIT,
        "publishedHtmlSha256": "ec8df35770a70a14fc10a596c7866c763630f4022a76b04be84d41a9c3d28b5f",
        "publicHostsVerifiedAtPublication": ["raw.githack.com", "rawcdn.githack.com"],
        "userDeviceObservation": "User confirmed R019.7 can be viewed normally on iPhone Safari; visual remains too rough for commercial use.",
        "visualApproved": False,
        "productionApproved": False,
    })

    write_json(PACKAGE_ROOT / "MANIFEST.json", build_manifest())

    verify = PACKAGE_ROOT / "verify_package.py"
    subprocess.run([sys.executable, str(verify), str(PACKAGE_ROOT)], cwd=REPO, check=True)
    deterministic_zip()
    subprocess.run([sys.executable, str(verify), str(ZIP_PATH)], cwd=REPO, check=True)

    digest = sha256(ZIP_PATH)
    SHA_PATH.write_text(f"{digest}  {ZIP_PATH.name}\n", encoding="utf-8")
    receipt = {
        "schema": "ocean-mother-package-receipt-v1",
        "status": "PASS",
        "package": ZIP_PATH.name,
        "sha256": digest,
        "bytes": ZIP_PATH.stat().st_size,
        "sourceCommit": git_head(),
        "runtimeCandidateCommit": RUNTIME_COMMIT,
        "frozenVisualSourceCommit": VISUAL_SOURCE_COMMIT,
        "methodSourceCommit": METHOD_COMMIT,
        "visualApproved": False,
        "productionApproved": False,
    }
    write_json(RECEIPT_PATH, receipt)

    POINTER_PATH.write_text(
        "# Ocean Mother Current Full Handoff\n\n"
        f"- Package: `ocean-mother/distributions/{ZIP_PATH.name}`\n"
        f"- SHA-256: `{digest}`\n"
        "- Branch: `handoff/ocean-mother-current-full-r0197-20260912`\n"
        "- First read after extraction: `START_HERE.md`\n"
        "- Verify: `python verify_package.py .`\n\n"
        "R019.7 is the current mobile runtime diagnostic candidate, not the visual mother. "
        "Restore the frozen R018.11 visual source first, then transplant runtime fixes with same-camera A/B.\n",
        encoding="utf-8",
    )

    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
