#!/usr/bin/env python3
"""Reassemble retained evidence archives; verify part and archive identities.

Run from a checkout of the evidence branch. This utility never extracts archives
and refuses to overwrite an existing output file.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath


def checked_path(root, value):
    rel = PurePosixPath(value)
    if rel.is_absolute() or not rel.parts or any(p in ("..", ".") for p in rel.parts):
        raise ValueError(f"Unsafe relative path: {value!r}")
    path = root.joinpath(*rel.parts)
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes evidence directory: {value!r}")
    for candidate in (path, *path.parents):
        if candidate == root.parent:
            break
        if candidate.is_symlink():
            raise ValueError(f"Symlink is not accepted: {value!r}")
    return path


def restore(root, archive, destination):
    name = archive["file"]
    if PurePosixPath(name).name != name or name in ("", ".", ".."):
        raise ValueError(f"Unsafe archive filename: {name!r}")
    target = destination / name
    total = 0
    full_hash = hashlib.sha256()
    created = False
    try:
        with target.open("xb") as output:
            created = True
            for part in archive["parts"]:
                if part["offset"] != total:
                    raise ValueError(f"Non-contiguous part: {part['file']}")
                source = checked_path(root, part["file"])
                if source.stat().st_size != part["bytes"]:
                    raise ValueError(f"Part size mismatch: {part['file']}")
                part_hash = hashlib.sha256()
                git_hash = hashlib.sha1(f"blob {part['bytes']}\0".encode())
                count = 0
                with source.open("rb") as stream:
                    while chunk := stream.read(1024 * 1024):
                        count += len(chunk)
                        part_hash.update(chunk)
                        git_hash.update(chunk)
                        full_hash.update(chunk)
                        output.write(chunk)
                if count != part["bytes"] or part_hash.hexdigest() != part["sha256"]:
                    raise ValueError(f"Part SHA-256 mismatch: {part['file']}")
                if git_hash.hexdigest() != part["gitBlobSHA"]:
                    raise ValueError(f"Part Git blob identity mismatch: {part['file']}")
                total += count
        if total != archive["bytes"] or full_hash.hexdigest() != archive["sha256"]:
            raise ValueError(f"Complete archive identity mismatch: {name}")
    except BaseException:
        if created:
            target.unlink(missing_ok=True)
        raise
    return {"file": name, "bytes": total, "sha256": full_hash.hexdigest(), "verified": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("EVIDENCE_INDEX.json"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--archive", action="append", help="Restore only this named archive; repeatable")
    args = parser.parse_args()
    index = json.loads(args.index.read_text())
    if index.get("schema") != "tailor-r03-retained-evidence@1":
        raise ValueError("Unexpected evidence index schema")
    all_names = [entry["file"] for entry in index["archives"]]
    if len(all_names) != len(set(all_names)):
        raise ValueError("Duplicate archive names")
    requested = set(args.archive or all_names)
    if not requested.issubset(all_names):
        raise ValueError(f"Unknown archive names: {sorted(requested.difference(all_names))}")
    args.output.mkdir(parents=True, exist_ok=True)
    results = [restore(args.index.parent, item, args.output)
               for item in index["archives"] if item["file"] in requested]
    print(json.dumps({"sourceCommit": index["sourceCommit"], "archives": results}, indent=2))


if __name__ == "__main__":
    main()
