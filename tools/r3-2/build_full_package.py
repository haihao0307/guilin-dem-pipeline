from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

BASE_SHA256 = "89474650d4cc968465b8d2b9919512bbaa5f90c6f826566c2f948dd1e2df0ab0"
BASE_TAG = "wenzhou-r3.1-full-20260909"
BASE_ASSET = "Wenzhou_R3_1_FULL_RESTART_20260909.zip"
PACKAGE_NAME = "Wenzhou_R3_2_FULL_RESTART_20260909"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_checked(*args: str, cwd: Path | None = None) -> None:
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def locate_package_root(extract_dir: Path) -> Path:
    if (extract_dir / "START_HERE.md").is_file() and (extract_dir / "MANIFEST.json").is_file():
        return extract_dir
    candidates = [
        p for p in extract_dir.iterdir()
        if p.is_dir() and (p / "START_HERE.md").is_file() and (p / "MANIFEST.json").is_file()
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"cannot identify exactly one base package root: {candidates}")
    return candidates[0]


def copy_tree(src: Path, dst: Path) -> None:
    if not src.is_dir():
        raise FileNotFoundError(src)
    shutil.copytree(src, dst, dirs_exist_ok=True)


def build_manifest(root: Path, preview: str, source_commit: str) -> dict:
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
        "version": "Wenzhou R3.2 full restart 2026-09-09",
        "preview": preview,
        "sourceCommit": source_commit,
        "baseReleaseTag": BASE_TAG,
        "baseReleaseAsset": BASE_ASSET,
        "baseReleaseSha256": BASE_SHA256,
        "fileCount": len(files),
        "totalBytes": total,
        "files": files,
    }


def make_zip(root: Path, output_zip: Path) -> None:
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    if output_zip.exists():
        output_zip.unlink()
    with zipfile.ZipFile(output_zip, "w", allowZip64=True) as zf:
        stored_suffixes = {".zip", ".whl", ".gz", ".wzdem2", ".i16", ".u8", ".bundle"}
        for p in sorted(root.rglob("*"), key=lambda x: x.as_posix().lower()):
            if p.is_file():
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
    ap.add_argument("--preview", required=True)
    args = ap.parse_args()

    base_zip = args.base_zip.resolve()
    repo = args.repo_root.resolve()
    work = args.work_dir.resolve()
    output = args.output_zip.resolve()

    actual = sha256(base_zip)
    print(json.dumps({"baseZip": str(base_zip), "sha256": actual}, indent=2))
    if actual != BASE_SHA256:
        raise RuntimeError(f"base release SHA-256 mismatch: {actual}")

    if work.exists():
        shutil.rmtree(work)
    extract_dir = work / "base"
    extract_dir.mkdir(parents=True)
    with zipfile.ZipFile(base_zip) as zf:
        zf.extractall(extract_dir)
    root = locate_package_root(extract_dir)

    # Verify the inherited R3.1 full package before applying any R3.2 overlay.
    run_checked(sys.executable, str(root / "tools" / "verify_package.py"), cwd=root)

    copy_tree(repo / "site" / "dist" / "r3-2", root / "site" / "dist" / "r3-2")
    copy_tree(repo / "records" / "R3_2", root / "records" / "R3_2")
    copy_tree(repo / "tools" / "r3-2", root / "tools" / "r3-2")

    package_start = repo / "records" / "R3_2" / "PACKAGE_START_HERE.md"
    if not package_start.is_file():
        raise FileNotFoundError(package_start)
    text = package_start.read_text(encoding="utf-8")
    text = text.replace("__R32_SOURCE_COMMIT__", args.source_commit).replace("__R32_PREVIEW__", args.preview)
    (root / "START_HERE.md").write_text(text, encoding="utf-8")
    (root / "README.md").write_text(text, encoding="utf-8")

    (root / "records" / "R3_2" / "SOURCE_LOCK.json").write_text(
        json.dumps(
            {
                "version": "R3.2",
                "sourceCommit": args.source_commit,
                "preview": args.preview,
                "baseReleaseTag": BASE_TAG,
                "baseReleaseAsset": BASE_ASSET,
                "baseReleaseSha256": BASE_SHA256,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = build_manifest(root, args.preview, args.source_commit)
    (root / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Verify the complete R3.2 package after the overlay and manifest rebuild.
    run_checked(sys.executable, str(root / "tools" / "verify_package.py"), cwd=root)

    make_zip(root, output)
    digest = sha256(output)
    sha_path = output.with_suffix(output.suffix + ".sha256")
    sha_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    report = {
        "passed": True,
        "output": str(output),
        "bytes": output.stat().st_size,
        "sha256": digest,
        "manifestFileCount": manifest["fileCount"],
        "manifestTotalBytes": manifest["totalBytes"],
        "sourceCommit": args.source_commit,
        "preview": args.preview,
    }
    report_path = output.with_suffix(output.suffix + ".report.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
