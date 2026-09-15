#!/usr/bin/env python3
"""Validate Farmland Object DNA records with standard-library-only checks.

This validator checks machine-readable identity, topology and state contracts.
It does not grant visual acceptance or production readiness. Those remain subject
 to FARMLAND_PRODUCTION_RULES.md, QUALITY_GATES.json and user review.
"""

from __future__ import annotations

import json
import math
import sys
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

ALLOWED_TYPES = {
    "paddy",
    "dry_field",
    "vegetable_garden",
    "orchard",
    "nursery",
    "fallow",
}
ALLOWED_EVIDENCE = {
    "observed",
    "measured",
    "documented",
    "inferred",
    "generated",
    "unknown",
    "conflicted",
}
ALLOWED_REVIEW = {"candidate", "checked", "accepted", "conflicted", "rejected"}
ALLOWED_MODES = {
    "research",
    "structural_prototype",
    "internal_visual_candidate",
    "public_candidate",
    "failure_reference",
}
HYDRAULIC_EDGE_KINDS = {"feeds", "divides_to", "spills_to", "drains_to", "returns_to"}
REQUIRED_TOP = {
    "identity",
    "spatial",
    "parcel",
    "hydraulics",
    "soil",
    "crop",
    "laborSettlement",
    "calendar",
    "maintenance",
    "degradation",
    "coupling",
    "representation",
}
FORBIDDEN_PUBLIC_PROXIES = {
    "round_tube_channel",
    "round_tube_bund",
    "flat_fake_water",
    "isolated_hydraulic_icon",
    "mechanical_grid_parcel",
    "repeated_band_terrace",
    "cone_rice_stage_scaling",
}
REQUIRED_WATER_STATE = {
    "bed_elevation_m",
    "mud_surface_elevation_m",
    "water_surface_elevation_m",
    "average_depth_m",
    "storage_area_m2",
    "storage_volume_m3",
    "bund_crest_minimum_m",
    "inflow_m3",
    "rainfall_m3",
    "outflow_m3",
    "overflow_m3",
    "evaporation_m3",
    "seepage_m3",
    "storage_change_m3",
    "mass_balance_error_m3",
}
REQUIRED_RICE_STAGE_MODELS = {
    "nursery",
    "lifting_seedlings",
    "transplanted",
    "establishment",
    "tillering",
    "stem_elongation",
    "panicle_initiation",
    "booting",
    "heading",
    "flowering",
    "grain_filling",
    "maturity",
    "harvest",
    "stubble",
}


def fail(message: str) -> None:
    raise ValueError(message)


def require_mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{label} must be an object")
    return value


def require_list(value: Any, label: str, *, nonempty: bool = False) -> list[Any]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    if nonempty and not value:
        fail(f"{label} must not be empty")
    return value


