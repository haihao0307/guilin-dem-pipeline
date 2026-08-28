#!/usr/bin/env python3
"""Compile exact 2048 x 2048 Yangshuo Lijiang truth windows and analysis previews."""
from __future__ import annotations

import argparse, json, shutil
from datetime import datetime, timezone
from pathlib import Path

from yangshuo_candidates_v300_analysis import terrain_derivatives
from yangshuo_candidates_v300_common import sha
from yangshuo_candidates_v300_contract import validate_contract
from yangshuo_candidates_v300_product import compile_one
from yangshuo_candidates_v300_raster import check_source, dependencies

__all__ = ["terrain_derivatives"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path("projects/guilin/config/yangshuo_lijiang_candidates_v300.json"))
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--candidate", action="append", choices=tuple("ABCD"))
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root, source = args.root.resolve(), args.source.resolve()
    config_path = args.config if args.config.is_absolute() else root / args.config
    validation = validate_contract(root, config_path)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    output_root = args.output_dir or Path(config["outputs"]["root"])
    output_root = output_root if output_root.is_absolute() else root / output_root
    if output_root.exists() and any(output_root.iterdir()):
        if not args.overwrite:
            raise SystemExit(f"Output directory is not empty: {output_root}")
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    np, Image, ImageDraw, gdal, osr = dependencies()
    gdal.UseExceptions()
    dataset = gdal.Open(str(source), gdal.GA_ReadOnly)
    band, nodata = check_source(source, dataset, config, osr)
    hydro_path = root / config["hydrology"]["path"]
    hydro_document = json.loads(hydro_path.read_text(encoding="utf-8"))
    selected = set(args.candidate or "ABCD")
    records = [
        compile_one(
            np, Image, ImageDraw, gdal, osr, dataset, band, nodata, source, config, config_path,
            hydro_document, hydro_path, candidate, output_root,
        )
        for candidate in config["candidates"]
        if candidate["id"] in selected
    ]
    index = {
        "schemaVersion": "yangshuo-lijiang-candidate-index-v300/v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "passed": all(record["status"] == "ready-for-area-review" for record in records),
        "validation": validation,
        "sourceSha256": sha(source),
        "candidates": records,
        "locks": {
            "macroDeltaMeters": 0,
            "microDeltaMeters": 0,
            "userAreaApproval": False,
            "visualAcceptance": False,
        },
    }
    index_path = output_root / "candidate-index.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(index, ensure_ascii=False, indent=2))
    return 0 if index["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
