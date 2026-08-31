"""Verify the complete numeric-only handoff. Original TIFF files are not required.

Checks the exact file inventory, per-file sizes and hashes, the checksum list,
and rejects TIFF files, nested archives, unsafe paths, and symbolic links.
Generated root/out files and Python bytecode caches are excluded explicitly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath

EXCLUDED_METADATA = {"FILE_MANIFEST.json", "SHA256SUMS.txt"}
FORBIDDEN_SUFFIXES = {".tif", ".tiff", ".zip", ".7z", ".rar", ".tar", ".gz", ".xz", ".bz2"}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for data in iter(lambda: handle.read(8 << 20), b""):
            result.update(data)
    return result.hexdigest()


def safe_relative(value: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError(f"Unsafe manifest path: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or str(path) != value:
        raise ValueError(f"Unsafe/non-canonical manifest path: {value!r}")
    return path


def ignored(parts: tuple[str, ...]) -> bool:
    return bool(parts and (parts[0] == "out" or "__pycache__" in parts or parts[-1].endswith(".pyc")))


def verify(root: Path) -> dict:
    root = root.resolve()
    manifest_path = root / "FILE_MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("source_tiff_in_package") is not False:
        raise ValueError("This must be the numeric-only package manifest")
    if set(manifest.get("inventory_excludes", [])) != EXCLUDED_METADATA:
        raise ValueError("Unexpected inventory exclusions")

    actual_files: set[str] = set()
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if ignored(rel.parts):
            continue
        if path.is_symlink():
            raise ValueError(f"Symbolic link in package: {rel}")
        if path.is_file():
            if path.suffix.lower() in FORBIDDEN_SUFFIXES:
                raise ValueError(f"TIFF/nested archive forbidden in numeric-only package: {rel}")
            actual_files.add(rel.as_posix())

    names: set[str] = set()
    hashes: dict[str, str] = {}
    total = 0
    failures: list[str] = []
    for record in manifest["files"]:
        rel = safe_relative(record["path"])
        name = rel.as_posix()
        if name in names or name in EXCLUDED_METADATA:
            raise ValueError(f"Duplicate/reserved inventory path: {name}")
        names.add(name)
        path = root.joinpath(*rel.parts)
        if not path.is_file() or path.is_symlink():
            failures.append(f"Missing/linked file: {name}")
            continue
        size = path.stat().st_size
        checksum = digest(path)
        if size != record["bytes"] or checksum != record["sha256"]:
            failures.append(f"Identity mismatch: {name}")
        total += size
        hashes[name] = checksum
    expected = names | EXCLUDED_METADATA
    if actual_files != expected:
        failures.append(f"Unlisted files: {sorted(actual_files - expected)}")
        failures.append(f"Missing files: {sorted(expected - actual_files)}")
    if total != manifest["listed_file_bytes"]:
        failures.append("Listed payload byte total mismatch")
    if failures:
        raise ValueError("\n".join(failures))

    # SHA256SUMS covers FILE_MANIFEST too; only its own hash is external to the package.
    listed_sha: dict[str, str] = {}
    for line in (root / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines():
        checksum, name = line.split("  ", 1)
        safe_relative(name)
        if len(checksum) != 64 or any(c not in "0123456789abcdef" for c in checksum) or name in listed_sha:
            raise ValueError("Invalid checksum-list entry")
        listed_sha[name] = checksum
    if set(listed_sha) != actual_files - {"SHA256SUMS.txt"}:
        raise ValueError("Checksum-list file set mismatch")
    hashes["FILE_MANIFEST.json"] = digest(manifest_path)
    if any(hashes[name] != checksum for name, checksum in listed_sha.items()):
        raise ValueError("Checksum-list hash mismatch")
    return {
        "schema": "guilin-numeric-only-package-verification/v2",
        "passed": True,
        "verified_inventory_files": len(names),
        "total_files_including_inventory": len(actual_files),
        "verified_inventory_bytes": total,
        "total_extracted_file_bytes": sum((root / name).stat().st_size for name in actual_files),
        "strict_inventory_match": True,
        "checksum_list_verified": True,
        "source_tiff_files": 0,
        "source_tiff_required": False,
        "nested_archives": 0,
        "source_tiff_opened_or_decoded": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    result = verify(args.root)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
