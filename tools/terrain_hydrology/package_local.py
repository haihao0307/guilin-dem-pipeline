#!/usr/bin/env python3
"""Build a complete Windows-friendly local package for the workbench."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path


def sha256_file(path: Path, chunk_size: int = 4 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, default=Path("dist"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    output = args.output if args.output.is_absolute() else root / args.output
    output.mkdir(parents=True, exist_ok=True)

    package_name = "terrain-hydrology-workbench-v100"
    package_root = output / package_name
    if package_root.exists():
        shutil.rmtree(package_root)
    package_root.mkdir(parents=True)

    workbench_source = root / "web/terrain-hydrology-workbench-v100"
    workbench_target = package_root / "web/terrain-hydrology-workbench-v100"
    shutil.copytree(workbench_source, workbench_target)

    guilin_relative = Path(
        "DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/web/assets/"
        "fine-regions/guilin-old-city"
    )
    guilin_source = root / guilin_relative
    guilin_target = package_root / guilin_relative
    guilin_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(guilin_source, guilin_target)

    launcher_source = root / "tools/terrain_hydrology/local_package"
    for name in ("START_WORKBENCH.cmd", "start_workbench.py", "README_CN.txt"):
        shutil.copy2(launcher_source / name, package_root / name)

    expected_sizes = {
        guilin_target / "height_u16.bin": 2_562_848,
        guilin_target / "mask_u8.bin": 1_281_424,
    }
    for path, expected in expected_sizes.items():
        if not path.is_file() or path.stat().st_size != expected:
            raise SystemExit(f"Package source asset mismatch: {path} expected {expected}")

    required = [
        workbench_target / "index.html",
        workbench_target / "style.css",
        workbench_target / "app.js",
        workbench_target / "real-slices.json",
        guilin_target / "terrain-manifest.json",
        guilin_target / "height_u16.bin",
        guilin_target / "mask_u8.bin",
        package_root / "START_WORKBENCH.cmd",
        package_root / "start_workbench.py",
        package_root / "README_CN.txt",
    ]
    for path in required:
        if not path.is_file():
            raise SystemExit(f"Required package file is missing: {path}")

    file_records = []
    for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
        file_records.append(
            {
                "path": path.relative_to(package_root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )

    manifest = {
        "schema": "terrain-hydrology-local-package@1.0.0",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": os.environ.get("GITHUB_SHA", "local-build"),
        "entry": "web/terrain-hydrology-workbench-v100/index.html",
        "launcher": "START_WORKBENCH.cmd",
        "regions": {
            "guilin": "real 12.5 m height mounted",
            "wenzhou": "locked until exact real slice is built",
            "kunming": "locked until authoritative source is mounted",
        },
        "vegetationRuntimeIncluded": False,
        "truthOverwrite": False,
        "syntheticGapFill": False,
        "files": file_records,
    }
    (package_root / "PACKAGE_MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    archive_base = output / f"{package_name}-local"
    archive_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=output, base_dir=package_name))
    result = {
        "passed": True,
        "packageRoot": str(package_root),
        "archive": str(archive_path),
        "archiveBytes": archive_path.stat().st_size,
        "archiveSha256": sha256_file(archive_path),
        "fileCount": len(file_records) + 1,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
