from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from core import (
    ANCHORS, AOI_BOUNDS, AOI_SHA256, CANONICAL_BRANCH, CANONICAL_TAG,
    HYDRO_BLOB_SHA1, HYDRO_BYTES, HYDRO_SHA256, PUBLIC_URL, RAW_BYTES, CRS,
    RAW_GRID, RAW_NAME, RAW_SHA256, SPACING, TILE_BYTES, git_blob_sha1,
    sha256, validate_and_manifest, write_json,
)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-tiff", type=Path, required=True)
    parser.add_argument("--tile-dir", type=Path, required=True)
    parser.add_argument("--hydrology", type=Path, required=True)
    parser.add_argument("--clean-root", type=Path, required=True)
    parser.add_argument("--viewer-source", type=Path, required=True)
    parser.add_argument("--workflow-source", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    if args.hydrology.stat().st_size != HYDRO_BYTES or sha256(args.hydrology) != HYDRO_SHA256 or git_blob_sha1(args.hydrology) != HYDRO_BLOB_SHA1:
        raise RuntimeError("hydrology identity failed")
    manifest, validation = validate_and_manifest(args.source_tiff, args.tile_dir)
    root = args.clean_root
    shutil.rmtree(root, ignore_errors=True)
    for folder in (".github/workflows", "contracts", "truth", "knowledge", "pipeline", "viewer"):
        (root / folder).mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.workflow_source, root / ".github/workflows/guilin-single-truth.yml")
    source_pipeline = Path(__file__).resolve().parent
    for source in source_pipeline.glob("*.py"):
        shutil.copy2(source, root / "pipeline" / source.name)
    if (source_pipeline / "canonicalize.clean.sh").is_file():
        shutil.copy2(source_pipeline / "canonicalize.clean.sh", root / "pipeline/canonicalize.sh")
    elif (source_pipeline / "canonicalize.sh").is_file():
        shutil.copy2(source_pipeline / "canonicalize.sh", root / "pipeline/canonicalize.sh")
    else:
        parts = sorted(source_pipeline.glob("canonicalize.part*.sh"))
        if not parts:
            raise RuntimeError("canonicalize shell source is missing")
        (root / "pipeline/canonicalize.sh").write_text("".join(part.read_text(encoding="utf-8") for part in parts), encoding="utf-8")
    for name in ("index.html", "styles.css"):
        shutil.copy2(args.viewer_source / name, root / "viewer" / name)
    if (args.viewer_source / "app.js").is_file():
        shutil.copy2(args.viewer_source / "app.js", root / "viewer/app.js")
    else:
        parts = sorted(args.viewer_source.glob("app.part*.js"))
        if not parts:
            raise RuntimeError("viewer app source is missing")
        (root / "viewer/app.js").write_text("".join(part.read_text(encoding="utf-8") for part in parts), encoding="utf-8")
    shutil.copy2(args.hydrology, root / "truth/OSM_HYDROLOGY_IMMUTABLE.geojson")
    write_json(root / "truth/NATIVE_ELEVATION_MANIFEST.json", manifest)
    ring = [
        [AOI_BOUNDS[0], AOI_BOUNDS[1]],
        [AOI_BOUNDS[2], AOI_BOUNDS[1]],
        [AOI_BOUNDS[2], AOI_BOUNDS[3]],
        [AOI_BOUNDS[0], AOI_BOUNDS[3]],
        [AOI_BOUNDS[0], AOI_BOUNDS[1]],
    ]
    aoi_geojson = {
        "type": "FeatureCollection",
        "name": "Guilin accepted AOI",
        "features": [{
            "type": "Feature",
            "properties": {"status": "ACCEPTED", "geometry_sha256": AOI_SHA256},
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }],
    }
    write_json(root / "truth/AOI_ACCEPTED.geojson", aoi_geojson)
    (root / "truth/AOI_ACCEPTED_EPSG32649.wkt").write_text(f"POLYGON (({AOI_BOUNDS[0]} {AOI_BOUNDS[1]}, {AOI_BOUNDS[2]} {AOI_BOUNDS[1]}, {AOI_BOUNDS[2]} {AOI_BOUNDS[3]}, {AOI_BOUNDS[0]} {AOI_BOUNDS[3]}, {AOI_BOUNDS[0]} {AOI_BOUNDS[1]}))\n", encoding="utf-8")
    identity = {"schema": "guilin-canonical-dem-identity/v1", "status": "SOLE_AUTHORITATIVE_GUILIN_DEM", "effective_date": "2026-08-29", "canonical_branch": CANONICAL_BRANCH, "canonical_release": CANONICAL_TAG, "public_review_url": PUBLIC_URL, "source_provenance": {"file": RAW_NAME, "bytes": RAW_BYTES, "sha256": RAW_SHA256, "crs": CRS, "grid": RAW_GRID, "native_spacing_m": [SPACING, SPACING], "native_spacing_unit": "metre", "source_elevation_modified_m": 0.0}, "canonical_numeric_asset": {"tile_count": 54, "matrix": [9, 6], "bytes_per_tile": TILE_BYTES, "total_tile_bytes": 54 * TILE_BYTES, "encoding": "int16-little-endian-raw-elevation-m", "compression": "none", "resampling": "none", "quantization": "none", "gap_fill": False, "fallback_30m": False}, "interpretation_note": "The locked source supports native 12.5 metre spacing. A spoken 12.5 centimetre reference is not supported by the source identity.", "supersedes_all_prior_guilin_dem_assets": True}
    rules = {"schema": "guilin-production-rules/v1", "status": "mandatory", "authoritative_input": "contracts/CANONICAL_DEM_IDENTITY.json", "required": ["Use the exact source SHA256 and 54 raw tiles", "Keep each raw tile uncompressed", "Generate terrain geometry directly from numeric elevation samples", "Keep source elevation delta at zero", "Keep vertical scale at 1.00", "Keep lake assets at zero", "Preserve immutable real line hydrology and node connectivity"], "forbidden": ["Any compression of DEM or native tiles", "Any height image texture as terrain input", "Any retired procedural terrain route", "Any 30 m fallback", "Any interpolation or synthetic gap fill", "Any old Guilin DEM, preview, screenshot page, archive, duplicate cache or rollback asset", "Any artificial lake or reservoir surface", "Any source elevation mutation"], "review_html_rule": "Public HTML must be a real interactive WebGL2 view generated from numeric samples. Screenshots may exist only transiently for QA and must be deleted."}
    catalog = {"schema": "guilin-data-asset-catalog/v1", "status": "single_source", "canonical_release": CANONICAL_TAG, "assets": [{"role": "source_provenance", "file": RAW_NAME, "bytes": RAW_BYTES, "sha256": RAW_SHA256}, {"role": "native_numeric_elevation", "file_pattern": "native-r??-c??-2048x2048-i16.bin", "count": 54, "bytes_each": TILE_BYTES, "compression": "none"}, {"role": "accepted_aoi", "file": "AOI_ACCEPTED.geojson", "geometry_sha256": AOI_SHA256}, {"role": "immutable_linear_hydrology", "file": "OSM_HYDROLOGY_IMMUTABLE.geojson", "bytes": HYDRO_BYTES, "sha256": HYDRO_SHA256}], "duplicates_allowed": False}
    write_json(root / "contracts/CANONICAL_DEM_IDENTITY.json", identity)
    write_json(root / "contracts/PRODUCTION_RULES.json", rules)
    write_json(root / "contracts/DATA_ASSET_CATALOG.json", catalog)
    write_json(root / "knowledge/LANDMARK_INDEX.json", {"schema": "guilin-landmarks/v1", "items": list(ANCHORS), "anchor_tile_map": manifest["anchor_tile_map"]})
    write_json(root / "knowledge/NATIVE_TILE_INDEX.json", {"schema": "guilin-native-tile-index/v1", "tile_count": 54, "tiles": [{key: tile[key] for key in ("id", "matrix_index", "file", "sha256", "valid_grid", "source_cell_edge_bounds_epsg32649", "elevation_range_m")} for tile in manifest["tiles"]]})
    adjacency = []
    for row in range(9):
        for col in range(6):
            item = {"tile": f"native-r{row:02d}-c{col:02d}", "north": f"native-r{row-1:02d}-c{col:02d}" if row else None, "south": f"native-r{row+1:02d}-c{col:02d}" if row < 8 else None, "west": f"native-r{row:02d}-c{col-1:02d}" if col else None, "east": f"native-r{row:02d}-c{col+1:02d}" if col < 5 else None}
            adjacency.append(item)
    write_json(root / "knowledge/TILE_ADJACENCY_GRAPH.json", {"schema": "guilin-native-tile-adjacency/v1", "shared_edge_samples": 1, "horizontal_edges_verified": 45, "vertical_edges_verified": 48, "items": adjacency})
    hydro_knowledge = {"schema": "guilin-hydrology-knowledge/v1", "source_file": "truth/OSM_HYDROLOGY_IMMUTABLE.geojson", "source_sha256": HYDRO_SHA256, "source_centerlines_mutated": False, "aoi_clipped_linear_records": 931, "class_counts": {"river": 720, "stream": 174, "canal": 37}, "topology": {"source_node_count": 155462, "route_coverage_fraction": 1.0, "junction_count": 801, "li_display_component_count": 1, "xiang_exact_classification_bridge_osm_way": 140134340, "xiang_remaining_component_touches_aoi_east_boundary": True}, "waterbody_policy": {"lake_geometry_count": 0, "lake_surface_asset_emitted": False, "reservoir_surface_asset_emitted": False, "synthetic_surface_asset_emitted": False}, "use": "Knowledge and topology constraints only. Elevation remains the sole geometric terrain authority."}
    write_json(root / "knowledge/HYDROLOGY_KNOWLEDGE_ASSET.json", hydro_knowledge)
    readme = f"""# 小桂林 桂林 DEM 唯一真值\n\n本仓库的桂林生产线只承认一套地形真值：`{RAW_NAME}`，SHA256 `{RAW_SHA256}`，原生采样间距 12.5 米。\n\n54 块 `int16` 小端序高程瓦片逐文件保存在 Release `{CANONICAL_TAG}`，每块 8,388,608 字节，总计 {54*TILE_BYTES:,} 字节。文件保持未压缩、未重采样、未量化、未插值、未补洞，源高程改动为零。\n\n仓库保存真值身份、AOI、不可变线状水系、瓦片索引、邻接关系、拓扑知识、生产规则和直接数值几何审查器。所有旧桂林 DEM、旧程序地形路线、30 米预览、截图页面、压缩包、重复缓存和回滚资产均退出现行生产线。\n\n在线审查入口：{PUBLIC_URL}\n\n网页从原生数值样本生成位置与法线缓冲区，不使用高度图片贴图。\n"""
    (root / "README.md").write_text(readme, encoding="utf-8")
    (root / ".gitignore").write_text(".cache/\nout/\n__pycache__/\n*.pyc\n*.zip\n*.7z\n*.tar\n*.gz\n*.xz\n*.zst\n*.rar\n*.png\n*.jpg\n*.jpeg\n*.webp\n", encoding="utf-8")
    write_json(args.evidence / "ASSET_VALIDATION.json", validation)
    forbidden = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        lower = path.relative_to(root).as_posix().lower()
        if any(token in lower for token in ("guilin-v0", "terrain_2048", "heightmap", "archive", "legacy", "preview")):
            forbidden.append(lower)
        if path.suffix.lower() in {".bin", ".tif", ".tiff", ".zip", ".7z", ".tar", ".gz", ".xz", ".png", ".jpg", ".jpeg", ".webp"}:
            forbidden.append(lower)
    if forbidden:
        raise RuntimeError(f"forbidden clean-root files: {sorted(set(forbidden))}")
    app = (root / "viewer/app.js").read_text(encoding="utf-8")
    if any(token in app for token in ("createTexture", "texImage2D", "texSubImage2D", "sampler2D")):
        raise RuntimeError("texture terrain API detected")
    write_json(args.evidence / "CLEAN_ROOT_VALIDATION.json", {"schema": "guilin-clean-root-validation/v1", "passed": True, "file_count": sum(1 for path in root.rglob("*") if path.is_file()), "forbidden_files": [], "height_texture_api": False, "sole_authoritative_dem": True})
    print(json.dumps(validation, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
