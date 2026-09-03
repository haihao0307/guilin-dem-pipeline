from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import sys
import zipfile
from pathlib import Path

PACKAGE_NAME = "Weather_Mother_Full_Clean_Handoff_2026-09-03_V1.2.0"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: finalizer.py PATH_TO_GH_PAGES_WORKTREE")
    repo = Path(sys.argv[1]).resolve()
    wm = repo / "weather-mother"
    archive_path = wm / "handoffs" / f"{PACKAGE_NAME}.zip"
    receipt_path = wm / "handoffs" / f"{PACKAGE_NAME}.receipt.json"
    if not archive_path.exists():
        raise SystemExit(f"package missing: {archive_path}")

    current_readme = """# Weather Mother

公开工作平台只有 `weather-mother/index.html`。

根入口默认进入 World。Rain、Snow、Fog、Cloud、Storm 都在统一壳层内切换。

当前 World 运行目录为 `v110-full`。当前 Rain 运行目录为 `liquid-rain-v100`，视觉基线是用户确认可以继续发展的 1940 年代三维村院。旧平面村落、旧 Rain 实验、旧壳层和旧分发包已经退出公开目录，历史只保留在 Git 提交记录中。

继续工作先读 `RESTART_START_HERE.md`、`HANDOFF.json`、`CLEANUP_RECEIPT.json`、`UNIFIED_STUDIO_POLICY.json`，再读 `liquid-rain-v100/LIQUID_CORE_V1.md`。

当前 Rain 与 Liquid 范围包括雨滴、受湿、积水、涟漪、水花、檐口转移、表面液体表现、程序化声音，以及后续人物汗液和外来沾水接口。

人工视觉批准、3A 批准和生产批准继续保持 `false`。
"""
    (wm / "README.md").write_text(current_readme, encoding="utf-8")

    temp_parent = repo / ".weather-mother-package-finalize"
    if temp_parent.exists():
        shutil.rmtree(temp_parent)
    temp_parent.mkdir(parents=True)
    with zipfile.ZipFile(archive_path) as archive:
        if archive.testzip() is not None:
            raise SystemExit("input package failed integrity test")
        archive.extractall(temp_parent)

    package_root = temp_parent / PACKAGE_NAME
    if not package_root.is_dir():
        raise SystemExit("package root missing after extraction")

    internal_wm = package_root / "web" / "weather-mother"
    internal_wm.mkdir(parents=True, exist_ok=True)
    (internal_wm / "README.md").write_text(current_readme, encoding="utf-8")
    for source_name, target_name in [
        ("START_HERE.md", "RESTART_START_HERE.md"),
        ("HANDOFF.json", "HANDOFF.json"),
        ("CLEANUP_RECEIPT.json", "CLEANUP_RECEIPT.json"),
    ]:
        source = package_root / source_name
        if source.exists():
            shutil.copy2(source, internal_wm / target_name)

    for generated in [package_root / "MANIFEST.json", package_root / "CHECKSUMS.sha256"]:
        if generated.exists():
            generated.unlink()

    files = []
    for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
        files.append({
            "path": path.relative_to(package_root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    write_json(
        package_root / "MANIFEST.json",
        {
            "package": PACKAGE_NAME,
            "version": "1.2.0",
            "documentationSynchronized": True,
            "fileCountBeforeManifest": len(files),
            "totalBytesBeforeManifest": sum(item["bytes"] for item in files),
            "files": files,
        },
    )

    checksum_lines = []
    for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
        checksum_lines.append(f"{sha256(path)}  {path.relative_to(package_root).as_posix()}")
    (package_root / "CHECKSUMS.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    fixed = (2026, 9, 3, 0, 0, 0)
    replacement = archive_path.with_suffix(".zip.new")
    with zipfile.ZipFile(replacement, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
            arcname = f"{PACKAGE_NAME}/{path.relative_to(package_root).as_posix()}"
            info = zipfile.ZipInfo(arcname, fixed)
            mode = 0o755 if os.access(path, os.X_OK) else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(replacement) as archive:
        if archive.testzip() is not None:
            raise SystemExit("final package failed integrity test")
    replacement.replace(archive_path)

    package_hash = sha256(archive_path)
    package_bytes = archive_path.stat().st_size
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt.update({
        "bytes": package_bytes,
        "sha256": package_hash,
        "documentationSynchronized": True,
        "archiveIntegrityVerified": True,
    })
    write_json(receipt_path, receipt)

    cleanup_path = wm / "CLEANUP_RECEIPT.json"
    cleanup = json.loads(cleanup_path.read_text(encoding="utf-8"))
    cleanup.update({
        "fullPackageSHA256": package_hash,
        "fullPackageBytes": package_bytes,
        "documentationSynchronized": True,
    })
    write_json(cleanup_path, cleanup)

    handoff_path = wm / "HANDOFF.json"
    handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
    handoff.update({
        "packageSHA256": package_hash,
        "packageBytes": package_bytes,
        "archiveIntegrityVerified": True,
        "documentationSynchronized": True,
    })
    write_json(handoff_path, handoff)

    publication_path = wm / "PUBLICATION_RECEIPT.json"
    publication = json.loads(publication_path.read_text(encoding="utf-8"))
    publication.update({
        "packageSHA256": package_hash,
        "packageBytes": package_bytes,
        "archiveIntegrityVerified": True,
        "documentationSynchronized": True,
    })
    write_json(publication_path, publication)

    shutil.rmtree(temp_parent)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
