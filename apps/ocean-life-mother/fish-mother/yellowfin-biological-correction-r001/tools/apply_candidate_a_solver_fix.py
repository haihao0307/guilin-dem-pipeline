#!/usr/bin/env python3
"""Apply the one-time Candidate A fin-target solver correction.

The first machine run proved that a naive target/current factor is invalid for the
root-pinned smoothstep deformation: the second dorsal stopped at 0.141 FL instead of
0.18 FL. This patch replaces that linear assumption with an actual metric solver.
"""

from __future__ import annotations

from pathlib import Path

TARGET = Path(
    "apps/ocean-life-mother/fish-mother/yellowfin-biological-correction-r001/"
    "tools/build_candidate_a.py"
)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    text = TARGET.read_text(encoding="utf-8")

    insertion_anchor = '''def component_point_deformer(component: dict[str, Any], global_positions: np.ndarray, factor: float, mode: str) -> dict[str, Any]:
'''
    solver = '''def solve_component_extension_factor(
    positions: np.ndarray,
    component: dict[str, Any],
    target_metric: float,
    fork_length: float,
    extension_mode: str,
    metric_mode: str,
) -> tuple[float, float]:
    """Solve the real root-pinned deformation factor against its final metric.

    A target/current ratio is not valid here because the root is pinned and the
    smoothstep weight varies over the component. Solve the nonlinear monotonic map
    directly and always evaluate from the same undeformed component state.
    """
    vertex_ids = component["vertexIds"]
    root_vertex_ids = component["rootVertexIds"]
    roots = positions[root_vertex_ids]
    points = positions[vertex_ids]
    max_distance = max_min_distance(points, roots) or 0.0
    if len(roots) == 0 or max_distance <= 1e-12:
        raise ValueError("cannot solve a root-pinned component without a valid root")

    def metric_for_factor(factor: float) -> float:
        deformed = apply_root_pinned_extension(
            points,
            roots,
            factor,
            extension_mode,
            max_distance,
        )
        if metric_mode == "distance":
            value = max_min_distance(deformed, roots) or 0.0
        elif metric_mode == "dorsal":
            root_z = float(np.median(roots[:, 2]))
            value = max(0.0, root_z - float(deformed[:, 2].min()))
        elif metric_mode == "ventral":
            root_z = float(np.median(roots[:, 2]))
            value = max(0.0, float(deformed[:, 2].max()) - root_z)
        else:
            raise ValueError(f"unknown component metric mode: {metric_mode}")
        return float(value / fork_length)

    baseline_metric = metric_for_factor(1.0)
    tolerance = 2.5e-8
    if target_metric < baseline_metric - tolerance:
        raise ValueError(
            f"Candidate A extension solver cannot shrink {metric_mode}: "
            f"baseline={baseline_metric:.9f} target={target_metric:.9f}"
        )
    if abs(target_metric - baseline_metric) <= tolerance:
        return 1.0, baseline_metric

    low = 1.0
    high = 1.25
    high_metric = metric_for_factor(high)
    while high_metric < target_metric and high < 12.0:
        high *= 1.5
        high_metric = metric_for_factor(high)
    if high_metric < target_metric:
        raise ValueError(
            f"root-pinned solver could not reach {metric_mode} target: "
            f"factor={high:.6f} metric={high_metric:.9f} target={target_metric:.9f}"
        )

    for _ in range(56):
        middle = (low + high) * 0.5
        middle_metric = metric_for_factor(middle)
        if middle_metric < target_metric:
            low = middle
        else:
            high = middle
    factor = (low + high) * 0.5
    return factor, metric_for_factor(factor)


'''
    if "def solve_component_extension_factor(" not in text:
        text = replace_once(
            text,
            insertion_anchor,
            solver + insertion_anchor,
            "insert nonlinear component solver",
        )

    old_block = '''    pectoral_target = float(controls["targets"]["pectoralLengthOverForkLength"])
    pectoral_configs: list[dict[str, Any]] = []
    pectoral_factors: list[float] = []
    for source_component, global_component in zip(component_source["pectoral_fin"], component_global["pectoral_fin"], strict=True):
        current = component_metric(global_component, candidate_main_positions, fork_length, "distance")
        factor = pectoral_target / current
        extend_component_vertices(candidate_main_positions, global_component, factor, "isotropic")
        pectoral_factors.append(factor)
        pectoral_configs.append(component_point_deformer(global_component, global_main_positions, factor, "isotropic"))

    if len(component_global["dorsal_fin"]) < 2:
        raise ValueError("second dorsal component is missing")
    second_dorsal_component = component_global["dorsal_fin"][1]
    second_dorsal_current = component_metric(second_dorsal_component, candidate_main_positions, fork_length, "dorsal")
    second_dorsal_factor = float(controls["targets"]["secondDorsalHeightOverForkLength"]) / second_dorsal_current
    extend_component_vertices(candidate_main_positions, second_dorsal_component, second_dorsal_factor, "vertical")
    second_dorsal_config = component_point_deformer(
        second_dorsal_component, global_main_positions, second_dorsal_factor, "vertical"
    )

    anal_component = max(
        component_global["anal_fin"],
        key=lambda component: component_metric(component, candidate_main_positions, fork_length, "ventral"),
    )
    anal_current = component_metric(anal_component, candidate_main_positions, fork_length, "ventral")
    anal_factor = float(controls["targets"]["analHeightOverForkLength"]) / anal_current
    extend_component_vertices(candidate_main_positions, anal_component, anal_factor, "vertical")
    anal_config = component_point_deformer(anal_component, global_main_positions, anal_factor, "vertical")
'''
    new_block = '''    pectoral_target = float(controls["targets"]["pectoralLengthOverForkLength"])
    pectoral_configs: list[dict[str, Any]] = []
    pectoral_factors: list[float] = []
    pectoral_solved_metrics: list[float] = []
    for source_component, global_component in zip(component_source["pectoral_fin"], component_global["pectoral_fin"], strict=True):
        factor, solved_metric = solve_component_extension_factor(
            candidate_main_positions,
            global_component,
            pectoral_target,
            fork_length,
            "isotropic",
            "distance",
        )
        extend_component_vertices(candidate_main_positions, global_component, factor, "isotropic")
        pectoral_factors.append(factor)
        pectoral_solved_metrics.append(solved_metric)
        pectoral_configs.append(component_point_deformer(global_component, global_main_positions, factor, "isotropic"))

    if len(component_global["dorsal_fin"]) < 2:
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

    anal_component = max(
        component_global["anal_fin"],
        key=lambda component: component_metric(component, candidate_main_positions, fork_length, "ventral"),
    )
    anal_target = float(controls["targets"]["analHeightOverForkLength"])
    anal_factor, anal_solved_metric = solve_component_extension_factor(
        candidate_main_positions,
        anal_component,
        anal_target,
        fork_length,
        "vertical",
        "ventral",
    )
    extend_component_vertices(candidate_main_positions, anal_component, anal_factor, "vertical")
    anal_config = component_point_deformer(anal_component, global_main_positions, anal_factor, "vertical")
'''
    text = replace_once(text, old_block, new_block, "replace naive fin factors")

    old_controls = '''            "pectoralFactors": vector(pectoral_factors),
            "secondDorsalFactor": clean_float(second_dorsal_factor),
            "analFactor": clean_float(anal_factor),
'''
    new_controls = '''            "pectoralFactors": vector(pectoral_factors),
            "pectoralSolvedMetrics": vector(pectoral_solved_metrics),
            "secondDorsalFactor": clean_float(second_dorsal_factor),
            "secondDorsalSolvedMetric": clean_float(second_dorsal_solved_metric),
            "analFactor": clean_float(anal_factor),
            "analSolvedMetric": clean_float(anal_solved_metric),
'''
    text = replace_once(text, old_controls, new_controls, "record solved fin metrics")

    TARGET.write_text(text, encoding="utf-8")
    print(
        "Candidate A fin solver patched: nonlinear root-pinned targets will now be "
        "solved against final measured geometry."
    )


if __name__ == "__main__":
    main()
