from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

BASE_SHA256 = "ad868b29bdf3f116b4cfe5ec6aee584f997118f6bf9e56949e9373a7a8356c7c"
BASE_TAG = "wenzhou-r3.2-full-20260909"
BASE_ASSET = "Wenzhou_R3_2_FULL_RESTART_20260909.zip"
PACKAGE_NAME = "Wenzhou_R3_8_CURRENT_FULL_HANDOFF_20260912"
HANDOFF_DIR = "handoffs/wenzhou-r3-8-current-full-20260912"
VERIFIED_R37_COMMIT = "81354b32acedf158490203f89e4cda5c3449e3a0"
VERIFIED_R37_PREVIEW = (
    "https://raw.githack.com/haihao0307/guilin-dem-pipeline/"
    + VERIFIED_R37_COMMIT
    + "/site/dist/r3-7/index.html"
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_checked(*args: str, cwd: Path | None = None) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def locate_package_root(extract_dir: Path) -> Path:
    if (extract_dir / "START_HERE.md").is_file() and (extract_dir / "MANIFEST.json").is_file():
        return extract_dir
    candidates = [
        p
        for p in extract_dir.iterdir()
        if p.is_dir() and (p / "START_HERE.md").is_file() and (p / "MANIFEST.json").is_file()
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"cannot identify exactly one base package root: {candidates}")
    return candidates[0]


def copy_tree(src: Path, dst: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)


def copy_file(src: Path, dst: Path) -> None:
    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def overlay_current(repo: Path, root: Path) -> list[str]:
    copied: list[str] = []

    for version in range(3, 9):
        for base in ("site/dist", "records", "tools"):
            name = f"r3-{version}" if base != "records" else f"R3_{version}"
            src = repo / base / name
            if src.is_dir():
                dst = root / base / name
                copy_tree(src, dst)
                copied.append(src.relative_to(repo).as_posix())

    for rel in [
        "inputs/knowledge-r2-2",
        HANDOFF_DIR,
    ]:
        src = repo / rel
        if src.is_dir():
            copy_tree(src, root / rel)
            copied.append(rel)

    workflow_dir = repo / ".github/workflows"
    if workflow_dir.is_dir():
        for src in sorted(workflow_dir.glob("wenzhou-r3-*.yml")):
            copy_file(src, root / ".github/workflows" / src.name)
            copied.append(src.relative_to(repo).as_posix())

    for rel in ["AGENTS.md"]:
        src = repo / rel
        if src.is_file():
            copy_file(src, root / rel)
            copied.append(rel)

    return copied


def build_manifest(root: Path, source_commit: str) -> dict:
    files = []
    total = 0
    for p in sorted(root.rglob("*"), key=lambda x: x.as_posix().lower()):
        if not p.is_file():
            continue
        rel = p.relative_to(root).as_posix()
        if rel == "MANIFEST.json":
            continue
        size = p.stat().st_size
        total += size
        files.append({"path": rel, "bytes": size, "sha256": sha256(p)})
    return {
        "schema": "wenzhou-current-full-handoff-manifest/v1",
        "version": "Wenzhou R3.8 current full handoff 2026-09-12",
        "state": "R3.7 verified visual + R3.8 in progress",
        "sourceCommit": source_commit,
        "verifiedVisualCommit": VERIFIED_R37_COMMIT,
        "verifiedPreview": VERIFIED_R37_PREVIEW,
        "baseReleaseTag": BASE_TAG,
        "baseReleaseAsset": BASE_ASSET,
        "baseReleaseSha256": BASE_SHA256,
        "handoffEntry": f"{HANDOFF_DIR}/00_START_HERE.md",
        "fileCount": len(files),
        "totalBytes": total,
        "files": files,
    }


def make_zip(root: Path, output_zip: Path) -> None:
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    output_zip.unlink(missing_ok=True)
    stored_suffixes = {
        ".zip",
        ".whl",
        ".gz",
        ".wzdem2",
        ".i16",
        ".i16le",
        ".u8",
        ".u16le",
        ".bundle",
    }
    with zipfile.ZipFile(output_zip, "w", allowZip64=True) as zf:
        for p in sorted(root.rglob("*"), key=lambda x: x.as_posix().lower()):
            if not p.is_file():
                continue
            method = zipfile.ZIP_STORED if p.suffix.lower() in stored_suffixes else zipfile.ZIP_DEFLATED
            zf.write(
                p,
                arcname=f"{PACKAGE_NAME}/{p.relative_to(root).as_posix()}",
                compress_type=method,
                compresslevel=None if method == zipfile.ZIP_STORED else 6,
            )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-zip", type=Path, required=True)
    ap.add_argument("--repo-root", type=Path, required=True)
    ap.add_argument("--work-dir", type=Path, required=True)
    ap.add_argument("--output-zip", type=Path, required=True)
    ap.add_argument("--source-commit", required=True)
    args = ap.parse_args()

    base_zip = args.base_zip.resolve()
    repo = args.repo_root.resolve()
    work = args.work_dir.resolve()
    output = args.output_zip.resolve()

    actual_base_sha = sha256(base_zip)
    if actual_base_sha != BASE_SHA256:
        raise RuntimeError(f"R3.2 base SHA mismatch: {actual_base_sha}")

    if work.exists():
        shutil.rmtree(work)
    extract_dir = work / "base"
    extract_dir.mkdir(parents=True)
    with zipfile.ZipFile(base_zip) as zf:
        zf.extractall(extract_dir)
    root = locate_package_root(extract_dir)

    # Gate 1: inherited full restart must already be intact.
    run_checked(sys.executable, str(root / "tools" / "verify_package.py"), cwd=root)

    copied = overlay_current(repo, root)

    handoff_start = repo / HANDOFF_DIR / "00_START_HERE.md"
    if not handoff_start.is_file():
        raise FileNotFoundError(handoff_start)
    start_text = handoff_start.read_text(encoding="utf-8")
    (root / "START_HERE.md").write_text(start_text, encoding="utf-8")
    (root / "README.md").write_text(start_text, encoding="utf-8")

    source_lock = {
        "schema": "wenzhou-current-full-handoff-source-lock/v1",
        "packageSourceCommit": args.source_commit,
        "handoffBranch": "handoff/wenzhou-r3-8-current-full-20260912",
        "verifiedVisualCommit": VERIFIED_R37_COMMIT,
        "verifiedPreview": VERIFIED_R37_PREVIEW,
        "baseReleaseTag": BASE_TAG,
        "baseReleaseAsset": BASE_ASSET,
        "baseReleaseSha256": BASE_SHA256,
        "r3_8State": "in-progress; audited WRB browser context present; display integration not yet verified",
        "overlayRoots": copied,
    }
    (root / "HANDOFF_SOURCE_LOCK.json").write_text(
        json.dumps(source_lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    manifest = build_manifest(root, args.source_commit)
    (root / "MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # Gate 2: complete current handoff after overlay and MANIFEST rebuild.
    run_checked(sys.executable, str(root / "tools" / "verify_package.py"), cwd=root)

    make_zip(root, output)
    run_checked(sys.executable, "-m", "zipfile", "-t", str(output))

    digest = sha256(output)
    sha_path = output.with_suffix(output.suffix + ".sha256")
    sha_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    report = {
        "passed": True,
        "packageName": PACKAGE_NAME,
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": digest,
        "manifestFileCount": manifest["fileCount"],
        "manifestTotalBytes": manifest["totalBytes"],
        "sourceCommit": args.source_commit,
        "verifiedVisualCommit": VERIFIED_R37_COMMIT,
        "verifiedPreview": VERIFIED_R37_PREVIEW,
        "r3_8VisualVerified": False,
        "permanentEvidenceEmbedded": False,
        "permanentEvidencePointersIncluded": True,
    }
    report_path = output.with_suffix(output.suffix + ".report.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
