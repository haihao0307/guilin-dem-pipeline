from __future__ import annotations

import re
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex replacement, found {count}")
    return updated


def patch_builder() -> None:
    path = Path("pipeline/build_online_assets.py")
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "from shapely.ops import transform as shapely_transform\n",
        "from shapely.ops import transform as shapely_transform\n\nfrom hydrology_network_v6 import orient_network\n",
        "network import",
    )
    text = replace_once(
        text,
        '    1: ("漓江", "漓水", "li river", "li jiang", "lijiang river", "li-jiang"),',
        '    1: ("漓江", "漓水", "桂江", "桂水", "li river", "li jiang", "lijiang river", "li-jiang", "gui river", "gui jiang", "guijiang"),',
        "Li aliases",
    )
    text = replace_once(
        text,
        'FLOW_STYLE_PROFILE = "longitudinal-flow-taper-v4"\nMAINSTEM_PROGRESS_ELEVATION_WEIGHT = 0.58\nMAINSTEM_PROGRESS_ACCUMULATION_WEIGHT = 0.42\n',
        'FLOW_STYLE_PROFILE = "network-directed-physical-width-v6"\n',
        "style profile",
    )
    text = regex_once(
        text,
        r"def mainstem_code\(properties: dict\[str, Any\]\) -> int:\n.*?\n    return 0\n\n\ndef node_rank",
        '''def mainstem_code(properties: dict[str, Any]) -> int:
    system = str(properties.get("system") or "").strip().lower()
    if system in {"li", "lijiang", "li-jiang", "guijiang", "gui-jiang"}:
        return 1
    if system in {"xiang", "xiangjiang", "xiang-jiang"}:
        return 2
    if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
        return 3
    values = {normalize_river_name(value) for value in feature_name_values(properties)}
    for code, patterns in MAJOR_MAINSTEM_PATTERNS.items():
        aliases = {normalize_river_name(pattern) for pattern in patterns}
        if values.intersection(aliases):
            return code
    marker = str(properties.get("mainstem") or properties.get("is_mainstem") or "").strip().lower()
    if marker in {"1", "true", "yes", "main", "mainstem"}:
        if system in {"li", "lijiang", "li-jiang", "guijiang", "gui-jiang"}:
            return 1
        if system in {"xiang", "xiangjiang", "xiang-jiang"}:
            return 2
        if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
            return 3
    return 0


def node_rank''',
        "mainstem classifier",
    )
    text = replace_once(
        text,
        '''        source_width = parse_width(properties, waterway)
        major_code = mainstem_code(properties) if waterway == "river" else 0
        name_blob = feature_name_blob(properties)
''',
        '''        source_width = parse_width(properties, waterway)
        source_system = str(properties.get("system") or "").strip().lower()
        major_code = mainstem_code(properties) if waterway == "river" else 0
        name_blob = feature_name_blob(properties)
''',
        "feature system",
    )
    text = replace_once(
        text,
        '''                    "source_width_m": source_width,
                    "major_code": major_code,
''',
        '''                    "source_width_m": source_width,
                    "major_code": major_code,
                    "system": source_system,
                    "name_blob": name_blob,
                    "osm_id": properties.get("osm_id"),
''',
        "segment lineage",
    )
    text = regex_once(
        text,
        r"    outgoing: dict\[tuple\[float, float\], list\[int\]\] = \{\}\n.*?\n    uphill_segment_count = sum\(",
        '''    directed_edges, network_diagnostics = orient_network(
        raw_segments,
        valid_node_data,
        (west, south, east, north),
    )

    uphill_segment_count = sum(''',
        "network orientation block",
    )
    text = replace_once(
        text,
        '''    if uphill_segment_count or flow_progress_inversion_count or flow_distance_inversion_count:
        raise RuntimeError(
            "invalid upstream/downstream contract: "
            f"uphill={uphill_segment_count}, progress={flow_progress_inversion_count}, "
            f"distance={flow_distance_inversion_count}"
        )
''',
        '''    if flow_progress_inversion_count or flow_distance_inversion_count:
        raise RuntimeError(
            "invalid upstream/downstream network contract: "
            f"progress={flow_progress_inversion_count}, distance={flow_distance_inversion_count}"
        )
''',
        "orientation validation",
    )
    text = replace_once(
        text,
        '''            "mainstem_names": ["漓江", "湘江", "资江"],
            "mainstem_aliases": {"zi": ["夫夷水", "夫夷江", "Fuyi River"]},
''',
        '''            "mainstem_names": ["漓江及桂江连续干流", "湘江", "资江"],
            "mainstem_aliases": {
                "li": ["漓江", "桂江", "Li River", "Gui River"],
                "zi": ["夫夷水", "夫夷江", "Fuyi River"],
            },
''',
        "mainstem labels",
    )
    text = replace_once(
        text,
        '''            "progress_basis": "native-DEM descent blended with upstream network accumulation",
            "gradient_direction": "upstream-light-and-thin_to_downstream-dark-and-wide",
            "upstream_mainstem_width_equivalent": "minor-stream-scale",
            "downstream_mainstem_width_uses_source_width": True,
            "mainstem_classification": "exact-match-on-individual-OSM-name-values",
''',
        '''            "progress_basis": "connected mainstem distance to verified network outlet",
            "gradient_direction": "upstream-light-and-thin_to_downstream-dark-and-wide",
            "upstream_mainstem_width_equivalent": "headwater-scale-derived-from-source-width",
            "downstream_mainstem_width_uses_source_width": True,
            "width_mode": "source-width-meters-projected-to-screen",
            "mainstem_classification": "source-system plus exact OSM name aliases",
            "li_gui_continuation_segment_count": network_diagnostics["li_gui_continuation_segment_count"],
            "li_south_of_yangshuo_segment_count": network_diagnostics["li_south_of_yangshuo_segment_count"],
            "li_min_northing_m": network_diagnostics["li_min_northing_m"],
            "li_reaches_aoi_south_boundary": network_diagnostics["li_reaches_aoi_south_boundary"],
            "mainstem_component_counts": network_diagnostics["mainstem_component_counts"],
''',
        "styling diagnostics",
    )
    text = replace_once(
        text,
        '''            "orientation_method": "native-DEM-descending-rank",
''',
        '''            "orientation_method": network_diagnostics["orientation_method"],
            "general_component_count": network_diagnostics["general_component_count"],
            "general_outlet_count": network_diagnostics["general_outlet_count"],
            "distance_tie_segment_count": network_diagnostics["distance_tie_segment_count"],
            "li_continuity_verified_south_of_yangshuo": True,
''',
        "direction manifest",
    )
    text = replace_once(
        text,
        '''            "uphill_segment_count": uphill_segment_count,
''',
        '''            "local_dem_uphill_segment_count": uphill_segment_count,
            "uphill_segment_count": uphill_segment_count,
''',
        "uphill diagnostic",
    )
    path.write_text(text, encoding="utf-8")


def patch_workflow_import() -> None:
    path = Path(".github/workflows/guilin-online-full-map.yml")
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '''            pipeline/build_online_assets.py \\
            pipeline/distill_online_runtime.py \\
''',
        '''            pipeline/build_online_assets.py \\
            pipeline/hydrology_network_v6.py \\
            pipeline/distill_online_runtime.py \\
''',
        "workflow compile module",
    )
    text = text.replace("longitudinal-flow-taper-v4", "network-directed-physical-width-v6")
    path.write_text(text, encoding="utf-8")


def main() -> int:
    patch_builder()
    patch_workflow_import()
    print("patched Guilin hydrology network v6")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
