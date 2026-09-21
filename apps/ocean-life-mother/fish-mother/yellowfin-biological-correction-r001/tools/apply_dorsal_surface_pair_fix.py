#!/usr/bin/env python3
"""Apply the anatomical dorsal-surface pairing correction.

The first Candidate A receipt exposed that connected components 0 and 3 were the two
surfaces of the same first dorsal fin, while components 2 and 4 were the two surfaces
of the second dorsal fin. Treating anterior-order component 1 as the second dorsal
elongated only one side of the first dorsal. This patch makes the audit and generator
reason in anatomical surface groups and deform both sides together.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path("apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001")
AUDIT = ROOT / "tools/audit_frozen_baseline.py"
BUILD = ROOT / "tools/build_candidate_a.py"
TEST = ROOT / "tests/candidate-a-r001.test.mjs"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def patch_audit() -> None:
    text = AUDIT.read_text(encoding="utf-8")
    anchor = '''def profile_metrics(points: np.ndarray, fork_y: float, fork_length: float, bins: int = 120) -> dict[str, Any]:
'''
    helper = '''def group_mirrored_fin_surfaces(components: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Pair disconnected positive/negative-X sheets that form one anatomical fin.

    The source dorsal mesh stores the first and second dorsal fins as mirrored surface
    sheets. Connectivity alone therefore counts two components per anatomical fin.
    Pair only components with identical topology and longitudinal/root metrics, then
    sort anatomical groups from snout toward tail by root U.
    """
    used: set[int] = set()
    groups: list[list[dict[str, Any]]] = []
    tolerance = 2e-6
    for index, component in enumerate(components):
        if index in used:
            continue
        used.add(index)
        group = [component]
        centroid = component["bounds"]["centroid"]
        root_centroid = component["attachmentRoot"]["bounds"]["centroid"]
        if centroid is not None and root_centroid is not None and abs(float(centroid[0])) > tolerance:
            best_index: int | None = None
            best_score = float("inf")
            for other_index, other in enumerate(components):
                if other_index in used:
                    continue
                other_centroid = other["bounds"]["centroid"]
                other_root_centroid = other["attachmentRoot"]["bounds"]["centroid"]
                if other_centroid is None or other_root_centroid is None:
                    continue
                if component["faces"] != other["faces"] or component["vertices"] != other["vertices"]:
                    continue
                if not np.allclose(component["bounds"]["uRange"], other["bounds"]["uRange"], atol=tolerance, rtol=0):
                    continue
                if not np.allclose(
                    component["attachmentRoot"]["bounds"]["uRange"],
                    other["attachmentRoot"]["bounds"]["uRange"],
                    atol=tolerance,
                    rtol=0,
                ):
                    continue
                if abs(component["dorsalHeightOverForkLength"] - other["dorsalHeightOverForkLength"]) > tolerance:
                    continue
                if abs(float(centroid[0]) + float(other_centroid[0])) > tolerance:
                    continue
                score = (
                    abs(float(root_centroid[1]) - float(other_root_centroid[1]))
                    + abs(float(root_centroid[2]) - float(other_root_centroid[2]))
                    + abs(abs(float(centroid[0])) - abs(float(other_centroid[0])))
                )
                if score < best_score:
                    best_score = score
                    best_index = other_index
            if best_index is not None:
                used.add(best_index)
                group.append(components[best_index])
        groups.append(group)

    groups.sort(
        key=lambda group: float(
            np.mean(
                [
                    component["attachmentRoot"]["bounds"]["centroid"][1]
                    for component in group
                    if component["attachmentRoot"]["bounds"]["centroid"] is not None
                ]
            )
        ),
        reverse=True,
    )
    return groups


