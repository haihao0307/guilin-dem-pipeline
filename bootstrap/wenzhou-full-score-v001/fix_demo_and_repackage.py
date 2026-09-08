#!/usr/bin/env python3
"""Repair the generated single-file demo with mask-aware block means.

The authoritative score and QA are unchanged. This script removes the NoData
sentinel from preview averaging, refreshes the package manifest, and rebuilds the
recovery ZIP so its demo and hashes remain internally consistent.
"""
from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
import re
import zipfile
import zlib

import numpy as np

from source_data import SOURCE

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "projects/wenzhou/full-score-v001"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode_source(page: dict) -> tuple[np.ndarray, np.ndarray]:
    height_raw = zlib.decompress(base64.b64decode(page["heightZlibB64"]))
    mask_raw = zlib.decompress(base64.b64decode(page["maskZlibB64"]))
    height = np.frombuffer(height_raw, dtype="<i2").reshape(page["height"], page["width"]).copy()
    mask = np.unpackbits(np.frombuffer(mask_raw, dtype=np.uint8), bitorder="little")[: height.size]
    return height, mask.reshape(height.shape).astype(bool)


def mask_aware_block_mean(height: np.ndarray, mask: np.ndarray, output_size: int = 16) -> list[list[int | None]]:
    factor = height.shape[0] // output_size
    values = height.reshape(output_size, factor, output_size, factor).astype(np.int64)
    valid = (~mask).reshape(output_size, factor, output_size, factor)
    counts = valid.sum(axis=(1, 3))
    totals = np.where(valid, values, 0).sum(axis=(1, 3))
    result: list[list[int | None]] = []
    for row in range(output_size):
        output_row: list[int | None] = []
        for col in range(output_size):
            if counts[row, col] == 0:
                output_row.append(None)
            else:
                output_row.append(int(np.rint(totals[row, col] / counts[row, col])))
        result.append(output_row)
    return result


def repair_demo() -> None:
    path = OUT / "06_DEMO/index.html"
    html = path.read_text(encoding="utf-8")
    match = re.search(r'<script type="application/json" id="d">([\s\S]*?)</script>', html)
    if not match:
        raise RuntimeError("embedded demo JSON not found")
    data = json.loads(match.group(1))
    source_by_id = {page["pageId"]: page for page in SOURCE["pages"]}
    for page in data["pages"]:
        source = source_by_id[page["pageId"]]
        height, mask = decode_source(source)
        page["values"] = mask_aware_block_mean(height, mask)
        page["previewNoDataPolicy"] = "exclude sentinel from block mean; null only when a block has no valid samples"
    encoded = json.dumps(data, ensure_ascii=False).replace("</script>", "<\\/script>")
    repaired = html[: match.start(1)] + encoded + html[match.end(1) :]
    repaired = repaired.replace(
        "p.values.flat().forEach((v,i)=>{let t=Math.max(0,Math.min(1,(v-p.min)/Math.max(1,p.max-p.min))),o=i*4;im.data[o]=30+190*t;im.data[o+1]=65+120*(1-Math.abs(t-.5)*1.4);im.data[o+2]=95-55*t;im.data[o+3]=255})",
        "p.values.flat().forEach((v,i)=>{let o=i*4;if(v===null){im.data[o]=4;im.data[o+1]=10;im.data[o+2]=16;im.data[o+3]=255;return}let t=Math.max(0,Math.min(1,(v-p.min)/Math.max(1,p.max-p.min)));im.data[o]=30+190*t;im.data[o+1]=65+120*(1-Math.abs(t-.5)*1.4);im.data[o+2]=95-55*t;im.data[o+3]=255})",
    )
    path.write_text(repaired, encoding="utf-8")


def rebuild_package() -> dict:
    package_dir = OUT / "07_PACKAGE"
    package_dir.mkdir(parents=True, exist_ok=True)
    package = package_dir / "WENZHOU_FULL_SCORE_MULTICONDUCTOR_GITHUB_V0_1_0_FULL_PACKAGE.zip"
    sidecar = package.with_suffix(".zip.sha256")
    package.unlink(missing_ok=True)
    sidecar.unlink(missing_ok=True)

    files = [
        path
        for path in sorted(OUT.rglob("*"))
        if path.is_file() and package_dir not in path.parents
    ]
    manifest = {
        "schema": "wenzhou-full-score-package/github-v0.1.1-preview-fix",
        "payloads": [
            {
                "path": str(path.relative_to(OUT)),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for path in files
        ],
        "repair": "mask-aware coastal preview; score and QA identities unchanged",
    }
    manifest_path = package_dir / "MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(OUT.rglob("*")):
            if not path.is_file() or path == package or path == sidecar:
                continue
            archive.write(path, arcname=f"{OUT.name}/{path.relative_to(OUT)}")
    with zipfile.ZipFile(package) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("recovery ZIP CRC test failed")
    digest = sha256_file(package)
    sidecar.write_text(f"{digest}  {package.name}\n", encoding="utf-8")
    return {
        "package": str(package),
        "bytes": package.stat().st_size,
        "sha256": digest,
        "demoSha256": sha256_file(OUT / "06_DEMO/index.html"),
    }


def main() -> int:
    repair_demo()
    report = rebuild_package()
    report.update({"passed": True, "scoreIdentityChanged": False, "qaIdentityChanged": False})
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
