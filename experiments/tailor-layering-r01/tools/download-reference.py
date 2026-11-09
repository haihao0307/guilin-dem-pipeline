#!/usr/bin/env python3
"""Fetch the reviewed native-runtime closure and verify every Git blob.

No credentials are needed: the repository, revision and directory are fixed.
The filtering rules intentionally match tools/build.py. Clips and boot assets
are outside this experiment and are never downloaded by this script.
"""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
import time
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "reference" / "download-inventory.json"
DESTINATION = ROOT / "reference" / "mp05-studio-r10"
REPORT = ROOT / "evidence" / "download-reference.json"
REPOSITORY = "haihao0307/guilin-dem-pipeline"
REVISION = "c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49"
DIRECTORY = "kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef"
BASE_URL = f"https://raw.githubusercontent.com/{REPOSITORY}/{REVISION}/{DIRECTORY}/"
EXCLUDED_PREFIXES = ("qa-", "test-", "profile.", "bake-", "unit.")
EXCLUDED_NAMES = {"DOWNLOAD_REPORT.json", "SOURCE_AUDIT.md", "NATIVE_RUNTIME_AUDIT.md"}
EXPECTED_FILES = 286
EXPECTED_BYTES = 105_354_663
WORKERS = 8


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def selected_rows(inventory: dict) -> list[dict]:
    if inventory.get("revision") != REVISION or inventory.get("directory") != DIRECTORY:
        raise ValueError("Reference inventory does not identify the reviewed fixed source.")
    rows, seen = [], set()
    for row in inventory["files"]:
        name = row["path"]
        if not isinstance(name, str):
            raise ValueError("Inventory paths must be strings.")
        relative = PurePosixPath(name)
        if (not name or relative.is_absolute()
                or ".." in relative.parts or "\\" in name or "\0" in name
                or relative.as_posix() != name):
            raise ValueError(f"Unsafe or non-canonical inventory path: {name!r}")
        if name in seen:
            raise ValueError(f"Duplicate inventory path: {name}")
        seen.add(name)
        if relative.parts[0] in {"clips", "boot"} or relative.name in EXCLUDED_NAMES:
            continue
        if len(relative.parts) == 1 and relative.name.startswith(EXCLUDED_PREFIXES):
            continue
        if (not re.fullmatch(r"[0-9a-f]{40}", row["sha"])
                or type(row["size"]) is not int or row["size"] < 0):
            raise ValueError(f"Invalid Git blob metadata: {name}")
        rows.append({"path": name, "sha": row["sha"], "size": row["size"]})
    if len(rows) != EXPECTED_FILES or sum(row["size"] for row in rows) != EXPECTED_BYTES:
        raise ValueError("The selected source closure changed; review its inventory before downloading.")
    return rows


def safe_target(name: str) -> Path:
    target = DESTINATION.joinpath(*PurePosixPath(name).parts)
    component = DESTINATION
    for part in (None, *PurePosixPath(name).parts):
        if part is not None:
            component = component / part
        if component.is_symlink():
            raise ValueError(f"Refusing a symlink in reference destination: {name}")
    if not target.resolve().is_relative_to(DESTINATION.resolve()):
        raise ValueError(f"Reference destination escaped its directory: {name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def valid(data: bytes, row: dict) -> bool:
    return len(data) == row["size"] and blob_sha(data) == row["sha"]


def fetch_one(row: dict) -> dict:
    began = time.monotonic()
    target = safe_target(row["path"])
    if target.is_file() and valid(target.read_bytes(), row):
        return {**row, "status": "verified-existing", "elapsedSeconds": round(time.monotonic() - began, 3)}
    url = BASE_URL + urllib.parse.quote(row["path"], safe="/")
    last_error = None
    for attempt in range(1, 4):
        temporary = None
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "kaopu-layering-reference-verifier/1"})
            with urllib.request.urlopen(request, timeout=45) as response:
                if urllib.parse.urlparse(response.url).hostname != "raw.githubusercontent.com":
                    raise ValueError("Reference response left the fixed public source host.")
                data = response.read(row["size"] + 1)
            if not valid(data, row):
                raise ValueError(f"Git blob verification failed for {row['path']}")
            with tempfile.NamedTemporaryFile(prefix=".verified-", dir=target.parent, delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(data)
            os.replace(temporary, target)
            return {**row, "status": "downloaded-and-verified", "attempts": attempt,
                    "elapsedSeconds": round(time.monotonic() - began, 3)}
        except Exception as error:
            last_error = f"{type(error).__name__}: {error}"
            if temporary is not None:
                temporary.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(attempt)
    raise RuntimeError(f"{row['path']}: {last_error}")


def main() -> int:
    began = time.monotonic()
    report = {
        "schema": "kaopu-reference-download-evidence@1",
        "startedUTC": dt.datetime.now(dt.timezone.utc).isoformat(),
        "repository": REPOSITORY, "revision": REVISION, "directory": DIRECTORY,
        "workers": WORKERS, "gitBlobVerified": False, "files": [], "failures": [],
        "exclusions": {"directories": ["clips", "boot"], "topLevelPrefixes": EXCLUDED_PREFIXES,
                       "names": sorted(EXCLUDED_NAMES)},
    }
    try:
        raw = INVENTORY.read_bytes()
        report["inventorySHA256"] = hashlib.sha256(raw).hexdigest()
        rows = selected_rows(json.loads(raw))
        report.update(selectedFiles=len(rows), selectedBytes=sum(row["size"] for row in rows))
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as executor:
            futures = {executor.submit(fetch_one, row): row for row in rows}
            for completed, future in enumerate(concurrent.futures.as_completed(futures), 1):
                try:
                    report["files"].append(future.result())
                except Exception as error:
                    report["failures"].append({"path": futures[future]["path"], "error": str(error)})
                if completed % 25 == 0 or completed == len(rows):
                    print(f"Reference files checked: {completed}/{len(rows)}; failures: {len(report['failures'])}", flush=True)
        report["gitBlobVerified"] = not report["failures"] and len(report["files"]) == EXPECTED_FILES
    except Exception as error:
        report["failures"].append({"error": f"{type(error).__name__}: {error}"})
    finally:
        report["files"].sort(key=lambda row: row["path"])
        report["elapsedSeconds"] = round(time.monotonic() - began, 3)
        report["downloadedFiles"] = sum(row["status"] == "downloaded-and-verified" for row in report["files"])
        report["verifiedExistingFiles"] = sum(row["status"] == "verified-existing" for row in report["files"])
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report.get(key) for key in ["gitBlobVerified", "selectedFiles", "selectedBytes",
          "downloadedFiles", "verifiedExistingFiles", "elapsedSeconds", "failures"]}, ensure_ascii=False))
    return 0 if report["gitBlobVerified"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