def fin_surface_group_summary(group: list[dict[str, Any]]) -> dict[str, Any]:
    root_u = [
        float(component["attachmentRoot"]["bounds"]["centroid"][1])
        for component in group
        if component["attachmentRoot"]["bounds"]["centroid"] is not None
    ]
    u_ranges = [component["bounds"]["uRange"] for component in group]
    heights = [float(component["dorsalHeightOverForkLength"]) for component in group]
    return {
        "componentIds": [int(component["component"]) for component in group],
        "surfaceCount": len(group),
        "rootU": clean_float(float(np.mean(root_u))),
        "uRange": vector([min(value[0] for value in u_ranges), max(value[1] for value in u_ranges)]),
        "dorsalHeightOverForkLength": clean_float(max(heights)),
        "surfaceHeightSpread": clean_float(max(heights) - min(heights), 12),
        "faces": int(sum(component["faces"] for component in group)),
        "vertices": int(sum(component["vertices"] for component in group)),
    }


'''
    if "def group_mirrored_fin_surfaces(" not in text:
        text = replace_once(text, anchor, helper + anchor, "insert audit dorsal pairing helper")

    old_selection = '''    dorsal_components = component_records["dorsal_fin"]
    anal_components = component_records["anal_fin"]
    second_dorsal = dorsal_components[1] if len(dorsal_components) > 1 else (dorsal_components[0] if dorsal_components else None)
    first_dorsal = dorsal_components[0] if dorsal_components else None
    first_dorsal_base_u = (
        first_dorsal["attachmentRoot"]["bounds"]["uRange"] if first_dorsal is not None else None
    )
    deepest_u = float(profile["deepest"]["u"])
    deepest_near_first_dorsal = bool(
        first_dorsal_base_u is not None
        and first_dorsal_base_u[0] - 0.08 <= deepest_u <= first_dorsal_base_u[1] + 0.08
    )
'''
    new_selection = '''    dorsal_components = component_records["dorsal_fin"]
    anal_components = component_records["anal_fin"]
    dorsal_surface_groups = group_mirrored_fin_surfaces(dorsal_components)
    if len(dorsal_surface_groups) < 3:
        raise ValueError(f"dorsal anatomy unresolved: {len(dorsal_surface_groups)} surface groups")
    first_dorsal_group = dorsal_surface_groups[0]
    second_dorsal_group = dorsal_surface_groups[1]
    if len(first_dorsal_group) != 2 or len(second_dorsal_group) != 2:
        raise ValueError(
            "first and second dorsal fins must each resolve to two mirrored surface sheets: "
            f"{[len(group) for group in dorsal_surface_groups]}"
        )
    dorsal_group_records = [fin_surface_group_summary(group) for group in dorsal_surface_groups]
    second_dorsal_height = max(
        float(component["dorsalHeightOverForkLength"]) for component in second_dorsal_group
    )
    first_dorsal_base_u = [
        min(component["attachmentRoot"]["bounds"]["uRange"][0] for component in first_dorsal_group),
        max(component["attachmentRoot"]["bounds"]["uRange"][1] for component in first_dorsal_group),
    ]
    deepest_u = float(profile["deepest"]["u"])
    deepest_near_first_dorsal = bool(
        first_dorsal_base_u[0] - 0.08 <= deepest_u <= first_dorsal_base_u[1] + 0.08
    )
'''
    text = replace_once(text, old_selection, new_selection, "replace audit dorsal selection")

    old_metric = '''            "secondDorsalHeightOverForkLength": None
            if second_dorsal is None
            else second_dorsal["dorsalHeightOverForkLength"],
'''
    text = replace_once(
        text,
        old_metric,
        '''            "secondDorsalHeightOverForkLength": clean_float(second_dorsal_height),
