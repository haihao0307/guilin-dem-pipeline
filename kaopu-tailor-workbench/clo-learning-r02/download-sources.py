#!/usr/bin/env python3
"""Materialize only SHA-256-locked public source files; never use a floating ref."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
REPOSITORY = "haihao0307/guilin-dem-pipeline"
MANIFEST = ROOT / "SOURCE_MANIFEST.json"


def digest(path: Path) -> tuple[int, str]:
    h = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(block)
            h.update(block)
    return size, h.hexdigest()


def safe_path(relative: str) -> Path:
    p = PurePosixPath(relative)
    if p.is_absolute() or ".." in p.parts or str(p) != relative:
        raise ValueError(f"Invalid manifest path: {relative}")
    dest = ROOT.joinpath(*p.parts)
    if not dest.resolve().is_relative_to(ROOT):
        raise ValueError(f"Manifest path leaves project: {relative}")
    for parent in (dest, *dest.parents):
        if parent == ROOT:
            break
        if parent.is_symlink():
            raise ValueError(f"Symlink is not an allowed source target: {relative}")
    return dest


def correct_file(path: Path, entry: dict) -> bool:
    return path.is_file() and digest(path) == (entry["bytes"], entry["sha256"])


def validate(entry: dict) -> tuple[Path, str]:
    if entry["repository"] != REPOSITORY:
        raise ValueError("Source repository changed")
    if not re.fullmatch("[0-9a-f]{40}", entry["revision"]):
        raise ValueError("Every source requires a full pinned commit")
    if not re.fullmatch("[0-9a-f]{64}", entry["sha256"]):
        raise ValueError("Every source requires SHA-256")
    if not isinstance(entry["bytes"], int) or entry["bytes"] < 1:
        raise ValueError("Invalid expected byte size")
    source = PurePosixPath(entry["sourcePath"])
    if source.is_absolute() or ".." in source.parts or str(source) != entry["sourcePath"]:
        raise ValueError("Invalid upstream source path")
    dest = safe_path(entry["destination"])
    if not entry["destination"].startswith(("upstream/", "assets/")):
        raise ValueError("Downloader is restricted to upstream/ and assets/")
    url = (
        "https://raw.githubusercontent.com/"
        + REPOSITORY + "/" + entry["revision"] + "/"
        + urllib.parse.quote(entry["sourcePath"], safe="/")
    )
    return dest, url


def materialize(entry: dict, verify_only: bool) -> dict:
    dest, url = validate(entry)
    if correct_file(dest, entry):
        return {"path": entry["destination"], "status": "verified-existing"}
    if verify_only:
        raise RuntimeError(f"Missing or changed locked source: {entry['destination']}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        temp_path = None
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "KAOPU-CLO-Source-Lock/1"})
            with urllib.request.urlopen(req, timeout=45) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}: {entry['sourcePath']}")
                if urllib.parse.urlsplit(response.url).hostname != "raw.githubusercontent.com":
                    raise RuntimeError("Unexpected source redirect; no fallback is allowed")
                with tempfile.NamedTemporaryFile(prefix=".source-", dir=dest.parent, delete=False) as out:
                    temp_path = Path(out.name)
                    actual = hashlib.sha256()
                    size = 0
                    while block := response.read(65536):
                        size += len(block)
                        if size > entry["bytes"]:
                            raise RuntimeError(f"Source exceeds locked size: {entry['sourcePath']}")
                        actual.update(block)
                        out.write(block)
                    out.flush()
                    os.fsync(out.fileno())
            if (size, actual.hexdigest()) != (entry["bytes"], entry["sha256"]):
                raise RuntimeError(f"Source integrity mismatch: {entry['sourcePath']}")
            os.replace(temp_path, dest)
            temp_path = None
            return {"path": entry["destination"], "status": "downloaded-and-verified"}
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
    raise RuntimeError("Source download did not complete")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true", help="No network or writes; verify all locked inputs.")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest["schema"] != "kaopu.clo-learning-source-manifest/1":
        raise ValueError("Unsupported source manifest")
    if manifest["taskId"] != "CLO-LEARNING-PILOT-R02-20261022":
        raise ValueError("Wrong task manifest")
    entries = manifest["downloadFiles"]
    for source_path, locked in manifest["files"].items():
        matching = [item for item in entries if item["destination"] == "upstream/" + source_path]
        if len(matching) != 1 or matching[0]["revision"] != manifest["sourceSha"] or any(matching[0][key] != locked[key] for key in ("bytes", "sha256")):
            raise ValueError("Inconsistent source manifest views")
    names = [entry["destination"] for entry in entries]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate source destinations")
    for entry in entries:
        validate(entry)
    for entry in manifest["bundledVendorFiles"]:
        path = safe_path(entry["path"])
        if not entry["path"].startswith("vendor/") or not correct_file(path, entry):
            raise RuntimeError(f"Bundled vendor integrity mismatch: {entry['path']}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda entry: materialize(entry, args.verify_only), entries))
    print("SOURCE_VERIFIED", json.dumps({
        "downloadFiles": len(results),
        "downloaded": sum(item["status"] == "downloaded-and-verified" for item in results),
        "bundledVendorFiles": len(manifest["bundledVendorFiles"]),
        "bytes": sum(entry["bytes"] for entry in entries),
        "verifyOnly": args.verify_only,
    }), flush=True)


if __name__ == "__main__":
    main()

