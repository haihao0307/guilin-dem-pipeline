#!/usr/bin/env python3
"""R08: reconcile measured ENC soundings with Allen reef geomorphology, DEPARE and OSM semantics.

This stage tests the user's reef-interior working hypothesis without forcing it into the data.
Allen/OSM are semantic evidence only; NOAA ENC SOUNDG remains the measured depth evidence.
No vertical-datum conversion is attempted because the ENC chart datum remains unresolved.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import rasterize
from shapely.geometry import box

CORE = [134.535, 7.315, 134.605, 7.385]
CORE_POLY = box(*CORE)
NODATA_CLASS = 0

ZONE_CODE = {
    "outside_allen_geomorphic_or_unclassified": 1,
    "reef_flat_or_crest": 2,
    "shallow_lagoon": 3,
    "deep_lagoon": 4,
    "reef_slope": 5,
    "plateau": 6,
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load(path: Path) -> gpd.GeoDataFrame:
    g = gpd.read_file(path)
    if g.crs is None:
        g = g.set_crs(4326)
    else:
        g = g.to_crs(4326)
    return g


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def classify_geomorphic(name) -> str:
    if name is None or pd.isna(name):
        return "outside_allen_geomorphic_or_unclassified"
    s = str(name).strip().lower()
    if "reef flat" in s or "reef crest" in s:
        return "reef_flat_or_crest"
    if s == "shallow lagoon":
        return "shallow_lagoon"
    if s == "deep lagoon":
        return "deep_lagoon"
    if "reef slope" in s:
        return "reef_slope"
    if s == "plateau":
        return "plateau"
    return "outside_allen_geomorphic_or_unclassified"


def depth_stats(series) -> dict:
    a = pd.to_numeric(series, errors="coerce").to_numpy(float)
    a = a[np.isfinite(a)]
    if not len(a):
        return {
            "count": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None,
            "between60And70M": 0, "deeperThan100M": 0,
        }
    return {
        "count": int(len(a)),
        "min": float(np.min(a)),
        "p05": float(np.percentile(a, 5)),
        "median": float(np.median(a)),
        "p95": float(np.percentile(a, 95)),
        "max": float(np.max(a)),
        "between60And70M": int(((a >= 60) & (a <= 70)).sum()),
        "deeperThan100M": int((a > 100).sum()),
    }


def pick_depare_columns(g: gpd.GeoDataFrame) -> tuple[str | None, str | None]:
    cols = {c.upper(): c for c in g.columns}
    lo = cols.get("DRVAL1") or cols.get("VALSOU")
    hi = cols.get("DRVAL2")
    return lo, hi


def join_single(points: gpd.GeoDataFrame, polygons: gpd.GeoDataFrame, fields: list[str], prefix: str) -> gpd.GeoDataFrame:
    if polygons.empty:
        for f in fields:
            points[prefix + f] = None
        return points
    keep = [f for f in fields if f in polygons.columns] + [polygons.geometry.name]
    p = polygons[keep].copy()
    p = p.rename(columns={f: prefix + f for f in keep if f != polygons.geometry.name})
    out = gpd.sjoin(points, p, how="left", predicate="intersects")
    if "index_right" in out.columns:
        out = (
            out.sort_values(["_sound_id", "index_right"], kind="stable")
            .drop_duplicates("_sound_id", keep="first")
            .drop(columns=["index_right"], errors="ignore")
        )
    return gpd.GeoDataFrame(out, geometry="geometry", crs=4326)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()
    results = args.results.resolve()
    vectors = results / "vectors"
    grids = results / "grids"

    sound_path = vectors / "SOUNDG_QUALITY_JOINED.geojson"
    allen_path = vectors / "ALLEN_GEOMORPHIC_CORE_R05.geojson"
    depare_path = vectors / "DEPARE.geojson"
    osm_path = vectors / "OSM_SEMANTICS_CORE_R07.geojson"
    depth_grid = grids / "candidate_depth_chart_datum_m_r02.tif"
    for required in (sound_path, allen_path, depare_path, osm_path, depth_grid):
        if not required.exists():
            raise SystemExit(f"R08 required input missing: {required}")

    snd = load(sound_path)
    snd = snd[snd.intersects(CORE_POLY)].copy().reset_index(drop=True)
    if "_sound_id" not in snd.columns:
        snd["_sound_id"] = np.arange(len(snd), dtype=int)

    allen = load(allen_path)
    snd = join_single(snd, allen, ["class_name"], "ALLEN_")
    allen_class = snd.get("ALLEN_class_name", pd.Series(index=snd.index, dtype=object))
    snd["semantic_zone"] = allen_class.map(classify_geomorphic)
    snd["allen_mapped"] = allen_class.notna()

    depare = load(depare_path)
    depare = depare[depare.intersects(CORE_POLY)].copy()
    dlo, dhi = pick_depare_columns(depare)
    dfields = [c for c in (dlo, dhi, "_enc_cell", "VERDAT") if c and c in depare.columns]
    snd = join_single(snd, depare, dfields, "DEPARE_")

    osm = load(osm_path)
    osm_role = osm.get("semanticRole", pd.Series(index=osm.index, dtype=object)).astype(str)
    osm_reef = osm[osm_role.eq("reef")].copy()
    osm_reef = osm_reef[osm_reef.geometry.geom_type.isin({"Polygon", "MultiPolygon"})]
    if len(osm_reef):
        reef_union = osm_reef.geometry.union_all() if hasattr(osm_reef.geometry, "union_all") else osm_reef.geometry.unary_union
        snd["inside_osm_reef_polygon"] = snd.geometry.intersects(reef_union)
    else:
        snd["inside_osm_reef_polygon"] = False

    depth = pd.to_numeric(snd["depth_m"], errors="coerce")
    snd["working_hypothesis_60_70"] = (depth >= 60) & (depth <= 70)
    snd["working_hypothesis_gt100"] = depth > 100

    zone_summary = {}
    for zone in ZONE_CODE:
        grp = snd[snd["semantic_zone"] == zone]
        by_zoc = {}
        if "zoc_label" in grp.columns:
            for zoc, zgrp in grp.groupby("zoc_label", dropna=False):
                by_zoc[str(zoc)] = depth_stats(zgrp["depth_m"])
        zone_summary[zone] = {
            "allenClassCounts": {
                str(k): int(v)
                for k, v in grp.get("ALLEN_class_name", pd.Series(dtype=object)).fillna("UNMAPPED").astype(str).value_counts().items()
            },
            "depthStatsM": depth_stats(grp["depth_m"]),
            "catzocCounts": {
                str(k): int(v)
                for k, v in grp.get("zoc_label", pd.Series(dtype=object)).fillna("UNQUALIFIED").astype(str).value_counts().items()
            },
            "byCATZOC": by_zoc,
            "insideOsmReefPolygon": int(grp["inside_osm_reef_polygon"].sum()),
        }

    zoc = snd.get("zoc_label", pd.Series(index=snd.index, dtype=object)).astype(str)
    high_quality = snd[zoc.isin(["A1", "A2", "B"])].copy()
    allen_mapped_hq = high_quality[high_quality["allen_mapped"]].copy()
    unmapped_hq = high_quality[~high_quality["allen_mapped"]].copy()

    # Rasterize semantic zones on the exact R02 grid geometry. This is a traceability
    # companion grid only; it never overwrites depth. R02 NoData stays NoData here too.
    with rasterio.open(depth_grid) as src:
        profile = src.profile.copy()
        h, w, transform = src.height, src.width, src.transform
        target_crs = src.crs
        depth_arr = src.read(1)
        depth_nodata = src.nodata
    valid_depth = np.isfinite(depth_arr)
    if depth_nodata is not None:
        valid_depth &= depth_arr != depth_nodata

    allen_grid = allen.to_crs(target_crs)
    shapes = []
    for _, row in allen_grid.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        code = ZONE_CODE[classify_geomorphic(row.get("class_name"))]
        shapes.append((geom, code))
    arr = rasterize(
        shapes,
        out_shape=(h, w),
        transform=transform,
        fill=ZONE_CODE["outside_allen_geomorphic_or_unclassified"],
        dtype="uint8",
    )
    arr[~valid_depth] = NODATA_CLASS
    profile.update(dtype="uint8", count=1, nodata=NODATA_CLASS, compress="deflate")
    zone_grid = grids / "candidate_semantic_zone_r08.tif"
    with rasterio.open(zone_grid, "w", **profile) as dst:
        dst.write(arr, 1)
        dst.update_tags(
            WORLD_STATUS="SEMANTIC_TRACEABILITY_COMPANION_NOT_DEPTH_TRUTH",
            SOURCE="Allen Coral Atlas geomorphic R05 aligned to ENC candidate grid",
            VERTICAL_DATUM="N/A_SEMANTIC_ONLY",
            ZONE_CODES=json.dumps(ZONE_CODE, sort_keys=True),
            OUTSIDE_ALLEN_CAUTION="code 1 means not classified by Allen shallow geomorphology, not necessarily water or reef interior",
        )

    out_path = vectors / "SOUNDG_REEF_ZONE_JOINED_R08.geojson"
    snd.to_file(out_path, driver="GeoJSON")
    tab = snd.drop(columns="geometry").copy()
    tab["lon"] = snd.geometry.x
    tab["lat"] = snd.geometry.y
    csv_path = results / "tables/SOUNDG_REEF_ZONE_JOINED_R08.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    tab.to_csv(csv_path, index=False)

    vertical_counts = Counter(str(v) for v in snd.get("QUAL_VERDAT", pd.Series(dtype=object)).dropna().astype(str))
    depare_verdat_col = "DEPARE_VERDAT" if "DEPARE_VERDAT" in snd.columns else None
    depare_vertical_counts = (
        Counter(str(v) for v in snd.get(depare_verdat_col, pd.Series(dtype=object)).dropna().astype(str))
        if depare_verdat_col else Counter()
    )

    hq_stats = depth_stats(high_quality["depth_m"])
    mapped_hq_stats = depth_stats(allen_mapped_hq["depth_m"])
    unmapped_hq_stats = depth_stats(unmapped_hq["depth_m"])
    report = {
        "schema": "kaopu.palau.reef-interior-zone-reconciliation-r08/1.1",
        "coreBBoxWGS84": CORE,
        "sourceIdentity": {
            "soundings": {
                "path": str(sound_path.relative_to(results)), "sha256": sha256(sound_path),
                "role": "measured ENC sounding evidence with M_QUAL lineage",
            },
            "allenGeomorphic": {
                "path": str(allen_path.relative_to(results)), "sha256": sha256(allen_path),
                "role": "shallow geomorphic semantic evidence, not depth truth",
            },
            "depare": {
                "path": str(depare_path.relative_to(results)), "sha256": sha256(depare_path),
                "role": "ENC charted depth-area context",
            },
            "osm": {
                "path": str(osm_path.relative_to(results)), "sha256": sha256(osm_path),
                "role": "independent community semantic cross-check, not hydrographic truth",
            },
        },
        "verticalDatum": {
            "status": "UNRESOLVED_NO_CONVERSION_APPLIED",
            "soundingVERDATCounts": dict(vertical_counts),
            "depareVERDATCounts": dict(depare_vertical_counts),
            "rule": "R08 preserves encoded ENC vertical-datum fields and does not numerically transform depths between datums.",
        },
        "coreSoundings": int(len(snd)),
        "allenMappedSoundings": int(snd["allen_mapped"].sum()),
        "zoneSummary": zone_summary,
        "workingHypothesisAudit": {
            "hypothesis": "major channels about 60-70 m and reef-interior water generally below 100 m depth",
            "allHighQualityCATZOC_A1_A2_B": hq_stats,
            "highQualityInsideAllenShallowGeomorphicCoverage": mapped_hq_stats,
            "highQualityOutsideAllenShallowGeomorphicCoverage": unmapped_hq_stats,
            "interpretationRule": "Allen shallow geomorphic coverage cannot define the full reef interior; >100 m soundings outside Allen coverage are not automatically reef-interior contradictions.",
            "forcedToHypothesis": False,
        },
        "candidateGrid": {
            "depthGridUnchanged": "grids/candidate_depth_chart_datum_m_r02.tif",
            "uncertaintyGridUnchanged": "grids/candidate_uncertainty_m_r02.tif",
            "nearestEvidenceGridUnchanged": "grids/nearest_evidence_distance_m_r02.tif",
            "semanticCompanionGrid": "grids/candidate_semantic_zone_r08.tif",
            "semanticZoneCodes": ZONE_CODE,
            "candidateGridMutation": False,
            "reason": "R08 improves traceability and hypothesis testing without inventing depth from habitat/OSM semantics.",
        },
        "palauWorldContract": "R08 semantic zones and provenance are companion evidence for the same PalauWorld.sample() conductor; no separate LOD world is introduced.",
    }
    write_json(results / "REEF_INTERIOR_HYPOTHESIS_R08.json", report)

    ep = results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if ep.exists():
        evidence = json.loads(ep.read_text(encoding="utf-8"))
        evidence["reefInteriorR08"] = report
        write_json(ep, evidence)

    ip = results / "index.html"
    if ip.exists():
        html = ip.read_text(encoding="utf-8")
        marker = "REEF_INTERIOR_R08"
        if marker not in html:
            section = (
                f'<!-- {marker} --><section><h2>R08 礁盘内部证据分区</h2>'
                f'<p>Core SOUNDG: {len(snd)} · Allen-mapped soundings: {int(snd["allen_mapped"].sum())}. '
                f'高质量 A1/A2/B 测深：60–70 m={hq_stats["between60And70M"]}，&gt;100 m={hq_stats["deeperThan100M"]}。</p>'
                '<p>Allen/OSM 只提供语义边界；没有把浅水地貌强制转换为深度，也没有改变 R02 水深/不确定度/最近证据距离栅格。R08 新增同网格语义分区用于 PalauWorld.sample() 的证据追踪。</p></section>'
            )
            html = html.replace("</main>", section + "\n</main>") if "</main>" in html else html.replace("</body>", section + "\n</body>")
            ip.write_text(html, encoding="utf-8")

    print(json.dumps({
        "coreSoundings": len(snd),
        "allenMappedSoundings": int(snd["allen_mapped"].sum()),
        "highQuality": hq_stats,
        "highQualityAllenMapped": mapped_hq_stats,
        "highQualityOutsideAllen": unmapped_hq_stats,
        "zoneGrid": str(zone_grid),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
