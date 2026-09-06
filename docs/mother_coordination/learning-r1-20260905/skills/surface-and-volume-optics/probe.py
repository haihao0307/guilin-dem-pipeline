"""Independent scalar optics and storage arithmetic. No renderer or fluid solver.
Inputs 1.33 (water) and 1.52 (plate glass) are illustrative values in Adobe's
PBR Guide Part 1. Transmission-depth model follows OpenPBR, absorption-only.
"""
from __future__ import annotations
import hashlib
import json
import math
import platform
from pathlib import Path


def f0(n_inside: float, n_outside: float = 1.0) -> float:
    if not all(math.isfinite(n) and n > 0 for n in (n_inside, n_outside)):
        raise ValueError('Refractive indices must be positive and finite.')
    return ((n_inside - n_outside) / (n_inside + n_outside)) ** 2


def transmission(sigma: float, length: float) -> float:
    if not all(math.isfinite(v) and v >= 0 for v in (sigma, length)):
        raise ValueError('Extinction and path length must be finite and nonnegative.')
    return math.exp(-sigma * length)


def tint_depth(color: float, depth: float, length: float) -> float:
    if not 0 < color <= 1 or not math.isfinite(depth) or depth <= 0:
        raise ValueError('Positive depth and color in (0, 1] required; zero-depth UI mode excluded.')
    return transmission(-math.log(color) / depth, length)


def scalar_double_buffer_bytes(n: int) -> int:
    if not isinstance(n, int) or n < 1:
        raise ValueError('Positive cubic grid dimension required.')
    return n ** 3 * 4 * 2


def run() -> dict:
    names: list[str] = []
    def check(name: str, condition: bool) -> None:
        if not condition:
            raise AssertionError(name)
        names.append(name)
    check('water_f0_from_illustrative_ior', abs(f0(1.33) - 0.020059312199524774) < 1e-14)
    check('plate_glass_f0_from_illustrative_ior', abs(f0(1.52) - 0.042579994960947345) < 1e-14)
    check('interface_uses_both_media', 0 < f0(1.52, 1.33) < f0(1.52, 1.0))
    check('matched_indices_have_zero_f0', f0(1.33, 1.33) == 0)
    check('vacuum_and_zero_distance_transmit_fully', transmission(0, 3) == transmission(3, 0) == 1)
    check('transmission_multiplies_across_segments', math.isclose(transmission(.7, 2) * transmission(.7, 3), transmission(.7, 5)))
    check('doubling_density_squares_beam_transmission', math.isclose(transmission(1.4, 5), transmission(.7, 5) ** 2))
    ts = [math.prod([transmission(.7, 5 / n)] * n) for n in (16, 32, 128)]
    check('homogeneous_ray_step_count_does_not_change_optical_thickness', all(abs(t - transmission(.7, 5)) < 1e-14 for t in ts))
    check('changing_path_length_changes_tint', tint_depth(.5, 2, 4) < tint_depth(.5, 2, 1))
    check('larger_reference_depth_reduces_absorption_at_fixed_path', tint_depth(.5, 4, 1) > tint_depth(.5, 2, 1))
    check('consistent_centimeters_and_meters', math.isclose(tint_depth(.5, 200, 100), tint_depth(.5, 2, 1)))
    # Same extinction permits different scattering fractions. No rendered brightness claim.
    check('equal_extinction_does_not_fix_scattering_albedo', math.isclose(.9 + .1, .1 + .9) and .1 / 1 != .9 / 1)
    tau = 1e-15
    check('small_segment_alpha_is_finite_and_positive', 0 < -math.expm1(-tau) < 2 * tau)
    check('doubling_grid_dimension_multiplies_storage_by_eight', scalar_double_buffer_bytes(256) == 8 * scalar_double_buffer_bytes(128))
    invalid = 0
    for sigma, length in [(-1, 1), (1, -1), (float('nan'), 1), (1, float('inf'))]:
        try:
            transmission(sigma, length)
        except ValueError:
            invalid += 1
    check('invalid_optical_inputs_rejected', invalid == 4)
    return {
        'status': 'passed', 'checks': len(names), 'names': names,
        'environment': {'python': platform.python_version(), 'platform': platform.platform()},
        'probe_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'examples': {'water_F0': f0(1.33), 'plate_glass_F0': f0(1.52),
                     'optical_depth_3_transmission': math.exp(-3),
                     'optical_depth_5_transmission': math.exp(-5),
                     'one_float32_scalar_double_buffer_MiB': {str(n): scalar_double_buffer_bytes(n) / 2 ** 20 for n in (64, 128, 256)}},
        'scope': 'Independent scalar identities and unpadded one-field storage arithmetic only.',
        'limitations': ['No shader, BRDF integration, actual GPU allocation, or fluid runtime.',
                       'No smoke quality, frame rate, device performance, or aerodynamics validation.',
                       'Illustrative IOR values are not calibration for every water/glass composition.'],
        'adobe_designer_run': False, 'browser_gpu_run': False,
        'productionIntegration': False, 'visualAcceptance': False, 'productionReady': False
    }


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False, indent=2))
