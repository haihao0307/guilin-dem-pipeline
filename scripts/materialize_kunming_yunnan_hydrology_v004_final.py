#!/usr/bin/env python3
"""Materialize the reviewed Kunming Yunnan hydrology V004 source payload."""
from __future__ import annotations

import base64
import hashlib
import io
import zipfile
from pathlib import Path

PAYLOAD_SHA256 = "ab3ee7c09ddaaf5e91b5d1ac613c32055e5a3aca26564e33e47e8b03eb6fa3b8"
EXPECTED_PARTS = 8


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parts_dir = Path(__file__).parent / "v004_final_payload_parts"
    parts = sorted(parts_dir.glob("chunk_*.txt"))
    if len(parts) != EXPECTED_PARTS:
        raise SystemExit(f"expected {EXPECTED_PARTS} payload parts, found {len(parts)}")
    encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
    raw = base64.b64decode(encoded, validate=True)
    actual = hashlib.sha256(raw).hexdigest()
    if actual != PAYLOAD_SHA256:
        raise SystemExit(f"payload SHA mismatch: {actual}")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        infos = archive.infolist()
        for info in infos:
            target = (root / info.filename).resolve()
            if root not in target.parents and target != root:
                raise SystemExit(f"unsafe payload path: {info.filename}")
        archive.extractall(root)

    index_path = root / "projects/kunming/web/yunnan-hydrology-v004/index.html"
    index_text = index_path.read_text(encoding="utf-8")
    index_text = index_text.replace(
        "页面没有总览、俯视、朝北等相机预设，镜头完全由你自行控制。",
        "页面不提供任何相机预设，镜头完全由你自行控制。",
    )
    index_path.write_text(index_text, encoding="utf-8")

    print(f"materialized {len(infos)} reviewed Kunming V004 source files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Deployment trigger: public 3D V004 build and browser acceptance.
