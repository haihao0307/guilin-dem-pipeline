#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_root(arg: Path) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    if arg.is_dir():
        return arg.resolve(), None
    if arg.suffix.lower() != ".zip" or not arg.is_file():
        raise SystemExit(f"Expected package directory or ZIP: {arg}")
    tmp = tempfile.TemporaryDirectory(prefix="ocean-handoff-verify-")
    with zipfile.ZipFile(arg) as zf:
        bad = zf.testzip()
        if bad:
            raise SystemExit(f"ZIP CRC failure: {bad}")
        zf.extractall(tmp.name)
    children = [p for p in Path(tmp.name).iterdir() if p.is_dir()]
    root = children[0] if len(children) == 1 else Path(tmp.name)
    return root.resolve(), tmp


def main() -> int:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    root, tmp = resolve_root(target)
    try:
        checklist_path = root / "PACKAGE_CHECKLIST.json"
        manifest_path = root / "MANIFEST.json"
        handoff_path = root / "HANDOFF.json"
        for p in (checklist_path, manifest_path, handoff_path):
            if not p.is_file():
                raise SystemExit(f"Missing required control file: {p.relative_to(root)}")

        checklist = json.loads(checklist_path.read_text(encoding="utf-8"))
        for rel in checklist["required"]:
            if not (root / rel).is_file():
                raise SystemExit(f"Missing required file: {rel}")

        forbidden_fragments = [x.lower() for x in checklist["forbiddenPathFragments"]]
        forbidden_exts = {x.lower() for x in checklist["forbiddenExtensions"]}
        actual_files: list[Path] = []
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            low = rel.lower()
            if any(fragment in low for fragment in forbidden_fragments):
                raise SystemExit(f"Forbidden path in package: {rel}")
            if path.suffix.lower() in forbidden_exts:
                raise SystemExit(f"Forbidden asset extension in package: {rel}")
            actual_files.append(path)

        handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
        claims = handoff.get("claims", {})
        for name in checklist["approvalFlagsMustRemainFalse"]:
            if claims.get(name) is not False:
                raise SystemExit(f"Approval/claim flag must remain false: {name}")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries = {entry["path"]: entry for entry in manifest["entries"]}
        actual_rel = {
            p.relative_to(root).as_posix()
            for p in actual_files
            if p.relative_to(root).as_posix() != "MANIFEST.json"
        }
        if set(entries) != actual_rel:
            missing = sorted(actual_rel - set(entries))
            extra = sorted(set(entries) - actual_rel)
            raise SystemExit(f"Manifest file-set mismatch; missing={missing[:8]} extra={extra[:8]}")

        total = 0
        for rel, entry in entries.items():
            path = root / rel
            digest = sha256(path)
            size = path.stat().st_size
            if digest != entry["sha256"]:
                raise SystemExit(f"SHA mismatch: {rel}")
            if size != entry["bytes"]:
                raise SystemExit(f"Size mismatch: {rel}")
            total += size

        current_html = root / "current_mobile_candidate/Ocean_Mother_R0197_Mobile_Heightfield_Direct_Open.html"
        html = current_html.read_text(encoding="utf-8")
        if "R019.7 · MOBILE HEIGHTFIELD" not in html:
            raise SystemExit("Current candidate identity marker missing")

        if manifest.get("fileCount") != len(entries):
            raise SystemExit("Manifest fileCount mismatch")
        if manifest.get("totalBytes") != total:
            raise SystemExit("Manifest totalBytes mismatch")

        print(json.dumps({
            "status": "PASS",
            "packageRoot": root.name,
            "fileCount": len(entries),
            "totalBytes": total,
            "visualApproved": False,
            "productionApproved": False
        }, ensure_ascii=False, indent=2))
        return 0
    finally:
        if tmp is not None:
            tmp.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
