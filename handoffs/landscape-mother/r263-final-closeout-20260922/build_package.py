#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, shutil, tempfile, urllib.request, zipfile

REPO = Path(__file__).resolve().parents[3]
SOURCE_DIR = REPO / "handoffs/landscape-mother/r263-final-closeout-20260922"
PACKAGE_NAME = "LANDSCAPE_MOTHER_R263_FINAL_CLOSEOUT_FULL_HANDOFF_2026-09-22.zip"
ROOT_NAME = PACKAGE_NAME[:-4]
OUT_ZIP = REPO / "handoffs/landscape-mother" / PACKAGE_NAME
OUT_SHA = REPO / "handoffs/landscape-mother" / (PACKAGE_NAME + ".sha256")
POINTER = REPO / "handoffs/landscape-mother/CURRENT_FULL_HANDOFF.md"
SOURCE_COMMIT = "14fa478ff4545c2c58656bf57ba5326c03492a33"
EXPECTED_HTML_SHA = "019b82309afda22c68f570db0b7f6475cf60ec79299c596581e91ab911be0d53"
WORKBENCH = "workbenches/landscape-karst-dem-field-r2-6-3-production/index.html"
DIRECT = f"https://raw.githack.com/haihao0307/guilin-dem-pipeline/{SOURCE_COMMIT}/{WORKBENCH}"
PREVIOUS_PACKAGE_URL = "https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/e870b6b2c78593b6cb2c2c8d57b3f93a3e049158/handoffs/landscape-mother/LANDSCAPE_MOTHER_R263_PRODUCTION_FULL_HANDOFF_2026-09-21.zip"