def require_keys(mapping: dict[str, Any], keys: set[str] | tuple[str, ...], label: str) -> None:
    missing = sorted(set(keys) - set(mapping))
    if missing:
        fail(f"{label} missing keys: {missing}")


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def is_unresolved(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {
            "unknown",
            "missing",
            "incomplete",
            "research_target",
            "not_run",
            "unsupported",
        }
    return False


def iter_component_ids(items: list[Any], label: str) -> set[str]:
    ids: set[str] = set()
    for index, item in enumerate(items):
        mapping = require_mapping(item, f"{label}[{index}]")
        object_id = mapping.get("id")
        if not isinstance(object_id, str) or not object_id:
            fail(f"{label}[{index}] requires a non-empty id")
        if object_id in ids:
            fail(f"duplicate id in {label}: {object_id}")
        ids.add(object_id)
    return ids


def has_path(adjacency: dict[str, set[str]], start: str, target: str) -> bool:
    queue: deque[str] = deque([start])
    seen = {start}
    while queue:
        current = queue.popleft()
        if current == target:
            return True
        for nxt in adjacency.get(current, set()):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return False


def validate_hydraulic_graph(
    hydraulics: dict[str, Any],
    parcel: dict[str, Any],
) -> dict[str, Any]:
    source = require_mapping(hydraulics.get("water_source"), "hydraulics.water_source")
    source_id = source.get("id")
    if not isinstance(source_id, str) or not source_id:
        fail("hydraulics.water_source requires id")

    inlets = require_list(hydraulics.get("inlets"), "hydraulics.inlets", nonempty=True)
    outlets = require_list(hydraulics.get("outlets"), "hydraulics.outlets", nonempty=True)
    channels = require_list(hydraulics.get("channels"), "hydraulics.channels", nonempty=True)
    dividers = require_list(hydraulics.get("dividers", []), "hydraulics.dividers")
    cells = require_list(parcel.get("cells"), "parcel.cells", nonempty=True)
    receiver = require_mapping(hydraulics.get("downstream_receiver"), "hydraulics.downstream_receiver")
    receiver_id = receiver.get("id")
    if not isinstance(receiver_id, str) or not receiver_id:
        fail("hydraulics.downstream_receiver requires id")
    if source_id == receiver_id:
        fail("water source and downstream receiver must have distinct ids")

    groups = {
        "hydraulics.inlets": inlets,
        "hydraulics.outlets": outlets,
        "hydraulics.channels": channels,
        "hydraulics.dividers": dividers,
        "parcel.cells": cells,
    }
    ids = {source_id, receiver_id}
    for label, items in groups.items():
        group_ids = iter_component_ids(items, label)
        overlap = ids.intersection(group_ids)
        if overlap:
            fail(f"component ids must be globally unique, duplicates: {sorted(overlap)}")
        ids.update(group_ids)

    graph = require_list(hydraulics.get("graph"), "hydraulics.graph", nonempty=True)
    adjacency: dict[str, set[str]] = defaultdict(set)
    seen_edges: set[tuple[str, str]] = set()
    for index, edge in enumerate(graph):
        mapping = require_mapping(edge, f"hydraulics.graph[{index}]")
        require_keys(mapping, ("from", "to", "kind"), f"hydraulics.graph[{index}]")
        start = mapping["from"]
        end = mapping["to"]
        if not isinstance(start, str) or not isinstance(end, str):
            fail(f"hydraulics.graph[{index}] endpoints must be strings")
        if mapping["kind"] not in HYDRAULIC_EDGE_KINDS:
            fail(f"hydraulics.graph[{index}] kind is not a hydraulic transfer relation")
        if start not in ids:
            fail(f"hydraulics.graph[{index}] references unknown from id: {start}")
        if end not in ids:
            fail(f"hydraulics.graph[{index}] references unknown to id: {end}")
        if start == end:
            fail(f"hydraulics.graph[{index}] cannot be a self-loop")
        if (start, end) in seen_edges:
            fail("duplicate hydraulic endpoint pair; parallel facilities need distinct component ids")
        seen_edges.add((start, end))
        adjacency[start].add(end)

    cell_ids = {item["id"] for item in cells}
    disconnected_from_source = sorted(cell_id for cell_id in cell_ids if not has_path(adjacency, source_id, cell_id))
    disconnected_from_receiver = sorted(cell_id for cell_id in cell_ids if not has_path(adjacency, cell_id, receiver_id))
    if disconnected_from_source:
        fail(f"paddy cells lack source path: {disconnected_from_source}")
    if disconnected_from_receiver:
        fail(f"paddy cells lack downstream receiver path: {disconnected_from_receiver}")

    # A declared inlet/outlet/channel is not evidence of a functioning path if
    # it is orphaned beside a shortcut. Research graphs keep unresolved geometry,
    # but their intended component connectivity must already be meaningful.
    for node_id in sorted(ids - {source_id, receiver_id}):
        if not has_path(adjacency, source_id, node_id) or not has_path(adjacency, node_id, receiver_id):
            fail(f"hydraulic component lacks source-to-receiver path: {node_id}")
    inlet_ids = {item["id"] for item in inlets}
    outlet_ids = {item["id"] for item in outlets}
    for cell_id in sorted(cell_ids):
        if not any(cell_id in adjacency[inlet] for inlet in inlet_ids):
            fail(f"field requires a directly connected inlet: {cell_id}")
        if not adjacency[cell_id].intersection(outlet_ids):
            fail(f"field requires a directly connected outlet: {cell_id}")

    return {
        "source_id": source_id,
        "receiver_id": receiver_id,
        "node_count": len(ids),
        "edge_count": len(graph),
        "cell_count": len(cell_ids),
        "scope": "declared_connectivity_only_not_flow_feasibility",
    }


def validate_water_budget(state: dict[str, Any], label: str = "water_state") -> dict[str, float]:
    """Check one level field's interval budget; never accept self-reported PASS.

    SI volumes are integrated over [start_time_s, end_time_s). This is an
    accounting check, not a discharge, infiltration or crop-demand solver.
    Nonplanar storage requires a separate, validated hypsometric model.
    """
    require_keys(state, REQUIRED_WATER_STATE | {
        "initial_storage_volume_m3", "start_time_s", "end_time_s", "storage_model"
    }, label)
    if state["storage_model"] != "level_planar_field":
        fail(f"{label}: unsupported storage_model")
    for key in REQUIRED_WATER_STATE | {"initial_storage_volume_m3", "start_time_s", "end_time_s"}:
        if not is_number(state[key]):
            fail(f"{label}.{key} must be finite numeric")
    nonnegative = {
        "average_depth_m", "storage_volume_m3", "initial_storage_volume_m3",
        "inflow_m3", "rainfall_m3", "outflow_m3", "overflow_m3",
        "evaporation_m3", "seepage_m3",
    }
    for key in nonnegative:
        if state[key] < 0:
            fail(f"{label}.{key} cannot be negative")
    if state["storage_area_m2"] <= 0 or state["end_time_s"] <= state["start_time_s"]:
        fail(f"{label}: positive area and increasing time interval required")
    bed, mud, water, crest = (state[k] for k in (
        "bed_elevation_m", "mud_surface_elevation_m", "water_surface_elevation_m", "bund_crest_minimum_m"
    ))
    if not bed <= mud <= water < crest:
        fail(f"{label}: invalid bed/mud/water/crest ordering")
    # Fixed numeric tolerances cannot be enlarged by the input record. These
    # tolerances are solver accounting precision, not a claim of survey accuracy.
    if not math.isclose(water - mud, state["average_depth_m"], rel_tol=1e-9, abs_tol=1e-7):
        fail(f"{label}: water depth differs from world-coordinate elevations")
    expected_volume = state["storage_area_m2"] * state["average_depth_m"]
    if not is_number(expected_volume) or not math.isclose(expected_volume, state["storage_volume_m3"], rel_tol=1e-9, abs_tol=1e-6):
        fail(f"{label}: storage volume differs from area times depth")
    delta = state["storage_volume_m3"] - state["initial_storage_volume_m3"]
    net = math.fsum([state["inflow_m3"], state["rainfall_m3"], -state["outflow_m3"],
                     -state["overflow_m3"], -state["evaporation_m3"], -state["seepage_m3"]])
    error = delta - net
    tolerance = 1e-6 + 1e-9 * max(abs(delta), abs(net))
    if not all(is_number(x) for x in (delta, net, error, tolerance)):
        fail(f"{label}: non-finite budget arithmetic")
    if abs(delta - state["storage_change_m3"]) > tolerance:
        fail(f"{label}: storage_change differs from final minus initial storage")
    if abs(error - state["mass_balance_error_m3"]) > tolerance or abs(error) > tolerance:
        fail(f"{label}: recomputed water mass balance failed")
    return {"storage_change_m3": delta, "recomputed_error_m3": error, "tolerance_m3": tolerance}


def validate_public_paddy(
    data: dict[str, Any],
    graph_result: dict[str, Any],
    warnings: list[str],
) -> None:
    identity = data["identity"]
    representation = data["representation"]
    hydraulics = data["hydraulics"]
    parcel = data["parcel"]
    crop = data["crop"]

    if identity.get("review_status") not in {"checked", "accepted"}:
        fail("public candidate identity.review_status must be checked or accepted")
    sources = identity.get("evidence", {}).get("sources")
    if not isinstance(sources, list) or not sources:
        fail("public candidate requires at least one evidence source")

    if representation.get("mode") != "public_candidate":
        fail("public candidate requires representation.mode=public_candidate")
    if representation.get("debug_only") is not False:
        fail("public candidate requires representation.debug_only=false")
    if representation.get("microscope_allowed") is not True:
        fail("public candidate requires representation.microscope_allowed=true after prior gates pass")

    visible_proxies = set(representation.get("visible_proxy_types", []))
    forbidden_visible = sorted(visible_proxies.intersection(FORBIDDEN_PUBLIC_PROXIES))
    if forbidden_visible:
        fail(f"public candidate contains forbidden visible proxies: {forbidden_visible}")

    for check_name in ("closed_graph_check", "elevation_check", "mass_balance_check"):
        if hydraulics.get(check_name) is not True:
            fail(f"public candidate requires hydraulics.{check_name}=true")

    cells = parcel["cells"]
    states = hydraulics.get("cell_water_states")
    if states is None:
        if len(cells) != 1:
            fail("multiple fields require cell_water_states; one aggregate cannot prove each field")
        states = {cells[0]["id"]: hydraulics["water_state"]}
    states = require_mapping(states, "hydraulics.cell_water_states")
    if set(states) != {c["id"] for c in cells}:
        fail("cell_water_states must cover exactly the declared fields")
    intervals = set()
    for cell_id, state in states.items():
        state = require_mapping(state, f"cell_water_states.{cell_id}")
        validate_water_budget(state, f"cell_water_states.{cell_id}")
        intervals.add((state["start_time_s"], state["end_time_s"]))
    if len(intervals) != 1:
        fail("cell water budgets must use the same time interval")
    warnings.append("per-cell budgets checked; inter-cell transfer reciprocity and hydraulic feasibility remain separate gates")

    for label in ("channels", "inlets", "outlets"):
        for index, item in enumerate(require_list(hydraulics.get(label), f"hydraulics.{label}")):
            component = require_mapping(item, f"hydraulics.{label}[{index}]")
            if component.get("cross_section_status") not in {"checked", "accepted"}:
                fail(f"public candidate requires checked cross section for {label}[{index}]")
            if component.get("ready_for_geometry") is not True:
                fail(f"public candidate requires ready_for_geometry=true for {label}[{index}]")

    for index, bund in enumerate(require_list(parcel.get("bunds"), "parcel.bunds")):
        component = require_mapping(bund, f"parcel.bunds[{index}]")
        if component.get("cross_section_status") not in {"checked", "accepted"}:
            fail(f"public candidate requires checked bund cross section at index {index}")
        if component.get("ready_for_geometry") is not True:
            fail(f"public candidate requires ready_for_geometry=true for bund index {index}")
        served_fields = component.get("served_fields")
        if not isinstance(served_fields, list) or not served_fields:
            fail(f"bund index {index} requires served_fields")

    stage_models = require_mapping(crop.get("stage_models"), "crop.stage_models")
    missing_stages = sorted(REQUIRED_RICE_STAGE_MODELS - set(stage_models))
    if missing_stages:
        fail(f"public candidate missing rice stage models: {missing_stages}")
    unresolved_stages = sorted(key for key in REQUIRED_RICE_STAGE_MODELS if is_unresolved(stage_models.get(key)))
    if unresolved_stages:
        fail(f"public candidate has unresolved rice stage models: {unresolved_stages}")
    if crop.get("ready_for_geometry") is not True:
        fail("public candidate requires crop.ready_for_geometry=true")

    if graph_result["cell_count"] < 1:
        fail("public paddy requires at least one connected field cell")

    warnings.append("machine validation does not replace section drawing, AAA visual review, browser QA or user acceptance")


def validate(data: dict[str, Any]) -> dict[str, Any]:
    missing = sorted(REQUIRED_TOP - set(data))
    if missing:
        fail(f"missing top-level sections: {missing}")

    identity = require_mapping(data["identity"], "identity")
    require_keys(
        identity,
        ("world_id", "object_id", "type_id", "revision", "evidence", "review_status"),
        "identity",
    )
    if identity["type_id"] not in ALLOWED_TYPES:
        fail(f"unsupported type_id: {identity['type_id']}")
    evidence = require_mapping(identity["evidence"], "identity.evidence")
    if evidence.get("kind") not in ALLOWED_EVIDENCE:
        fail("invalid identity evidence kind")
    if not isinstance(evidence.get("sources"), list):
        fail("identity.evidence.sources must be an array")
    if identity.get("review_status") not in ALLOWED_REVIEW:
        fail("invalid identity.review_status")

    spatial = require_mapping(data["spatial"], "spatial")
    if not is_number(spatial.get("area_m2")) or spatial["area_m2"] <= 0:
        fail("spatial.area_m2 must be positive")
    boundary = require_list(spatial.get("boundary"), "spatial.boundary", nonempty=True)
    if len(boundary) < 3:
        fail("spatial.boundary requires at least three points")
    if spatial.get("units") != "m":
        fail("spatial.units must be m")
    if "terrain_ref" not in spatial:
        fail("spatial requires terrain_ref")

    parcel = require_mapping(data["parcel"], "parcel")
    require_list(parcel.get("cells"), "parcel.cells", nonempty=True)
    require_list(parcel.get("bunds"), "parcel.bunds")
    require_list(parcel.get("paths"), "parcel.paths")
    require_list(parcel.get("relations"), "parcel.relations")

    representation = require_mapping(data["representation"], "representation")
    require_keys(
        representation,
        ("seed", "method_version", "mode", "debug_only", "public_candidate"),
        "representation",
    )
    if representation.get("mode") not in ALLOWED_MODES:
        fail("invalid representation.mode")
    if not isinstance(representation.get("debug_only"), bool):
        fail("representation.debug_only must be boolean")
    if not isinstance(representation.get("public_candidate"), bool):
        fail("representation.public_candidate must be boolean")
    if representation["public_candidate"] != (representation["mode"] == "public_candidate"):
        fail("representation.public_candidate and mode must agree in both directions")
    if representation.get("mode") == "research" and representation.get("debug_only") is not True:
        fail("research mode must remain debug_only=true")

    coupling = require_mapping(data["coupling"], "coupling")
    require_list(coupling.get("inputs"), "coupling.inputs")
    require_list(coupling.get("outputs"), "coupling.outputs")

    warnings: list[str] = []
    graph_result: dict[str, Any] | None = None

    if identity["type_id"] == "paddy":
        hydraulics = require_mapping(data["hydraulics"], "hydraulics")
        parcel_scale = parcel.get("scale_modulus")
        if not isinstance(parcel_scale, dict):
            fail("paddy requires parcel.scale_modulus")
        graph_result = validate_hydraulic_graph(hydraulics, parcel)

        water_state = require_mapping(hydraulics.get("water_state"), "hydraulics.water_state")
        require_keys(water_state, REQUIRED_WATER_STATE, "hydraulics.water_state")

        crop = require_mapping(data["crop"], "crop")
        require_mapping(crop.get("establishment"), "crop.establishment")
        stage_models = require_mapping(crop.get("stage_models"), "crop.stage_models")
        missing_stage_keys = sorted(REQUIRED_RICE_STAGE_MODELS - set(stage_models))
        if missing_stage_keys:
            fail(f"crop.stage_models missing keys: {missing_stage_keys}")
        if "ready_for_geometry" not in crop:
            fail("paddy crop requires ready_for_geometry")

        labor = require_mapping(data["laborSettlement"], "laborSettlement")
        if "maintenance_capacity_state" not in labor:
            fail("traditional paddy requires maintenance_capacity_state")

        if representation.get("public_candidate"):
            validate_public_paddy(data, graph_result, warnings)
        else:
            unresolved = sum(1 for value in water_state.values() if is_unresolved(value))
            if unresolved:
                warnings.append(f"research or prototype record retains {unresolved} unresolved water-state values")
            unresolved_stage_count = sum(
                1 for key in REQUIRED_RICE_STAGE_MODELS if is_unresolved(stage_models.get(key))
            )
            if unresolved_stage_count:
                warnings.append(f"research or prototype record retains {unresolved_stage_count} unresolved rice stage models")

    result: dict[str, Any] = {
        "ok": True,
        "object_id": identity["object_id"],
        "type_id": identity["type_id"],
        "revision": identity["revision"],
        "mode": representation["mode"],
        "public_candidate": representation["public_candidate"],
        "visualAcceptance": False,
        "productionReady": False,
        "warnings": warnings,
    }
    if graph_result is not None:
        result["hydraulic_graph"] = graph_result
    return result


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_farmland_dna.py <object.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        result = validate(data)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
