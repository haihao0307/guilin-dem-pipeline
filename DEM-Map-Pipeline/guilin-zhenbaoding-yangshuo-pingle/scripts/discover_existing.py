from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from common import expand_path, read_json, sha256_file, utc_now, write_json

SKIP_DIR_NAMES = {
    "$recycle.bin",
    "system volume information",
    "windows",
    "program files",
    "program files (x86)",
    "programdata",
    ".git",
    ".venv",
    "node_modules",
}


def direct_candidates(root: Path, name: str) -> list[Path]:
    candidates = [
        root / "data" / "existing_five" / name,
        Path(r"C:\HaihaoDEM\ASF_ALOS_PALSAR_12_5m_Guilin_OneClick\data\raw\dem") / name,
        Path(r"C:\HaihaoDEM\ASF_v104_local\data\raw\dem") / name,
    ]
    return candidates


def walk_for_name(search_root: Path, target_name: str, max_depth: int = 9) -> Path | None:
    if not search_root.exists() or not search_root.is_dir():
        return None
    base_depth = len(search_root.resolve().parts)
    try:
        for current, dirs, files in os.walk(search_root):
            current_path = Path(current)
            depth = len(current_path.resolve().parts) - base_depth
            dirs[:] = [
                d
                for d in dirs
                if d.lower() not in SKIP_DIR_NAMES and not d.startswith(".") and depth < max_depth
            ]
            if target_name in files:
                return current_path / target_name
    except (PermissionError, OSError):
        return None
    return None


def locate_one(root: Path, name: str, configured_roots: list[Path]) -> Path | None:
    seen: set[str] = set()
    for candidate in direct_candidates(root, name):
        key = str(candidate).lower()
        if key in seen:
            continue
        seen.add(key)
        if candidate.is_file():
            return candidate.resolve()
    for search_root in configured_roots:
        direct = search_root / name
        key = str(direct).lower()
        if key not in seen and direct.is_file():
            return direct.resolve()
        seen.add(key)
    for search_root in configured_roots:
        found = walk_for_name(search_root, name)
        if found is not None:
            return found.resolve()
    return None


def run(config_path: Path, manifest_path: Path, root: Path, allow_missing: bool) -> int:
    config = read_json(config_path)
    manifest = read_json(manifest_path)
    output_rel = config["outputs"]["existingResolved"]
    output_path = root / output_rel

    configured_roots = [root / "data" / "existing_five"]
    for raw in config["existingFive"].get("searchRoots", []):
        configured_roots.append(expand_path(raw, root))

    resolved: list[dict[str, Any]] = []
    missing: list[str] = []
    verify_hash = bool(config["existingFive"].get("verifySha256", True))
    allow_hash_mismatch = bool(config["existingFive"].get("allowHashMismatch", False))

    for entry in manifest["files"]:
        name = entry["file"]
        print(f"寻找既有源片：{name}")
        path = locate_one(root, name, configured_roots)
        if path is None:
            missing.append(name)
            continue
        record: dict[str, Any] = {
            **entry,
            "resolvedPath": str(path),
            "actualBytes": path.stat().st_size,
            "sizeMatches": path.stat().st_size == int(entry["bytes"]),
        }
        if verify_hash:
            print(f"校验 SHA256：{name}")
            actual_hash = sha256_file(path)
            record["actualSha256"] = actual_hash
            record["sha256Matches"] = actual_hash.lower() == str(entry["sha256"]).lower()
            if not record["sha256Matches"] and not allow_hash_mismatch:
                raise RuntimeError(f"既有源片哈希不匹配：{path}")
        resolved.append(record)
        print(f"已复用：{path}")

    status = "complete" if not missing else "missing_files"
    report = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "status": status,
        "expectedCount": len(manifest["files"]),
        "resolvedCount": len(resolved),
        "missing": missing,
        "files": resolved,
        "searchedRoots": [str(path) for path in configured_roots],
    }
    write_json(output_path, report)

    if missing and not allow_missing:
        names = "\n".join(missing)
        raise RuntimeError(
            "没有找到全部五张旧 DEM。请把缺失文件放进 data\\existing_five 后重新运行：\n" + names
        )
    print(f"既有源片解析报告：{output_path}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Locate and verify the five existing DEM rasters")
    parser.add_argument("--config", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--allow-missing", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(
            Path(args.config).resolve(),
            Path(args.manifest).resolve(),
            Path(args.root).resolve(),
            bool(args.allow_missing),
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
