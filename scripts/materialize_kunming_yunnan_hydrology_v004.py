#!/usr/bin/env python3
"""Materialize reviewed Kunming V004 source files from text payload parts."""
from __future__ import annotations

import base64
import hashlib
import io
import zipfile
from pathlib import Path

PAYLOAD_SHA256 = "e32ac1a7ea93dd8090d45adc32f6581bc4fa6046ad53f92d89258e5d60e63341"


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parts = sorted((Path(__file__).parent / "v004_payload_parts").glob("part_*.txt"))
    if len(parts) != 4:
        raise SystemExit(f"expected 4 payload parts, found {len(parts)}")
    raw = base64.b64decode("".join(part.read_text().strip() for part in parts), validate=True)
    actual = hashlib.sha256(raw).hexdigest()
    if actual != PAYLOAD_SHA256:
        raise SystemExit(f"payload SHA mismatch: {actual}")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        infos = archive.infolist()
        for info in infos:
            target = (root / info.filename).resolve()
            if root not in target.parents and target != root:
                raise SystemExit(f"unsafe path: {info.filename}")
        archive.extractall(root)
    print(f"materialized {len(infos)} Kunming V004 source files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
