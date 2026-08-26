#!/usr/bin/env python3
"""Materialize the reviewed Kunming Yunnan hydrology V004 source payload."""
from __future__ import annotations

import base64
import hashlib
import io
import re
import zipfile
from pathlib import Path

PAYLOAD_SHA256 = "ab3ee7c09ddaaf5e91b5d1ac613c32055e5a3aca26564e33e47e8b03eb6fa3b8"
EXPECTED_PARTS = 8


def replace_mesh_contract(text: str, key: str, dimensions: tuple[int, int]) -> tuple[str, int]:
    pattern = rf'(["\']{re.escape(key)}["\']\s*:\s*)\[\s*\d+\s*,\s*\d+\s*\]'
    replacement = rf'\g<1>[{dimensions[0]}, {dimensions[1]}]'
    return re.subn(pattern, replacement, text, count=1)


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

    app_path = root / "projects/kunming/web/yunnan-hydrology-v004/app.js"
    app_text = app_path.read_text(encoding="utf-8")
    reserved_flat_count = len(re.findall(r"\bflat\b", app_text))
    if reserved_flat_count:
        app_text = re.sub(r"\bflat\b", "flatTerrain", app_text)
        app_path.write_text(app_text, encoding="utf-8")
    if re.search(r"\bflat\b", app_path.read_text(encoding="utf-8")):
        raise SystemExit("reserved GLSL token 'flat' remains in V004 app.js")

    builder_path = root / "scripts/build_kunming_yunnan_hydrology_v004.py"
    builder_text = builder_path.read_text(encoding="utf-8")
    builder_text, desktop_replacements = replace_mesh_contract(builder_text, "meshDesktop", (480, 660))
    builder_text, compatibility_replacements = replace_mesh_contract(builder_text, "meshCompatibility", (256, 352))
    if desktop_replacements != 1 or compatibility_replacements != 1:
        raise SystemExit(
            "failed to reduce V004 browser mesh contract: "
            f"desktop={desktop_replacements}, compatibility={compatibility_replacements}"
        )
    builder_path.write_text(builder_text, encoding="utf-8")

    qa_override = root / "scripts/qa_kunming_yunnan_hydrology_v004_override.mjs"
    qa_target = root / "scripts/qa_kunming_yunnan_hydrology_v004.mjs"
    if not qa_override.exists():
        raise SystemExit(f"browser QA override missing: {qa_override}")
    qa_target.write_text(qa_override.read_text(encoding="utf-8"), encoding="utf-8")

    print(
        f"materialized {len(infos)} reviewed Kunming V004 source files, "
        f"renamed {reserved_flat_count} reserved GLSL identifier occurrence(s), "
        "reduced browser meshes to desktop 480x660 and compatibility 256x352, "
        "and installed robust browser QA"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
