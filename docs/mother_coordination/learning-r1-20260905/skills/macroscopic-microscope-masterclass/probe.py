"""Independent CPU checks for the Macroscopic microscope teaching contract.

This file evaluates a derived scalar subexpression and coordinate contracts only.
It does not reproduce the original shader, its ray marcher, any landscape, cloud,
PBR material, browser rendering, or production asset.
"""
from __future__ import annotations

import json
import math
import platform
import time
from dataclasses import dataclass

import numpy as np


TAU = 2.0 * math.pi


def _points(value: np.ndarray) -> np.ndarray:
    p = np.asarray(value, dtype=np.float64)
    if p.ndim != 2 or p.shape[1] != 3 or not np.isfinite(p).all():
        raise ValueError("finite N by 3 points required")
    return p


def kernel(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Derived C(u,v,w) and its local-coordinate gradient."""
    p = _points(p)
    cu, cv, cw = np.cos(p).T
    su, sv, sw = np.sin(p).T
    phase = cu * (cw + cv) + cv * cv
    sp = np.sin(phase)
    grad = np.column_stack(
        (
            sp * su * (cw + cv),
            sp * sv * (cu + 2.0 * cv),
            sp * sw * cu,
        )
    )
    return np.cos(phase), grad


def detail(p: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    p = _points(p)
    if type(count) is not int or not 1 <= count <= 17:
        raise ValueError("count must be an integer from 1 through 17")
    value = np.zeros(len(p), dtype=np.float64)
    grad = np.zeros_like(p)
    for level in range(count):
        frequency = float(2**level)
        term, derivative = kernel(p * frequency)
        value += term / frequency
        grad += derivative
    return value, grad


def log_direction_map(q: np.ndarray, t: float) -> np.ndarray:
    q = _points(q)
    if not math.isfinite(t):
        raise ValueError("finite time required")
    radius = np.linalg.norm(q, axis=1)
    planar = np.hypot(q[:, 0], q[:, 1])
    if np.any(radius <= 1e-10) or np.any(planar <= 1e-10):
        raise ValueError("origin and angular pole excluded")
    return np.column_stack(
        (
            np.log2(radius) - 2.0 - 0.3 * t,
            -q[:, 2] / radius - 1.0,
            np.arctan2(q[:, 0], q[:, 1]),
        )
    )


def rotation(axis: np.ndarray, angle: float) -> np.ndarray:
    axis = np.asarray(axis, dtype=np.float64)
    if axis.shape != (3,) or not np.isfinite(axis).all() or not math.isfinite(angle):
        raise ValueError("finite axis and angle required")
    length = np.linalg.norm(axis)
    if length <= 1e-12:
        raise ValueError("nonzero axis required")
    x, y, z = axis / length
    c, s, k = math.cos(angle), math.sin(angle), 1.0 - math.cos(angle)
    return np.array(
        [
            [c + x * x * k, x * y * k - z * s, x * z * k + y * s],
            [y * x * k + z * s, c + y * y * k, y * z * k - x * s],
            [z * x * k - y * s, z * y * k + x * s, c + z * z * k],
        ],
        dtype=np.float64,
    )


def local_warp(p: np.ndarray, strength: float) -> np.ndarray:
    """A team-authored example of a position-dependent coordinate rotation."""
    p = _points(p)
    out = np.empty_like(p)
    for index, point in enumerate(p):
        angle1 = strength * 0.55 * math.sin(0.7 * point[1]) * math.exp(-0.03 * np.dot(point, point))
        q = rotation(np.array([0.3, 0.9, 0.2]), angle1) @ point
        angle2 = strength * 0.17 * math.sin(2.3 * q[0] - 1.1 * q[2])
        out[index] = rotation(np.array([-0.7, 0.2, 0.65]), angle2) @ q
    return out


def envelope(points: np.ndarray) -> np.ndarray:
    p = _points(points)
    r2 = (p[:, 0] / 1.8) ** 2 + (p[:, 1] / 1.2) ** 2 + (p[:, 2] / 1.5) ** 2
    return np.clip(1.0 - r2, 0.0, 1.0) ** 2


def cloud_density(points: np.ndarray, count: int, gain: float) -> np.ndarray:
    p = _points(points)
    base = detail(p * np.array([0.8, 0.55, 0.8]), count)[0]
    centered = base - np.mean(base)
    return envelope(p) * np.maximum(0.0, 0.42 + gain * centered)


def transmittance(density: np.ndarray, step_m: float, sigma: float) -> float:
    values = np.asarray(density, dtype=np.float64)
    if values.ndim != 1 or not np.isfinite(values).all() or np.any(values < 0):
        raise ValueError("finite nonnegative one-dimensional density required")
    if not math.isfinite(step_m + sigma) or step_m < 0 or sigma < 0:
        raise ValueError("nonnegative finite step and extinction required")
    return math.exp(-sigma * step_m * float(values.sum()))


@dataclass(frozen=True)
class Result:
    name: str
    passed: bool


def run() -> dict:
    started = time.perf_counter()
    results: list[Result] = []

    def check(name: str, condition: bool) -> None:
        if not condition:
            raise AssertionError(name)
        results.append(Result(name, True))

    rng = np.random.default_rng(20260906)
    p = rng.uniform(-2.2, 2.3, (2048, 3))
    v17, g17 = detail(p, 17)
    v8, g8 = detail(p, 8)
    tail_bound = sum(2.0 ** (-j) for j in range(8, 17))
    value_tail = np.abs(v17 - v8)
    gradient_delta = np.linalg.norm(g17 - g8, axis=1)
    check("octave_value_tail_obeys_derived_bound", float(value_tail.max()) <= tail_bound + 1e-13)
    check("small_value_tail_does_not_imply_small_gradient_tail", float(gradient_delta.max()) > 1.0)

    prefix = np.zeros(len(p))
    snapshots = []
    for level in range(17):
        frequency = float(2**level)
        prefix = prefix + kernel(p * frequency)[0] / frequency
        snapshots.append(prefix.copy())
    check("appending_octaves_preserves_existing_prefix", np.array_equal(snapshots[7], detail(p, 8)[0]))
    renormalized8 = snapshots[7] / sum(2.0 ** (-j) for j in range(8))
    renormalized17_prefix = snapshots[7] / sum(2.0 ** (-j) for j in range(17))
    check("count_dependent_normalization_changes_old_components", float(np.max(np.abs(renormalized8 - renormalized17_prefix))) > 1e-3)

    q = rng.uniform(0.2, 2.0, (256, 3)) * np.array([1.0, -1.0, 1.0])
    t0 = 0.7
    dt = 10.0 / 3.0
    mapped0 = log_direction_map(q, t0)
    mapped1 = log_direction_map(q * 2.0, t0 + dt)
    check("doubling_radius_and_advancing_time_preserves_log_map", float(np.max(np.abs(mapped0 - mapped1))) < 1e-13)
    check("same_relation_preserves_derived_detail", float(np.max(np.abs(detail(mapped0, 17)[0] - detail(mapped1, 17)[0]))) < 1e-11)

    shell_ratios = np.array([2.0 ** (TAU / (2**j)) for j in range(10)])
    check("log_coordinate_turns_phase_periods_into_multiplicative_shells", shell_ratios[0] > 70 and shell_ratios[-1] < 1.01)
    check("finer_octaves_create_more_tightly_nested_scale_ratios", np.all(np.diff(shell_ratios) < 0))

    r1 = rotation(np.array([0.2, 1.0, 0.3]), 0.4)
    r2 = rotation(np.array([-0.4, 0.1, 0.9]), -0.7)
    fixed_two = (p @ r1.T) @ r2.T
    fixed_one = p @ (r2 @ r1).T
    check("two_fixed_rotations_collapse_to_one_fixed_rotation", float(np.max(np.abs(fixed_two - fixed_one))) < 1e-13)

    warped = local_warp(p[:128], 1.0)
    fitted, *_ = np.linalg.lstsq(p[:128], warped, rcond=None)
    residual = warped - p[:128] @ fitted
    check("position_dependent_rotation_chain_does_not_collapse_to_one_matrix", float(np.sqrt(np.mean(residual**2))) > 1e-3)
    check("zero_local_warp_strength_is_identity", np.array_equal(local_warp(p[:128], 0.0), p[:128]))

    material_points = rng.uniform(-1.0, 1.0, (128, 3))
    object_rotation = rotation(np.array([0.0, 0.0, 1.0]), 0.83)
    translation = np.array([3.0, -2.0, 1.2])
    world_points = material_points @ object_rotation.T + translation
    recovered = (world_points - translation) @ object_rotation
    material_reference = detail(material_points, 7)[0]
    check("material_field_survives_rigid_object_transform", float(np.max(np.abs(detail(recovered, 7)[0] - material_reference))) < 1e-13)
    check("world_or_camera_sampling_would_make_attached_detail_swim", float(np.max(np.abs(detail(world_points, 7)[0] - material_reference))) > 0.1)

    x = np.linspace(-1.0, 1.0, 65)
    xx, zz = np.meshgrid(x, x, indexing="xy")
    patch = np.column_stack((xx.ravel(), np.full(xx.size, 0.31), zz.ravel()))
    gate = ((1.0 - xx**2) * (1.0 - zz**2) * xx**2).clip(0.0, 1.0)
    displacement = 0.2 * gate * detail(local_warp(patch, 0.7), 10)[0].reshape(xx.shape) / 2.0
    protected = (np.abs(xx) == 1.0) | (np.abs(zz) == 1.0) | (xx == 0.0)
    check("bounded_gate_preserves_declared_structure_samples", float(np.max(np.abs(displacement[protected]))) == 0.0)
    check("bounded_gate_limits_synthetic_geometry_displacement", float(np.max(np.abs(displacement))) <= 0.2 + 1e-12)

    cloud_points = rng.uniform(-2.0, 2.0, (4096, 3))
    rho = cloud_density(cloud_points, 8, 0.35)
    check("cloud_density_role_is_nonnegative", float(rho.min()) >= 0.0)
    outside = np.array([[4.0, 0.0, 0.0], [0.0, 3.0, 0.0]])
    check("cloud_envelope_has_explicit_empty_space", np.array_equal(cloud_density(outside, 8, 0.35), np.zeros(2)))
    check("rock_displacement_and_cloud_density_are_distinct_semantic_outputs", displacement.shape != rho.shape and np.min(rho) >= 0.0 and np.min(displacement) < 0.0)

    line = np.linspace(0.1, 0.9, 64)
    t64 = transmittance(line, 0.05, 0.7)
    t128 = transmittance(np.repeat(line, 2), 0.025, 0.7)
    check("subdividing_same_optical_path_preserves_transmittance", abs(t64 - t128) < 1e-14)
    check("denser_volume_reduces_transmittance", transmittance(2.0 * line, 0.05, 0.7) < t64)

    rejections = 0
    for operation in (
        lambda: detail(np.array([[0.0, math.nan, 0.0]]), 3),
        lambda: detail(p, 18),
        lambda: log_direction_map(np.zeros((1, 3)), 0.0),
        lambda: log_direction_map(np.array([[0.0, 0.0, 1.0]]), 0.0),
        lambda: transmittance(np.array([-1.0]), 0.1, 1.0),
    ):
        try:
            operation()
        except ValueError:
            rejections += 1
    check("invalid_coordinate_and_optical_inputs_are_rejected", rejections == 5)

    return {
        "status": "passed",
        "checks": len(results),
        "names": [r.name for r in results],
        "environment": {"python": platform.python_version(), "numpy": np.__version__, "platform": platform.platform()},
        "elapsed_ms": round((time.perf_counter() - started) * 1000.0, 3),
        "derived_metrics": {
            "eight_to_seventeen_value_tail_max": float(value_tail.max()),
            "eight_to_seventeen_gradient_delta_max": float(gradient_delta.max()),
            "tail_bound": float(tail_bound),
            "multiplicative_shell_ratios_first_ten": shell_ratios.tolist(),
            "nonlinear_rotation_best_linear_fit_rms": float(np.sqrt(np.mean(residual**2))),
            "synthetic_patch_max_displacement": float(np.max(np.abs(displacement))),
            "cloud_density_max": float(rho.max()),
            "optical_transmittance": t64,
        },
        "scope": "Derived scalar field, coordinate, gating, role separation, and absorption-only contracts.",
        "limits": [
            "No original shader execution, image match, ray-march safety, or exact signed-distance proof.",
            "No real landscape, cloud, material, browser, GPU, collision, scattering, or production integration.",
            "The position-dependent rotation is a team-authored teaching extension, not an attribution to the artist.",
            "The optical query checks absorption only and does not validate cloud multiple scattering.",
        ],
        "productionIntegration": False,
        "visualAcceptance": False,
        "productionReady": False,
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, ensure_ascii=False, allow_nan=False))