SOURCE_DIRS = [
    "workbenches/landscape-small-karst-field-r2-5-1-gpu-compat",
    "workbenches/landscape-karst-dem-field-r2-6-cracks",
    "workbenches/landscape-karst-dem-field-r2-6-1-driver-safe",
    "workbenches/landscape-karst-dem-field-r2-6-1b-final",
    "workbenches/landscape-karst-dem-field-r2-6-2-compact",
    "workbenches/landscape-karst-dem-field-r2-6-3-production",
]
WORKFLOWS = [
    ".github/workflows/landscape-palau-karst-r251-gpu-compat.yml",
    ".github/workflows/landscape-palau-karst-r251-gpu-compat-v2.yml",
    ".github/workflows/landscape-karst-dem-field-r26-cracks.yml",
    ".github/workflows/landscape-karst-dem-field-r261-debug.yml",
    ".github/workflows/landscape-karst-dem-field-r261-driver-safe.yml",
    ".github/workflows/landscape-karst-dem-field-r261b-final.yml",
    ".github/workflows/landscape-karst-dem-field-r262-compact.yml",
    ".github/workflows/landscape-karst-dem-field-r263-production.yml",
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def copy_required(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(src)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)

def main() -> None:
    with tempfile.TemporaryDirectory(prefix="landscape-r263-closeout-") as td:
        root = Path(td) / ROOT_NAME
        root.mkdir(parents=True)

        # Final handoff documents and one-click launcher.
        for p in sorted(SOURCE_DIR.iterdir()):
            if p.name == "build_package.py":
                continue
            copy_required(p, root / p.name)
        shutil.copy2(Path(__file__), root / "build_package.py")
        (root / "00_直接打开链接.txt").write_text(DIRECT + "\n", encoding="utf-8")

        # Exact source chain retained from R2.5.1 through R2.6.3.
        for rel in SOURCE_DIRS:
            copy_required(REPO / rel, root / rel)
        for rel in WORKFLOWS:
            copy_required(REPO / rel, root / rel)

        # Preserve the preceding clean R2.6.3 package as recovery evidence.
        archive = root / "archive_and_recovery"
        archive.mkdir()
        previous = archive / "LANDSCAPE_MOTHER_R263_PRODUCTION_FULL_HANDOFF_2026-09-21.zip"
        with urllib.request.urlopen(PREVIOUS_PACKAGE_URL, timeout=90) as response, previous.open("wb") as out:
            shutil.copyfileobj(response, out)

        evidence = root / "evidence"
        evidence.mkdir()
        (evidence / "USER_ACCEPTANCE_2026-09-22.md").write_text(
            "# 用户验收记录｜2026-09-22\n\n"
            "用户确认回退后的固定在线入口现在正常，并要求重新打全量包、推送 GitHub、关闭当前生产线，"
            "后续在其他工作区调用和修改，同时保留 Landscape 模块。\n\n"
            f"固定入口：`{DIRECT}`\n",
            encoding="utf-8",
        )

        (root / "PACKAGE_ORDER.md").write_text(
            "# Landscape Mother R2.6.3 最终封版全量包\n\n"
            f"输出：`{PACKAGE_NAME}`\n\n"
            "包含固定一按入口、最终关闭记录、模块保留合同、R2.5.1—R2.6.3 源链、对应工作流、"
            "原始 R2.6.3 恢复包、manifest 与 SHA-256 清单。M1、M1.1、M1.2 和 R2.6.4 不得进入活动基线。\n",
            encoding="utf-8",
        )

        authoritative = root / WORKBENCH
        if sha256(authoritative) != EXPECTED_HTML_SHA:
            raise RuntimeError("authoritative R2.6.3 HTML hash mismatch")

        # Manifest and checksums.
        def files_without(*names):
            return [p for p in sorted(root.rglob("*")) if p.is_file() and p.name not in names]

        entries = [
            {"path": p.relative_to(root).as_posix(), "bytes": p.stat().st_size, "sha256": sha256(p)}
            for p in files_without("FULL_PACKAGE_MANIFEST.json", "SHA256SUMS.txt", "PACKAGE_SELF_CHECK.txt")
        ]
        manifest = {
            "schema": "LANDSCAPE_MOTHER_R263_FINAL_CLOSEOUT_FULL_HANDOFF_V1",
            "repository": "haihao0307/guilin-dem-pipeline",
            "handoffBranch": "handoff/landscape-mother-r263-final-closeout-20260922",
            "sourceCommit": SOURCE_COMMIT,
            "authoritativeWorkbench": WORKBENCH,
            "authoritativeWorkbenchSha256": EXPECTED_HTML_SHA,
            "directOpenUrl": DIRECT,
            "currentLineClosed": True,
            "landscapeModuleRetained": True,
            "fileCountExcludingGeneratedChecks": len(entries),
            "files": entries,
        }
        (root / "FULL_PACKAGE_MANIFEST.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        required = [
            "00_一按打开_LANDSCAPE_MOTHER_R263.url",
            "START_HERE.md",
            "CURRENT_BASELINE.json",
            "MODULE_RETENTION_CONTRACT.md",
            "PRODUCTION_CLOSEOUT.md",
            WORKBENCH,
            "workbenches/landscape-karst-dem-field-r2-6-3-production/build_r263.py",
            "workbenches/landscape-karst-dem-field-r2-6-3-production/production_contract.json",
            "archive_and_recovery/LANDSCAPE_MOTHER_R263_PRODUCTION_FULL_HANDOFF_2026-09-21.zip",
        ]
        checks = []
        for rel in required:
            checks.append(f"{'PASS' if (root / rel).exists() else 'FAIL'}  {rel}")
        checks.append(f"PASS  authoritative index sha256={sha256(authoritative)}")
        active_dirs = [p.name.lower() for p in root.rglob("*") if p.is_dir()]
        bad = any("r2-6-4-cached" in n or "macro-identity-gate" in n or "safe-mesh" in n for n in active_dirs)
        checks.append("FAIL  rejected active workbench found" if bad else "PASS  rejected workbenches absent")
        (root / "PACKAGE_SELF_CHECK.txt").write_text("\n".join(checks) + "\n", encoding="utf-8")
        if any(line.startswith("FAIL") for line in checks):
            raise RuntimeError("package self-check failed")

        checksum_lines = [
            f"{sha256(p)}  {p.relative_to(root).as_posix()}"
            for p in files_without("SHA256SUMS.txt")
        ]
        (root / "SHA256SUMS.txt").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

        OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
        tmp_zip = OUT_ZIP.with_suffix(".zip.tmp")
        if tmp_zip.exists():
            tmp_zip.unlink()
        with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for p in sorted(root.rglob("*")):
                if p.is_file():
                    zf.write(p, f"{ROOT_NAME}/{p.relative_to(root).as_posix()}")
        tmp_zip.replace(OUT_ZIP)

    package_sha = sha256(OUT_ZIP)
    OUT_SHA.write_text(f"{package_sha}  {PACKAGE_NAME}\n", encoding="utf-8")
    POINTER.write_text(
        "# Landscape Mother｜当前最终全量交接\n\n"
        "- 状态：当前生产线关闭，Landscape 模块保留。\n"
        "- 分支：`handoff/landscape-mother-r263-final-closeout-20260922`\n"
        f"- 源提交：`{SOURCE_COMMIT}`\n"
        f"- 全量包：`handoffs/landscape-mother/{PACKAGE_NAME}`\n"
        f"- 包 SHA-256：`{package_sha}`\n"
        f"- 固定一按入口：{DIRECT}\n"
        "- 后续规则：在其他工作区另开 feature 分支继续，不恢复 R2.6.4、M1、M1.1 或 M1.2。\n",
        encoding="utf-8",
    )
    print(json.dumps({"package": str(OUT_ZIP), "bytes": OUT_ZIP.stat().st_size, "sha256": package_sha}, ensure_ascii=False))

if __name__ == "__main__":
    main()
