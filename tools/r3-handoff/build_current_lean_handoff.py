from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

PACKAGE_NAME = "Wenzhou_R3_8_LEAN_HANDOFF"
MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024
TEXT_SUFFIXES = {".md", ".txt", ".json", ".js", ".mjs", ".py", ".css", ".html", ".yml", ".yaml"}

CORE_FILES = [
    "AGENTS.md",
    "handoffs/wenzhou-r3-8-current-full-20260912/00_START_HERE.md",
    "handoffs/wenzhou-r3-8-current-full-20260912/01_HANDOFF_STATE.json",
    "handoffs/wenzhou-r3-8-current-full-20260912/02_SOURCE_LOCKS.json",
    "handoffs/wenzhou-r3-8-current-full-20260912/03_WORLD_SCORE_RULE.md",
    "handoffs/wenzhou-r3-8-current-full-20260912/04_NEXT_STEPS.md",
    "handoffs/wenzhou-r3-8-current-full-20260912/05_EVIDENCE_ARCHIVES.json",
    "handoffs/wenzhou-r3-8-current-full-20260912/06_PACKAGE_SCOPE.md",
    "handoffs/wenzhou-r3-8-current-full-20260912/07_PACKAGE_CHECKLIST.json",
    "site/dist/r3-8/index.html",
    "site/dist/r3-8/bootstrap.js",
    "site/dist/r3-8/soil-context.js",
    "site/dist/r3-8/environment-context.js",
    "site/dist/r3-8/world-score.js",
    "site/dist/r3-8/style.css",
    "site/dist/r3-8/overlay-transform-contract.js",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def collect(repo: Path) -> list[Path]:
    files: dict[str, Path] = {}
    for rel in CORE_FILES:
        p = repo / rel
        if p.is_file():
            files[p.relative_to(repo).as_posix()] = p

    for root_rel in ["tools/r3-8", "records/R3_8"]:
        root = repo / root_rel
        if not root.is_dir():
            continue
        for p in root.rglob("*"):
            if p.is_file() and p.suffix.lower() in TEXT_SUFFIXES and p.stat().st_size <= 1024 * 1024:
                files[p.relative_to(repo).as_posix()] = p

    return [files[k] for k in sorted(files)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", type=Path, required=True)
    ap.add_argument("--output-zip", type=Path, required=True)
    ap.add_argument("--source-commit", required=True)
    args = ap.parse_args()

    repo = args.repo_root.resolve()
    output = args.output_zip.resolve()
    files = collect(repo)
    if not files:
        raise RuntimeError("lean handoff has no files")

    entries = []
    total = 0
    for p in files:
        rel = p.relative_to(repo).as_posix()
        size = p.stat().st_size
        total += size
        entries.append({"path": rel, "bytes": size, "sha256": sha256(p)})

    if total > MAX_UNCOMPRESSED_BYTES:
        raise RuntimeError(f"lean handoff exceeded {MAX_UNCOMPRESSED_BYTES} bytes: {total}")

    lock = {
        "schema": "wenzhou-lean-handoff/v1",
        "sourceCommit": args.source_commit,
        "policy": "code-state-indexes-only",
        "largeDataPolicy": "do-not-carry; resolve by immutable release/tag/sha256 or fixed Git commit",
        "excludedByDesign": [
            "R3.1/R3.2 full restart archives",
            "complete lossless DEM archives",
            "historical fixed web versions",
            "permanent evidence ZIPs",
            "browser binary rasters",
            "offline Python wheels/dependencies",
        ],
        "semanticNote": "Soil Q0.5 and uncertainty are distinct evidence channels, not duplicates.",
        "fileCount": len(entries),
        "uncompressedBytes": total,
        "files": entries,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr(f"{PACKAGE_NAME}/LEAN_HANDOFF_LOCK.json", json.dumps(lock, ensure_ascii=False, indent=2) + "\n")
        for p in files:
            rel = p.relative_to(repo).as_posix()
            zf.write(p, f"{PACKAGE_NAME}/{rel}")

    report = {
        "passed": True,
        "package": output.name,
        "bytes": output.stat().st_size,
        "uncompressedBytes": total,
        "fileCount": len(entries),
        "sourceCommit": args.source_commit,
        "fullRestartBaseEmbedded": False,
        "permanentEvidenceEmbedded": False,
        "browserBinaryPayloadsEmbedded": False,
    }
    output.with_suffix(output.suffix + ".report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
