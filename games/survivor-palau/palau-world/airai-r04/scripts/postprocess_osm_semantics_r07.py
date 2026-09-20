#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import transform

CONTEXT = [134.49, 7.27, 134.64, 7.42]
CORE = [134.535, 7.315, 134.605, 7.385]
ANCHOR = [134.5667427743189, 7.349032638038719]
OSM_LAYERS = ["points", "lines", "multilinestrings", "multipolygons"]
HSTORE_RE = re.compile(r'"((?:[^"\\]|\\.)*)"=>"((?:[^"\\]|\\.)*)"')


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def decode_hstore(value) -> dict[str, str]:
    if not isinstance(value, str):
        return {}
    out: dict[str, str] = {}
    for k, v in HSTORE_RE.findall(value):
        out[k.replace(r'\"', '"').replace(r'\\', '\\')] = v.replace(r'\"', '"').replace(r'\\', '\\')
    return out


def tags_from_properties(props: dict) -> dict[str, str]:
    tags: dict[str, str] = {}
    for key, value in (props or {}).items():
        if value is None or key in ("other_tags", "all_tags"):
            continue
        tags[str(key)] = str(value)
    tags.update(decode_hstore((props or {}).get("other_tags")))
    tags.update(decode_hstore((props or {}).get("all_tags")))
    return tags


def semantic_role(tags: dict[str, str]) -> str | None:
    natural = tags.get("natural", "")
    wetland = tags.get("wetland", "")
    place = tags.get("place", "")
    if natural == "reef" or tags.get("reef") or tags.get("seamark:sea_area:category") == "reef":
        return "reef"
    if natural == "coastline":
        return "coastline"
    if wetland == "mangrove" or natural == "mangrove":
        return "mangrove"
    if natural == "wetland" and wetland == "tidalflat":
        return "tidalflat"
    if natural == "shoal":
        return "shoal"
    if natural == "beach":
        return "beach"
    if place in ("island", "islet"):
        return place
    return None


