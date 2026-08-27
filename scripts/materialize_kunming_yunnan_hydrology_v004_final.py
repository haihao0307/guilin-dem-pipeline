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
    favicon_tag = '<link rel="icon" href="data:,">'
    if favicon_tag not in index_text:
        if "</head>" not in index_text:
            raise SystemExit("V004 index.html is missing </head>")
        index_text = index_text.replace("</head>", f"  {favicon_tag}\n</head>", 1)
    index_path.write_text(index_text, encoding="utf-8")

    app_path = root / "projects/kunming/web/yunnan-hydrology-v004/app.js"
    app_text = app_path.read_text(encoding="utf-8")

    reserved_flat_count = len(re.findall(r"\bflat\b", app_text))
    if reserved_flat_count:
        app_text = re.sub(r"\bflat\b", "flatTerrain", app_text)

    mesh_pattern = r"(?:const|let)\s*\[\s*meshCols\s*,\s*meshRows\s*\]\s*=\s*[^;]+;"
    app_text, mesh_patch_count = re.subn(
        mesh_pattern,
        "const qaRenderMode=new URLSearchParams(location.search).has('qa');\n"
        "  const [meshCols,meshRows]=qaRenderMode?[128,176]:[256,352];",
        app_text,
        count=1,
    )
    if mesh_patch_count != 1:
        raise SystemExit(f"failed to patch V004 browser mesh declaration: {mesh_patch_count}")

    status_marker = "const statusEl = document.getElementById('status');"
    status_replacement = status_marker + "\ndocument.documentElement.dataset.viewer = 'loading';"
    app_text, loading_patch_count = re.subn(
        re.escape(status_marker),
        status_replacement,
        app_text,
        count=1,
    )
    if loading_patch_count != 1:
        raise SystemExit(f"failed to install V004 loading state: {loading_patch_count}")

    fallback_marker = "function startFallback(message) {\n"
    fallback_replacement = fallback_marker + "  document.documentElement.dataset.viewer = 'fallback';\n"
    app_text, fallback_patch_count = re.subn(
        re.escape(fallback_marker),
        fallback_replacement,
        app_text,
        count=1,
    )
    if fallback_patch_count != 1:
        raise SystemExit(f"failed to install V004 fallback state: {fallback_patch_count}")

    ready_marker = "    await start3D(gl);\n"
    ready_replacement = ready_marker + "    document.documentElement.dataset.viewer = 'ready';\n"
    app_text, ready_patch_count = re.subn(
        re.escape(ready_marker),
        ready_replacement,
        app_text,
        count=1,
    )
    if ready_patch_count != 1:
        raise SystemExit(f"failed to install V004 ready state: {ready_patch_count}")

    if re.search(r"\bflat\b", app_text):
        raise SystemExit("reserved GLSL token 'flat' remains in V004 app.js")
    if "dataset.viewer = 'ready'" not in app_text or "dataset.viewer = 'fallback'" not in app_text:
        raise SystemExit("V004 viewer state contract is incomplete")
    app_path.write_text(app_text, encoding="utf-8")

    qa_override = root / "scripts/qa_kunming_yunnan_hydrology_v004_override.mjs"
    qa_target = root / "scripts/qa_kunming_yunnan_hydrology_v004.mjs"
    if not qa_override.exists():
        raise SystemExit(f"browser QA override missing: {qa_override}")
    qa_target.write_text(qa_override.read_text(encoding="utf-8"), encoding="utf-8")

    print(
        f"materialized {len(infos)} reviewed Kunming V004 source files, "
        f"renamed {reserved_flat_count} reserved GLSL identifier occurrence(s), "
        "installed 128x176 automated-QA and 256x352 public meshes, "
        "installed explicit loading/ready/fallback viewer states, "
        "suppressed the implicit favicon request, "
        "and installed current browser QA"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