''',
        "correct baseline second dorsal metric",
    )

    text = replace_once(
        text,
        '''        "components": component_records,
        "boundary": {
''',
        '''        "components": component_records,
        "dorsalAnatomicalSurfaceGroups": dorsal_group_records,
        "boundary": {
''',
        "record anatomical dorsal groups",
    )

    text = replace_once(
        text,
        '''        "finletCountsRetained": dorsal_finlet_count == 9 and ventral_finlet_count == 8,
        "frozenGlbNotModified": True,
''',
        '''        "finletCountsRetained": dorsal_finlet_count == 9 and ventral_finlet_count == 8,
        "dorsalAnatomicalSurfaceGroupsResolved": (
            len(dorsal_surface_groups) >= 3
            and len(first_dorsal_group) == 2
            and len(second_dorsal_group) == 2
        ),
        "firstAndSecondDorsalDistinct": (
            dorsal_group_records[0]["rootU"] - dorsal_group_records[1]["rootU"] > 0.05
        ),
        "frozenGlbNotModified": True,
''',
        "add dorsal anatomy gates",
    )

    text = replace_once(
        text,
        '''            "The current source may violate published adult pectoral or mature-fin proportions; candidate deformation must report the delta rather than silently forcing a preset.",
''',
        '''            "The current source may violate published adult pectoral or mature-fin proportions; candidate deformation must report the delta rather than silently forcing a preset.",
            "Thin dorsal fins are stored as mirrored disconnected sheets; component order alone is not anatomical identity.",
''',
        "record dorsal topology risk",
    )
    AUDIT.write_text(text, encoding="utf-8")


def patch_build() -> None:
    text = BUILD.read_text(encoding="utf-8")

    text = replace_once(
        text,
        '''                "rootCentroid": root_centroid,
                "maxRootDistance": float(max_distance or 0.0),
''',
        '''                "rootCentroid": root_centroid,
                "centroid": component_points.mean(axis=0),
                "maxRootDistance": float(max_distance or 0.0),
''',
        "store component centroid",
    )

    anchor = '''def component_summary(component: dict[str, Any], fork_length: float) -> dict[str, Any]:
'''
    helper = '''def group_mirrored_components(components: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Resolve disconnected mirrored sheets into anatomical fin groups."""
    used: set[int] = set()
    groups: list[list[dict[str, Any]]] = []
    tolerance = 2e-6
    for index, component in enumerate(components):
        if index in used:
            continue
        used.add(index)
        group = [component]
        centroid = component["centroid"]
        if abs(float(centroid[0])) > tolerance:
            best_index: int | None = None
            best_score = float("inf")
            for other_index, other in enumerate(components):
                if other_index in used:
                    continue
                if component["faces"] != other["faces"] or component["vertices"] != other["vertices"]:
                    continue
                if not np.allclose(component["uRange"], other["uRange"], atol=tolerance, rtol=0):
                    continue
                if abs(component["rootU"] - other["rootU"]) > tolerance:
                    continue
                if abs(component["dorsalHeight"] - other["dorsalHeight"]) > fork_length_for_pairing(components) * tolerance:
                    continue
                if abs(float(centroid[0]) + float(other["centroid"][0])) > fork_length_for_pairing(components) * tolerance:
                    continue
                score = (
                    abs(component["rootU"] - other["rootU"])
                    + abs(float(component["rootCentroid"][2]) - float(other["rootCentroid"][2]))
                    + abs(abs(float(centroid[0])) - abs(float(other["centroid"][0])))
                )
                if score < best_score:
                    best_score = score
                    best_index = other_index
            if best_index is not None:
                used.add(best_index)
                group.append(components[best_index])
        groups.append(group)
    groups.sort(key=lambda group: float(np.mean([component["rootU"] for component in group])), reverse=True)
    return groups


def fork_length_for_pairing(components: list[dict[str, Any]]) -> float:
    spans = [
        max(float(component["maxRootDistance"]), float(component["dorsalHeight"]), float(component["ventralHeight"]))
        for component in components
    ]
    return max(max(spans, default=1.0), 1.0)


def anatomical_group_summary(group: list[dict[str, Any]], fork_length: float) -> dict[str, Any]:
    heights = [component_metric(component, np.empty((0, 3)), fork_length, "dorsal") if False else component["dorsalHeight"] / fork_length for component in group]
    return {
        "componentIds": [int(component["component"]) for component in group],
        "surfaceCount": len(group),
        "rootU": clean_float(float(np.mean([component["rootU"] for component in group]))),
        "uRange": vector([
            min(component["uRange"][0] for component in group),
            max(component["uRange"][1] for component in group),
        ]),
        "dorsalHeightOverForkLength": clean_float(max(heights)),
        "surfaceHeightSpread": clean_float(max(heights) - min(heights), 12),
        "surfaces": [component_summary(component, fork_length) for component in group],
    }


'''
    if "def group_mirrored_components(" not in text:
        text = replace_once(text, anchor, helper + anchor, "insert generator dorsal grouping helper")

    old_measure = '''    second_dorsal = components["dorsal_fin"][1] if len(components["dorsal_fin"]) > 1 else components["dorsal_fin"][0]
    second_dorsal_height = component_metric(second_dorsal, positions, fork_length, "dorsal")
'''
    new_measure = '''    dorsal_groups = group_mirrored_components(components["dorsal_fin"])
    if len(dorsal_groups) < 3 or len(dorsal_groups[0]) != 2 or len(dorsal_groups[1]) != 2:
        raise ValueError(f"candidate dorsal anatomy unresolved: {[len(group) for group in dorsal_groups]}")
    first_dorsal_group = dorsal_groups[0]
    second_dorsal_group = dorsal_groups[1]
    first_dorsal_heights = [
        component_metric(component, positions, fork_length, "dorsal") for component in first_dorsal_group
    ]
    second_dorsal_heights = [
        component_metric(component, positions, fork_length, "dorsal") for component in second_dorsal_group
    ]
    second_dorsal_height = max(second_dorsal_heights)
'''
    text = replace_once(text, old_measure, new_measure, "measure anatomical second dorsal")

    old_first = '''    first_dorsal = components["dorsal_fin"][0]
    first_root_points = positions[first_dorsal["rootVertexIds"]]
    first_base_u = [
        float((first_root_points[:, 1].min() - fork_y) / fork_length),
        float((first_root_points[:, 1].max() - fork_y) / fork_length),
    ]
'''
    new_first = '''    first_root_vertex_ids = np.unique(
        np.concatenate([component["rootVertexIds"] for component in first_dorsal_group])
    ).astype(np.int64)
    first_root_points = positions[first_root_vertex_ids]
    first_base_u = [
        float((first_root_points[:, 1].min() - fork_y) / fork_length),
        float((first_root_points[:, 1].max() - fork_y) / fork_length),
    ]
'''
    text = replace_once(text, old_first, new_first, "measure first dorsal anatomical root")

    text = replace_once(
        text,
        '''        "secondDorsalHeightOverForkLength": clean_float(second_dorsal_height),
        "analHeightOverForkLength": clean_float(anal_height),
''',
        '''        "secondDorsalHeightOverForkLength": clean_float(second_dorsal_height),
        "firstDorsalSurfaceHeightSpread": clean_float(max(first_dorsal_heights) - min(first_dorsal_heights), 12),
        "secondDorsalSurfaceHeightSpread": clean_float(max(second_dorsal_heights) - min(second_dorsal_heights), 12),
        "dorsalAnatomicalGroupCount": len(dorsal_groups),
        "firstDorsalSurfaceCount": len(first_dorsal_group),
        "secondDorsalSurfaceCount": len(second_dorsal_group),
        "analHeightOverForkLength": clean_float(anal_height),
''',
        "record dorsal symmetry metrics",
    )

    old_build = '''    if len(component_global["dorsal_fin"]) < 2:
        raise ValueError("second dorsal component is missing")
    second_dorsal_component = component_global["dorsal_fin"][1]
    second_dorsal_target = float(controls["targets"]["secondDorsalHeightOverForkLength"])
    second_dorsal_factor, second_dorsal_solved_metric = solve_component_extension_factor(
        candidate_main_positions,
        second_dorsal_component,
        second_dorsal_target,
        fork_length,
        "vertical",
        "dorsal",
    )
    extend_component_vertices(candidate_main_positions, second_dorsal_component, second_dorsal_factor, "vertical")
    second_dorsal_config = component_point_deformer(
        second_dorsal_component, global_main_positions, second_dorsal_factor, "vertical"
    )
'''
    new_build = '''    dorsal_surface_groups = group_mirrored_components(component_global["dorsal_fin"])
    if len(dorsal_surface_groups) < 3:
        raise ValueError(f"second dorsal anatomy is missing: {len(dorsal_surface_groups)} groups")
    first_dorsal_surfaces = dorsal_surface_groups[0]
    second_dorsal_surfaces = dorsal_surface_groups[1]
    if len(first_dorsal_surfaces) != 2 or len(second_dorsal_surfaces) != 2:
        raise ValueError(
            "first and second dorsal fins must each have two mirrored sheets: "
            f"{[len(group) for group in dorsal_surface_groups]}"
        )
    second_dorsal_target = float(controls["targets"]["secondDorsalHeightOverForkLength"])
    second_dorsal_factors: list[float] = []
    second_dorsal_solved_metrics: list[float] = []
    second_dorsal_configs: list[dict[str, Any]] = []
    for second_dorsal_component in second_dorsal_surfaces:
        factor, solved_metric = solve_component_extension_factor(
            candidate_main_positions,
            second_dorsal_component,
            second_dorsal_target,
            fork_length,
            "vertical",
            "dorsal",
        )
        extend_component_vertices(candidate_main_positions, second_dorsal_component, factor, "vertical")
        second_dorsal_factors.append(factor)
        second_dorsal_solved_metrics.append(solved_metric)
        second_dorsal_configs.append(
            component_point_deformer(second_dorsal_component, global_main_positions, factor, "vertical")
        )
    second_dorsal_component_ids = {
        int(component["component"]) for component in second_dorsal_surfaces
    }
'''
    text = replace_once(text, old_build, new_build, "deform both second dorsal sheets")

    old_configs = '''    dorsal_all_configs = [
        component_point_deformer(component, global_main_positions, 1.0, "vertical")
        for component in component_global["dorsal_fin"]
    ]
    for index, config in enumerate(dorsal_all_configs):
        if index == 1:
            dorsal_all_configs[index] = second_dorsal_config
'''
    new_configs = '''    second_dorsal_config_by_id = {
        int(config["component"]["component"]): config for config in second_dorsal_configs
    }
    dorsal_all_configs = [
        second_dorsal_config_by_id.get(
            int(component["component"]),
            component_point_deformer(component, global_main_positions, 1.0, "vertical"),
        )
        for component in component_global["dorsal_fin"]
    ]
'''
    text = replace_once(text, old_configs, new_configs, "bind dorsal configs by component identity")

    old_joint = '''        if name.startswith("UpperFin"):
            nearest = nearest_component(globally_deformed, dorsal_all_configs)
            if nearest is second_dorsal_config:
                return apply_component_to_point(globally_deformed, second_dorsal_config)
'''
    new_joint = '''        if name.startswith("UpperFin"):
            nearest = nearest_component(globally_deformed, dorsal_all_configs)
            if nearest and int(nearest["component"]["component"]) in second_dorsal_component_ids:
                return apply_component_to_point(globally_deformed, nearest)
'''
    text = replace_once(text, old_joint, new_joint, "deform second dorsal rig on both sheets")

    old_controls = '''            "secondDorsalFactor": clean_float(second_dorsal_factor),
            "secondDorsalSolvedMetric": clean_float(second_dorsal_solved_metric),
'''
    new_controls = '''            "secondDorsalFactor": clean_float(second_dorsal_factors[0]),
            "secondDorsalFactors": vector(second_dorsal_factors),
            "secondDorsalSolvedMetric": clean_float(max(second_dorsal_solved_metrics)),
            "secondDorsalSolvedMetrics": vector(second_dorsal_solved_metrics),
'''
    text = replace_once(text, old_controls, new_controls, "record paired dorsal factors")

    text = replace_once(
        text,
        '''        "deepestBodyLocationPreserved": after["deepestBodyNearFirstDorsalBase"] is True,
        "candidateBrowserQAPassed": False,
''',
        '''        "deepestBodyLocationPreserved": after["deepestBodyNearFirstDorsalBase"] is True,
        "dorsalAnatomicalSurfaceGroupsResolved": (
            after["dorsalAnatomicalGroupCount"] >= 3
            and after["firstDorsalSurfaceCount"] == 2
            and after["secondDorsalSurfaceCount"] == 2
        ),
        "firstDorsalSurfaceSymmetryPassed": after["firstDorsalSurfaceHeightSpread"] <= 1e-6,
        "secondDorsalSurfaceSymmetryPassed": after["secondDorsalSurfaceHeightSpread"] <= 1e-6,
        "candidateBrowserQAPassed": False,
''',
        "add dorsal symmetry gates",
    )

    old_selection = '''        "componentSelection": {
            "pectoral": [component_summary(component, fork_length) for component in component_global["pectoral_fin"]],
            "firstDorsal": component_summary(component_global["dorsal_fin"][0], fork_length),
            "secondDorsal": component_summary(second_dorsal_component, fork_length),
            "anal": component_summary(anal_component, fork_length),
        },
'''
    new_selection = '''        "componentSelection": {
            "pectoral": [component_summary(component, fork_length) for component in component_global["pectoral_fin"]],
            "dorsalAnatomicalGroups": [
                anatomical_group_summary(group, fork_length) for group in dorsal_surface_groups
            ],
            "firstDorsalSurfaces": [
                component_summary(component, fork_length) for component in first_dorsal_surfaces
            ],
            "secondDorsalSurfaces": [
                component_summary(component, fork_length) for component in second_dorsal_surfaces
            ],
            "anal": component_summary(anal_component, fork_length),
        },
'''
    text = replace_once(text, old_selection, new_selection, "record anatomical dorsal selection")

    text = replace_once(
        text,
        '''            "firstDorsalIndependentlyElongated": False,
            "caudalIndependentlyRescaled": False,
''',
        '''            "firstDorsalIndependentlyElongated": False,
            "secondDorsalMirroredSheetsDeformedTogether": True,
            "caudalIndependentlyRescaled": False,
''',
        "record paired dorsal deformation",
    )

    text = replace_once(
        text,
        '''            "Nonlinear rest-space correction is approximated through the existing 98-joint rig; extreme poses may still reveal volume loss or local creasing.",
''',
        '''            "Nonlinear rest-space correction is approximated through the existing 98-joint rig; extreme poses may still reveal volume loss or local creasing.",
            "Dorsal anatomical identity is resolved from mirrored surface pairs, not raw connected-component order.",
''',
        "record anatomical grouping risk",
    )
    BUILD.write_text(text, encoding="utf-8")


def patch_test() -> None:
    text = TEST.read_text(encoding="utf-8")
    anchor = '''assert.equal(receipt.deformation.firstDorsalIndependentlyElongated, false);
'''
    replacement = '''assert.equal(receipt.deformation.firstDorsalIndependentlyElongated, false);
assert.equal(receipt.deformation.secondDorsalMirroredSheetsDeformedTogether, true);
assert.equal(receipt.after.firstDorsalSurfaceCount, 2);
assert.equal(receipt.after.secondDorsalSurfaceCount, 2);
assert.ok(receipt.after.firstDorsalSurfaceHeightSpread <= 1e-6);
assert.ok(receipt.after.secondDorsalSurfaceHeightSpread <= 1e-6);
assert.equal(receipt.componentSelection.firstDorsalSurfaces.length, 2);
assert.equal(receipt.componentSelection.secondDorsalSurfaces.length, 2);
assert.deepEqual(
  receipt.componentSelection.secondDorsalSurfaces.map(surface => surface.component).sort((a, b) => a - b),
  [2, 4],
);
'''
    if "secondDorsalMirroredSheetsDeformedTogether" not in text:
        text = replace_once(text, anchor, replacement, "add Candidate A dorsal pair contracts")
    TEST.write_text(text, encoding="utf-8")


def main() -> None:
    patch_audit()
    patch_build()
    patch_test()
    print("Dorsal anatomy fixed: first and second dorsal fins are paired mirrored sheets.")


if __name__ == "__main__":
    main()
