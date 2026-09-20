#!/usr/bin/env python3
"""Reconcile NOAA NOS hydrographic discovery and NCEI multibeam track coverage.

This postprocessor is deliberately conservative: discovery footprints and tracklines
are preserved as evidence metadata, but are not converted into depth constraints
unless actual depth samples and their datum are available.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import nearest_points, transform

CORE = [134.535, 7.315, 134.605, 7.385]
CONTEXT = [134.49, 7.27, 134.64, 7.42]
ANCHOR = [134.5667427743189, 7.349032638038719]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--intake", type=Path, required=True)
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()

    args.results.mkdir(parents=True, exist_ok=True)
    (args.results / "vectors").mkdir(parents=True, exist_ok=True)

    core = box(*CORE)
    context = box(*CONTEXT)
    anchor = Point(*ANCHOR)
    to_m = Transformer.from_crs("EPSG:4326", "EPSG:32653", always_xy=True).transform
    anchor_m = transform(to_m, anchor)

    layer_counts: dict[str, int] = {}
    for layer in (0, 1, 2):
        path = args.intake / f"metadata/noaa_surveys/nos_hydro_layer_{layer}.geojson"
        doc = load_json(path) if path.exists() else {"features": []}
        layer_counts[str(layer)] = len(doc.get("features", []))

    multibeam_path = args.intake / "metadata/noaa_surveys/multibeam.geojson"
    multibeam = load_json(multibeam_path) if multibeam_path.exists() else {"features": []}

    surveys: list[dict] = []
    clips: list[dict] = []
    for feature in multibeam.get("features", []):
        geom = shape(feature["geometry"])
        props = feature.get("properties", {})
        core_clip = geom.intersection(core)
        context_clip = geom.intersection(context)
        geom_m = transform(to_m, geom)
        nearest = nearest_points(geom_m, anchor_m)[0]
        core_clip_m = transform(to_m, core_clip) if not core_clip.is_empty else core_clip
        context_clip_m = transform(to_m, context_clip) if not context_clip.is_empty else context_clip

        item = {
            "survey_id": props.get("SURVEY_ID"),
            "survey_year": props.get("SURVEY_YEAR"),
            "platform": props.get("PLATFORM"),
            "instrument": props.get("INSTRUMENT"),
            "source": props.get("SOURCE"),
            "download_url": props.get("DOWNLOAD_URL"),
            "track_length_source_field": props.get("TRACK_LENGTH"),
            "file_count": props.get("FILE_COUNT"),
            "context_clip_length_m": round(context_clip_m.length, 1) if not context_clip.is_empty else 0.0,
            "core_clip_length_m": round(core_clip_m.length, 1) if not core_clip.is_empty else 0.0,
            "nearest_to_story_anchor_m": round(nearest.distance(anchor_m), 1),
            "intersects_core": bool(not core_clip.is_empty and core_clip_m.length > 0),
        }
        item["reef_interior_constraint_status"] = (
            "TRACKLINE_CONTEXT_ONLY" if item["intersects_core"] else "OUTSIDE_CORE"
        )
        surveys.append(item)
        if item["intersects_core"]:
            clips.append({"type": "Feature", "properties": item, "geometry": mapping(core_clip)})

    core_clip_total = sum(item["core_clip_length_m"] for item in surveys)
    report = {
        "schema": "kaopu.palau.noaa-survey-coverage-r03/1.0",
        "coreBBoxWGS84": CORE,
        "contextBBoxWGS84": CONTEXT,
        "storyAnchorWGS84": ANCHOR,
        "noaaNOSTrackCoverage": {
            "layer0_BAG_feature_count": layer_counts["0"],
            "layer1_digital_sounding_feature_count": layer_counts["1"],
            "layer2_no_digital_sounding_feature_count": layer_counts["2"],
            "interpretation": (
                "The NOAA NOS Hydrographic Survey ArcGIS service returned no survey polygons in this Airai "
                "context query. This does not negate the ENC M_QUAL lineage for the 2004 U.S. Navy LIDAR "
                "survey; those are separate source/discovery systems."
            ),
        },
        "noaaNCEIMultibeam": {
            "context_discovered_track_count": len(surveys),
            "core_intersecting_track_count": sum(1 for item in surveys if item["intersects_core"]),
            "core_total_trackline_length_m": round(core_clip_total, 1),
            "survey_tracks": surveys,
            "interpretation": (
                "NCEI multibeam discovery is trackline context, not a reef-interior surface. Only clipped track "
                "geometry is preserved; no raw multibeam depths are fused into the candidate grid in R03."
            ),
        },
        "constraintBoundary": {
            "usedInCandidateDepthGrid": False,
            "reason": (
                "No NOS hydrographic-survey polygon/BAG coverage was discovered in the context service, and the "
                "only multibeam core overlap is trackline geometry without extracted depth samples. Existing ENC "
                "SOUNDG/DEPCNT plus M_QUAL remain the current measured constraints."
            ),
        },
        "verticalDatumBoundary": (
            "No vertical-datum conversion is performed by this postprocessor. Multibeam track discovery has no "
            "usable depth datum here; ENC depth datum remains separate and unresolved as recorded in the main "
            "evidence report."
        ),
    }

    (args.results / "NOAA_SURVEY_COVERAGE_R03.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    feature_collection = {
        "type": "FeatureCollection",
        "name": "NOAA_MULTIBEAM_CORE_CLIPS_R03",
        "features": clips,
    }
    (args.results / "vectors" / "NOAA_MULTIBEAM_CORE_CLIPS_R03.geojson").write_text(
        json.dumps(feature_collection, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    evidence_report = args.results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if evidence_report.exists():
        main_report = load_json(evidence_report)
        main_report["noaaSurveyCoverageR03"] = report
        evidence_report.write_text(
            json.dumps(main_report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    print(
        json.dumps(
            {
                "nos_layer_counts": layer_counts,
                "multibeam_tracks": len(surveys),
                "core_tracks": sum(1 for item in surveys if item["intersects_core"]),
                "core_length_m": round(core_clip_total, 1),
                "core_ids": [item["survey_id"] for item in surveys if item["intersects_core"]],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
