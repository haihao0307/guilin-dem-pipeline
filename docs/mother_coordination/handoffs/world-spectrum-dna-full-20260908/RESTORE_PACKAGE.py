#!/usr/bin/env python3
"""Restore the text-and-code World Spectrum DNA handoff archive.

Uses only the Python standard library. Every part and the reconstructed ZIP are
checked before extraction. Existing output is replaced only when hashes match.
"""

from __future__ import annotations

import base64
import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST_PATH = HERE / "ARCHIVE_MANIFEST.json"
PARTS_DIR = HERE / "archive_parts"
OUTPUT_ZIP = HERE / "World_Spectrum_DNA_Text_Code_Handoff_R0.1_2026-09-08.zip"
OUTPUT_DIR = HERE / "restored"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fail(message: str) -> None:
    raise SystemExit(f"RESTORE FAILED: {message}")


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    root = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if target != root and root not in target.parents:
            fail(f"unsafe archive member: {member.filename}")
    archive.extractall(destination)


def main() -> int:
    if not MANIFEST_PATH.is_file():
        fail(f"missing manifest: {MANIFEST_PATH}")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected_parts = manifest["parts"]
    encoded_pieces: list[str] = []

    for entry in expected_parts:
        path = PARTS_DIR / entry["name"]
        if not path.is_file():
            fail(f"missing archive part: {path.name}")
        raw = path.read_bytes()
        actual = sha256_bytes(raw)
        if actual != entry["sha256"]:
            fail(f"part hash mismatch for {path.name}: {actual}")
        if len(raw) != entry["bytes"]:
            fail(f"part size mismatch for {path.name}: {len(raw)}")
        encoded_pieces.append(raw.decode("ascii").strip())

    encoded = "".join(encoded_pieces)
    if len(encoded) != manifest["base64Characters"]:
        fail(f"base64 length mismatch: {len(encoded)}")

    try:
        zip_bytes = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        fail(f"invalid base64 archive: {exc}")

    actual_zip_sha = sha256_bytes(zip_bytes)
    expected_zip_sha = manifest["zipSha256"]
    if actual_zip_sha != expected_zip_sha:
        fail(f"ZIP hash mismatch: {actual_zip_sha}")
    if len(zip_bytes) != manifest["zipBytes"]:
        fail(f"ZIP size mismatch: {len(zip_bytes)}")

    OUTPUT_ZIP.write_bytes(zip_bytes)
    if sha256_file(OUTPUT_ZIP) != expected_zip_sha:
        fail("written ZIP did not retain its verified hash")

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)

    with zipfile.ZipFile(OUTPUT_ZIP, "r") as archive:
        bad_member = archive.testzip()
        if bad_member is not None:
            fail(f"ZIP CRC failure: {bad_member}")
        safe_extract(archive, OUTPUT_DIR)

    restored_root = OUTPUT_DIR / manifest["archiveRoot"]
    start_here = restored_root / "START_HERE.md"
    tests = restored_root / "prototype" / "test_wsd_reference.py"
    if not start_here.is_file() or not tests.is_file():
        fail("required restored files are missing")

    print("RESTORE OK")
    print(f"ZIP: {OUTPUT_ZIP}")
    print(f"SHA256: {expected_zip_sha}")
    print(f"PACKAGE: {restored_root}")
    print(f"START: {start_here}")
    print("TEST: python -m unittest prototype/test_wsd_reference.py -v")
    return 0


if __name__ == "__main__":
    sys.exit(main())
