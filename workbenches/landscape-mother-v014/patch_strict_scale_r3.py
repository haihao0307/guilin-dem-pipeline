#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_strict_scale_r3.py <materialized-source-root>")

root = Path(sys.argv[1])
build = root / "build_putao.py"
verify = root / "verify_v014.py"

text = build.read_text(encoding="utf-8")
replacements = {
    "if height < 56.0 or height > 205.0:": "if height < 60.0 or height > 200.0:",
    "height = float(np.clip(t.relative_height_m, 60.0, 205.0))": "height = float(np.clip(t.relative_height_m, 60.0, 200.0))",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing expected build source token: {old}")
    text = text.replace(old, new, 1)

needle = "    verts, faces, normals, _ = marching_cubes(\n"
if needle not in text:
    raise SystemExit("missing marching_cubes insertion point")
closure = """    # A positive air shell guarantees that the zero surface cannot touch the\n    # extraction box. The measured footprint has already been padded by 62.5 m,\n    # so this closes numerical seams without changing the intended tower profile.\n    shell = np.float32(max(dx, dy, dz) * 3.0)\n    phi[0, :, :] = np.maximum(phi[0, :, :], shell)\n    phi[-1, :, :] = np.maximum(phi[-1, :, :], shell)\n    phi[:, 0, :] = np.maximum(phi[:, 0, :], shell)\n    phi[:, -1, :] = np.maximum(phi[:, -1, :], shell)\n    phi[:, :, 0] = np.maximum(phi[:, :, 0], shell)\n    phi[:, :, -1] = np.maximum(phi[:, :, -1], shell)\n\n"""
text = text.replace(needle, closure + needle, 1)
build.write_text(text, encoding="utf-8")

vtext = verify.read_text(encoding="utf-8")n