def extract_layer(pbf: Path, layer: str, out: Path) -> tuple[bool, str]:
    cmd = [
        "ogr2ogr", "-f", "GeoJSON",
        "-spat", *(str(v) for v in CONTEXT),
        "-lco", "RFC7946=YES",
        "-skipfailures",
        str(out), str(pbf), layer,
    ]
    proc = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return proc.returncode == 0 and out.exists(), proc.stderr.strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--intake", type=Path, required=True)
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()

    intake = args.intake.resolve()
    results = args.results.resolve()
    results.mkdir(parents=True, exist_ok=True)
    pbf = intake / "raw/osm/palau-latest.osm.pbf"
    if not pbf.exists() or pbf.stat().st_size == 0:
        raise SystemExit(f"OSM PBF missing: {pbf}")

    core_geom = box(*CORE)
    context_geom = box(*CONTEXT)
    metric = Transformer.from_crs("EPSG:4326", "EPSG:32653", always_xy=True)
    anchor_metric = transform(metric.transform, Point(*ANCHOR))

    context_counts: Counter[str] = Counter()
    core_counts: Counter[str] = Counter()
    core_area_m2: defaultdict[str, float] = defaultdict(float)
    core_length_m: defaultdict[str, float] = defaultdict(float)
    nearest_m: dict[str, float] = {}
    layer_raw_counts: Counter[str] = Counter()
    extraction_errors: dict[str, str] = {}
    core_features: list[dict] = []

    with tempfile.TemporaryDirectory(prefix="airai-osm-r07-") as td:
        td = Path(td)
        for layer in OSM_LAYERS:
            out = td / f"{layer}.geojson"
            ok, err = extract_layer(pbf, layer, out)
            if not ok:
                extraction_errors[layer] = err[-2000:]
                continue
            doc = json.loads(out.read_text(encoding="utf-8"))
            feats = doc.get("features", [])
            layer_raw_counts[layer] = len(feats)
            for feat in feats:
                geom_obj = feat.get("geometry")
                if not geom_obj:
                    continue
                try:
                    geom = shape(geom_obj)
                except Exception:
                    continue
                if geom.is_empty or not geom.is_valid:
                    try:
                        geom = geom.buffer(0)
                    except Exception:
                        continue
                if geom.is_empty or not geom.intersects(context_geom):
                    continue
                props = feat.get("properties") or {}
                tags = tags_from_properties(props)
                role = semantic_role(tags)
                if role is None:
                    continue
                context_counts[role] += 1
                try:
                    g_metric = transform(metric.transform, geom)
                    d = float(g_metric.distance(anchor_metric))
                    nearest_m[role] = min(nearest_m.get(role, d), d)
                except Exception:
                    pass
                if not geom.intersects(core_geom):
                    continue
                core_counts[role] += 1
                clipped = geom.intersection(core_geom)
                if clipped.is_empty:
                    continue
                try:
                    cm = transform(metric.transform, clipped)
                    core_area_m2[role] += float(cm.area)
                    core_length_m[role] += float(cm.length)
                except Exception:
                    pass
                keep = {
                    "osm_id": props.get("osm_id") or props.get("osm_way_id"),
                    "name": tags.get("name"),
                    "semanticRole": role,
                    "natural": tags.get("natural"),
                    "reef": tags.get("reef"),
                    "wetland": tags.get("wetland"),
                    "tidal": tags.get("tidal"),
                    "place": tags.get("place"),
                    "sourceLayer": layer,
                }
                core_features.append({"type": "Feature", "properties": keep, "geometry": mapping(clipped)})

    ordered_roles = ["reef", "coastline", "mangrove", "tidalflat", "shoal", "beach", "island", "islet"]
    summary_rows = []
    for role in ordered_roles:
        summary_rows.append({
            "semanticRole": role,
            "contextFeatureCount": int(context_counts.get(role, 0)),
            "coreFeatureCount": int(core_counts.get(role, 0)),
            "coreClippedAreaKm2": round(core_area_m2.get(role, 0.0) / 1e6, 6),
            "coreClippedBoundaryLengthKm": round(core_length_m.get(role, 0.0) / 1000.0, 6),
            "nearestFeatureToAnchorM": round(nearest_m[role], 3) if role in nearest_m else None,
        })

    report = {
        "schema": "kaopu.palau.osm-reef-coast-mangrove-r07/1.0",
        "contextBBoxWGS84": CONTEXT,
        "coreBBoxWGS84": CORE,
        "userConfirmedAnchorWGS84": ANCHOR,
        "source": {
            "provider": "Geofabrik OpenStreetMap extract",
            "file": "raw/osm/palau-latest.osm.pbf",
            "sha256": sha256(pbf),
            "license": "OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0",
            "extraction": "GDAL/OGR OSM driver; spatially clipped to the Airai context/core boxes",
            "sourceIdentityRule": "OSM community mapping is retained as semantic/cartographic evidence, not hydrographic survey truth.",
        },
        "rawLayerFeatureCountsInContext": dict(layer_raw_counts),
        "extractionErrors": extraction_errors,
        "semanticSummary": summary_rows,
        "coreDerivedFeatureCount": len(core_features),
        "tagRules": {
            "reef": "natural=reef OR reef=* OR seamark:sea_area:category=reef",
            "coastline": "natural=coastline",
            "mangrove": "natural=wetland + wetland=mangrove, or legacy natural=mangrove",
            "supporting": ["natural=wetland + wetland=tidalflat", "natural=shoal", "natural=beach", "place=island", "place=islet"],
        },
        "methodBoundary": {
            "validRole": "OSM helps preserve mapped coast/island/mangrove/reef semantics and provides an independent cartographic cross-check against Allen Coral Atlas and optical imagery.",
            "notDepthTruth": "OSM reef/coast/mangrove tags do not supply measured bathymetry and must not create or cap water depth.",
            "coastlineDatumCaution": "OSM natural=coastline represents the mapped shoreline convention and is not silently treated as the same vertical datum as ENC sounding/chart datum.",
            "coverageCaution": "Missing OSM tags mean unmapped/unknown, not evidence that reef or mangrove is absent.",
        },
        "candidateGridMutation": False,
        "candidateGridReason": "R07 is a semantic and shoreline evidence layer only. It does not modify the candidate bathymetry grid.",
        "palauWorldContract": "OSM semantics may gate labels, land/water/reef semantic masks and provenance inside the same PalauWorld.sample() conductor; they do not create a separate LOD world.",
    }

    write_json(results / "OSM_SEMANTICS_R07.json", report)
    write_json(results / "vectors/OSM_SEMANTICS_CORE_R07.geojson", {
        "type": "FeatureCollection",
        "name": "OSM_SEMANTICS_CORE_R07",
        "attribution": "© OpenStreetMap contributors, ODbL 1.0",
        "features": core_features,
    })
    csvp = results / "tables/OSM_SEMANTICS_R07.csv"
    csvp.parent.mkdir(parents=True, exist_ok=True)
    with csvp.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(summary_rows[0].keys()))
        w.writeheader()
        w.writerows(summary_rows)

    ep = results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if ep.exists():
        evidence = json.loads(ep.read_text(encoding="utf-8"))
        evidence["osmSemanticsR07"] = report
        write_json(ep, evidence)

    ip = results / "index.html"
    if ip.exists():
        html = ip.read_text(encoding="utf-8")
        section = (
            "<section><h2>OSM R07 礁盘 / 岸线 / 红树林语义</h2><pre>" +
            json.dumps({"summary": summary_rows, "coreDerivedFeatures": len(core_features)}, ensure_ascii=False, indent=2) +
            "</pre><p>OSM 在这一层只作为独立语义与岸线交叉证据；缺少标注不等于不存在，也不作为测深真值。© OpenStreetMap contributors, ODbL 1.0。</p></section>"
        )
        if "OSM R07 礁盘 / 岸线 / 红树林语义" not in html:
            html = html.replace("</main>", section + "\n</main>")
            ip.write_text(html, encoding="utf-8")

    print(json.dumps({"osmSha256": sha256(pbf), "summary": summary_rows, "coreDerivedFeatures": len(core_features), "errors": extraction_errors}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
