#!/usr/bin/env python3
"""KAOPU Y01: source-core algebra and synthetic counterexamples, not a renderer.
Source expression: Yohei Nishitsuji, Codrops 2025-02-18, Macroscopic microscope.
No production asset, GPU, collision, geology, or author-video equivalence is tested.
Run: python yohei_core_audit_y01.py [result.json]
"""
from __future__ import annotations
import hashlib
import json
import math
import platform
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

SOURCE = 'https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/'


def scales(limit: float = 1e5) -> list[float]:
    if not math.isfinite(limit) or limit <= 1:
        raise ValueError('limit must be finite and greater than one')
    values, scale = [], 1.0
    while scale < limit:
        values.append(scale)
        scale *= 2.0
    return values


def kernel(p: tuple[float, float, float], scale: float) -> float:
    """Algebraic expansion of the published inner summand only."""
    x, y, z = (v * scale for v in p)
    cx, cy, cz = math.cos(x), math.cos(y), math.cos(z)
    return math.cos(cz * cx + cy * cy + cy * cx) / scale


def gradient(p: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    x, y, z = (v * scale for v in p)
    cx, cy, cz = math.cos(x), math.cos(y), math.cos(z)
    factor = math.sin(cz * cx + cy * cy + cy * cx)
    return (factor * math.sin(x) * (cz + cy),
            factor * math.sin(y) * (2 * cy + cx),
            factor * math.sin(z) * cx)


def chart(p: tuple[float, float, float], time: float = 0.0) -> tuple[float, float, float]:
    """Explicitly REJECT singular inputs; this is our audit policy, not original code."""
    x, y, z = p
    radius = math.sqrt(x*x + y*y + z*z)
    if radius <= 0 or x*x + y*y <= 0:
        raise ValueError('undefined origin or angular axis; patch/transition required')
    return (math.log2(radius) - 2 - time * .3, -z / radius, math.atan2(x, y))


def torus_mean(n: int) -> float:
    """Uniform unwarped periodic domain; not a universal mean after a domain warp."""
    c = [math.cos(2*math.pi*(i+.5)/n) for i in range(n)]
    return math.fsum(math.cos(cz*cx + cy*cy + cy*cx)
                     for cx in c for cy in c for cz in c) / (n**3)


def audit() -> dict:
    checks, metrics = {}, {}
    ss = scales()
    checks['published_inner_loop_has_17_terms'] = len(ss) == 17 and ss[-1] == 65536
    metrics['scales'] = ss
    # Seed fixed for reproducibility. These are synthetic points, not observations.
    rng = random.Random(20260916)
    points = [tuple(rng.uniform(-2, 2) for _ in range(3)) for _ in range(64)]
    eps, errors = 1e-6, []
    for p in points:
        for s in (1.0, 2.0, 4.0, 8.0):
            g = gradient(p, s)
            for j in range(3):
                plus, minus = list(p), list(p)
                plus[j] += eps
                minus[j] -= eps
                fd = (kernel(tuple(plus), s)-kernel(tuple(minus), s))/(2*eps)
                errors.append(abs(fd-g[j]))
    metrics['analytic_gradient_max_abs_error_vs_central_difference'] = max(errors)
    checks['inner_kernel_analytic_gradient_matches'] = max(errors) < 1e-7
    m32, m64 = torus_mean(32), torus_mean(64)
    metrics['unwarped_torus_means'] = {'n32': m32, 'n64': m64, 'difference': abs(m32-m64)}
    checks['kernel_is_not_zero_mean_on_test_domain'] = abs(m64) > 0.1 and abs(m32-m64) < 1e-9
    tail = math.fsum(1/s for s in ss[8:])
    metrics['eight_to_seventeen_terms'] = {'height_tail_abs_bound': tail,
        'mean_tail_on_test_torus': m64 * tail}
    diffs = [abs(math.fsum(kernel(p,s) for s in ss[8:])) for p in points]
    checks['sampled_tail_respects_height_bound'] = max(diffs) <= tail + 1e-14
    # Counterexample h_N(x) = sum sin(2^k*x)/2^k. Derivatives are exact.
    metrics['one_dimensional_counterexample'] = {
        'N8': {'height_abs_bound': math.fsum(2**(-k) for k in range(8)),
               'slope_at_zero': 8, 'second_derivative_triangle_bound': 255},
        'N17': {'height_abs_bound': math.fsum(2**(-k) for k in range(17)),
                'slope_at_zero': 17, 'second_derivative_triangle_bound': 131071},
        'highest_term_height_amplitude': 1/65536,
        'highest_term_slope_amplitude': 1,
        'highest_term_second_derivative_amplitude': 65536}
    checks['small_amplitude_does_not_force_small_derivatives'] = 1/65536 < .00002 and 65536 > 10000
    p = (0.7, 0.5, 0.9)
    a, b = chart(p), chart(tuple(2*v for v in p))
    err = max(abs(b[0]-a[0]-1), abs(b[1]-a[1]), abs(b[2]-a[2]))
    metrics['doubling_radius_chart_shift_error'] = err
    checks['radial_dilation_is_chart_translation_not_field_identity'] = err < 1e-12
    radial = [1/(r*math.log(2)) for r in (1, .01, .0001)]
    metrics['log_radius_gradient_norm_at_selected_radii'] = radial
    checks['log_chart_derivative_amplifies_near_origin'] = abs(radial[-1]/radial[0]-10000) < 1e-8
    rejected = 0
    for bad in ((0., 0., 0.), (0., 0., 1.)):
        try:
            chart(bad)
        except ValueError:
            rejected += 1
    checks['audit_policy_rejects_singular_points'] = rejected == 2
    d = (.2, -.4, 1.)
    metrics['componentwise_d_divide_negative_d'] = [v/(-v) for v in d]
    checks['ray_expression_is_not_general_direction_negation'] = [v/(-v) for v in d] != [-v for v in d]
    # Beer-Lambert sanity case; extinction is per metre and segment length is metres.
    sigma, length = .37, 3.0
    expected = math.exp(-sigma*length)
    transmissions = {str(n): math.prod(math.exp(-sigma*length/n) for _ in range(n))
                     for n in (8, 16, 32, 64)}
    metrics['homogeneous_volume'] = {'sigma_per_metre': sigma, 'length_m': length,
        'expected_T': expected, 'step_counts_T': transmissions,
        'incorrect_fixed_alpha_T': {str(n): (1-.05)**n for n in (8,16,32,64)}}
    checks['physical_segment_transmittance_is_partition_invariant'] = max(abs(v-expected) for v in transmissions.values()) < 1e-13
    checks['fixed_alpha_per_sample_fails_same_volume_test'] = abs((1-.05)**8 - (1-.05)**64) > .5
    values1 = [math.fsum(kernel(p,s) for s in ss) for p in points]
    values2 = [math.fsum(kernel(p,s) for s in ss) for p in points]
    checks['same_process_same_inputs_repeat_exactly'] = values1 == values2
    metrics['source_loop_cost_estimate_not_gpu_benchmark'] = {
        'outer_iterations_assuming_explicit_i_zero': 119,
        'inner_terms_per_outer': 17,
        'inner_terms_per_pixel': 119*17,
        'inner_terms_per_1920x1080_frame': 1920*1080*119*17}
    return {'id':'KAOPU-YOHEI-Y01-20260916', 'observed_at_utc':datetime.now(timezone.utc).isoformat(),
        'evidence_class':'synthetic CPU algebra checks; no original-video equivalence',
        'source':SOURCE, 'python':platform.python_version(),
        'probe_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'checks':checks, 'passed':sum(checks.values()), 'total':len(checks), 'metrics':metrics,
        'not_tested':['GLSL compilation','GPU rendering','browser/public URL','iPhone performance',
            '#261 exact source','cloud artwork equivalence','geological validity','production bug cause',
            'Mother adoption','user visual acceptance']}


if __name__ == '__main__':
    result = audit()
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text+'\n', encoding='utf-8')
    print(text)
    sys.exit(0 if result['passed'] == result['total'] else 1)
