#!/usr/bin/env python3
"""Build a deterministic Windows-compatible Phase A release package for ecology v0.4."""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PROJECT_ROOT.parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "outputs" / "Guilin_Ecology_v0.4.0_PhaseA_Windows.zip"
FIXED_DATE = (2026, 8, 22, 0, 0, 0)


class PackageError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def candidate_files() -> Iterable[Path]:
    explicit = [
        REPO_ROOT / "ops" / "control-state.json",
        PROJECT_ROOT / "HANDOFF_TERRAIN_V040.md",
        PROJECT_ROOT / "HANDOFF_ECOLOGY_V040.md",
        PROJECT_ROOT / "HANDOFF_RUNTIME_V040.md",
    ]
    for path in explicit:
        if path.is_file():
            yield path
    patterns = [
        "scripts/ecology_v040/*.py",
        "metadata/ecology/v0.4.0/*.json",
        "schemas/ecology/v0.4.0/*.json",
        "tests/test_*_v040.py",
        "web/ops/*",
        "site/public/terrain/ops/*",
        "reports/ECOLOGY_V040_RUNTIME_QA.json",
    ]
    for pattern in patterns:
        for path in sorted(PROJECT_ROOT.glob(pattern)):
            if path.is_file() and "__pycache__" not in path.parts:
                yield path


def archive_name(path: Path) -> str:
    if path.is_relative_to(PROJECT_ROOT):
        relative = path.relative_to(PROJECT_ROOT)
        return PurePosixPath("Guilin_Ecology_v0.4.0_PhaseA", relative.as_posix()).as_posix()
    if path.is_relative_to(REPO_ROOT):
        relative = path.relative_to(REPO_ROOT)
        return PurePosixPath("Guilin_Ecology_v0.4.0_PhaseA", "repo", relative.as_posix()).as_posix()
    raise PackageError(f"file outside repository: {path}")


def validate_archive_path(name: str) -> None:
    pure = PurePosixPath(name)
    if pure.is_absolute() or ".." in pure.parts:
        raise PackageError(f"unsafe archive path: {name}")
    if len(name) > 180:
        raise PackageError(f"archive path too long for Windows package: {name}")
    try:
        name.encode("ascii")
    except UnicodeEncodeError as exc:
        raise PackageError(f"archive path must be ASCII for Windows compatibility: {name}") from exc


def build_package(output: Path) -> dict[str, object]:
    unique: dict[str, Path] = {}
    for path in candidate_files():
        name = archive_name(path)
        validate_archive_path(name)
        unique[name] = path
    if not unique:
        raise PackageError("no files selected for release package")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
        for name in sorted(unique):
            path = unique[name]
            info = zipfile.ZipInfo(name, FIXED_DATE)
            info.create_system = 0
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(output, "r") as archive:
        bad = archive.testzip()
        if bad is not None:
            raise PackageError(f"archive integrity failed at {bad}")
        members = archive.namelist()
        if members != sorted(members):
            raise PackageError("archive members are not sorted deterministically")
        if len(members) != len(set(members)):
            raise PackageError("archive contains duplicate paths")
    digest = sha256_file(output)
    sha_path = output.with_suffix(output.suffix + ".sha256.txt")
    sha_path.write_text(f"{digest}  {output.name}\n", encoding="ascii")
    manifest = {
        "schema": "dem_ecology_windows_package@1.0",
        "output": str(output),
        "sha256": digest,
        "size_bytes": output.stat().st_size,
        "member_count": len(unique),
        "members": sorted(unique),
        "windows_compatibility": {
            "ascii_paths": True,
            "maximum_path_length": max(len(name) for name in unique),
            "standard_deflate": True,
            "encrypted_files": 0,
            "symbolic_links": 0
        }
    }
    manifest_path = output.with_suffix(output.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    manifest = build_package(args.output)
    print(json.dumps({key: manifest[key] for key in ("output", "sha256", "size_bytes", "member_count")}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
