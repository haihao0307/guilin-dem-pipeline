#!/usr/bin/env python3
"""Read-only TEN24 integrity check. No network, extraction, Blender, or writes.

Python 3.8+ standard library only. JSON report goes to stdout; progress to stderr.
Exit 0: all requested checks pass. Exit 1: mismatch/error. Exit 2: bad arguments.
"""
import argparse
import hashlib
import json
import pathlib
import sys
import time
import zipfile
import zlib


def digest(stream):
    sha, crc, size = hashlib.sha256(), 0, 0
    while True:
        block = stream.read(1024 * 1024)
        if not block:
            break
        sha.update(block)
        crc = zlib.crc32(block, crc)
        size += len(block)
    return {"bytes": size, "sha256": sha.hexdigest(), "crc32": "%08x" % crc}


def safe_relative(name):
    p = pathlib.PurePosixPath(name)
    if not name or p.is_absolute() or ".." in p.parts or "\\" in name or ":" in name:
        raise ValueError("Unsafe manifest/archive path: " + name)
    return p


def compare(expected, actual):
    return all(expected[key] == actual[key] for key in ("bytes", "sha256", "crc32"))


def verify_zip(path, manifest):
    report = {"kind": "archive", "file": str(path), "ok": False}
    with path.open("rb") as stream:
        archive = digest(stream)
    report["measured"] = archive
    report["archive_sha_and_size_match"] = all(
        archive[k] == manifest["archive"][k] for k in ("bytes", "sha256"))
    if not report["archive_sha_and_size_match"]:
        report["error"] = "Archive differs from verified original; do not open or substitute it"
        return report
    expected = {f["path"]: f for f in manifest["files"]}
    results, directories = [], 0
    with zipfile.ZipFile(path) as z:
        entries = z.infolist()
        names = [i.filename for i in entries]
        if len(set(names)) != len(names):
            raise ValueError("Duplicate ZIP paths")
        files = {i.filename: i for i in entries if not i.is_dir()}
        report["entry_count"] = len(entries)
        report["missing"] = sorted(set(expected) - set(files))
        report["extra"] = sorted(set(files) - set(expected))
        for i, entry in enumerate(entries):
            safe_relative(entry.filename)
            with z.open(entry, "r") as stream:
                actual = digest(stream)  # ZipFile independently validates CRC at EOF.
            crc_ok = actual["crc32"] == "%08x" % entry.CRC
            if entry.is_dir():
                directories += 1
                if actual["bytes"] != 0 or not crc_ok:
                    raise ValueError("Invalid directory entry " + entry.filename)
            else:
                ok = entry.filename in expected and compare(expected[entry.filename], actual) and crc_ok
                results.append({"path": entry.filename, "ok": ok, **actual})
            print("ZIP %d/%d: %s" % (i + 1, len(entries), entry.filename), file=sys.stderr)
    report["directories_crc_checked"] = directories
    report["files"] = results
    report["ok"] = (len(entries) == manifest["archive"]["entry_count"] and
                    len(results) == manifest["archive"]["file_count"] and
                    not report["missing"] and not report["extra"] and
                    all(r["ok"] for r in results))
    return report


def verify_directory(root, manifest):
    if not root.is_dir():
        raise ValueError("Extracted original directory does not exist: " + str(root))
    root = root.resolve()
    expected = {f["path"]: f for f in manifest["files"]}
    actual_paths = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() or p.is_symlink()}
    report = {"kind": "directory", "root": str(root), "ok": False,
              "missing": sorted(set(expected) - actual_paths),
              "extra": sorted(actual_paths - set(expected)), "files": []}
    for i, (relative, exp) in enumerate(expected.items()):
        rel = safe_relative(relative)
        path = root.joinpath(*rel.parts)
        if not path.is_file():
            report["files"].append({"path": relative, "ok": False, "error": "missing"})
            continue
        if path.is_symlink() or root not in path.resolve().parents:
            raise ValueError("Source path escapes original root: " + relative)
        with path.open("rb") as stream:
            measured = digest(stream)
        report["files"].append({"path": relative, "ok": compare(exp, measured), **measured})
        print("FILE %d/%d: %s" % (i + 1, len(expected), relative), file=sys.stderr)
    report["ok"] = not report["missing"] and not report["extra"] and all(r["ok"] for r in report["files"])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=pathlib.Path, default=pathlib.Path(__file__).with_name("original-files-manifest.json"))
    parser.add_argument("--zip", dest="archive", type=pathlib.Path)
    parser.add_argument("--root", type=pathlib.Path, help="Extracted original root containing Blender, Textures, etc.")
    args = parser.parse_args()
    if not args.archive and not args.root:
        parser.error("Specify --zip and/or --root")
    result = {"ok": False, "read_only": True, "checks": []}
    start = time.monotonic()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        names = [f["path"] for f in manifest["files"]]
        if len(set(names)) != len(names) or len(names) != manifest["archive"]["file_count"]:
            raise ValueError("Invalid manifest file count or duplicate paths")
        for name in names:
            safe_relative(name)
        if args.archive:
            result["checks"].append(verify_zip(args.archive, manifest))
        if args.root:
            result["checks"].append(verify_directory(args.root, manifest))
        result["ok"] = all(c["ok"] for c in result["checks"])
    except Exception as error:
        result["error"] = "%s: %s" % (type(error).__name__, error)
    result["seconds"] = round(time.monotonic() - start, 3)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
