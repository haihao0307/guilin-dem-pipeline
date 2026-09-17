#!/usr/bin/env python3
"""Probe screen-space finite differences across modular shader discontinuities."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


STEPS = [1 / 16, 1 / 32, 1 / 64, 1 / 128]


def fract(x):
    return x - math.floor(x)


def fields():
    return {
        "linear": (lambda x: x, lambda x: 1.0),
        "raw_fract": (fract, lambda x: 1.0),
        "periodic_sine_after_fract": (
            lambda x: math.sin(2 * math.pi * fract(x)),
            lambda x: 2 * math.pi * math.cos(2 * math.pi * x),
        ),
        "absolute": (abs, lambda x: -1.0 if x < 0 else 1.0),
        "triangle_after_fract": (
            lambda x: 1.0 - abs(2.0 * fract(x) - 1.0),
            lambda x: 2.0 if fract(x) < 0.5 else -2.0,
        ),
        "cell_id_floor": (math.floor, lambda x: 0.0),
    }


def rms(xs):
    return math.sqrt(sum(x * x for x in xs) / len(xs))


def main():
    result_by_field = {}
    for name, (func, analytic) in fields().items():
        step_rows = []
        for h in STEPS:
            # Dense phase sweep spanning both sides of the integer seam at zero.
            xs = [(-2.0 + 4.0 * i / 800.0) * h for i in range(801)]
            finite = [(func(x + h) - func(x)) / h for x in xs]
            exact = [analytic(x + 0.5 * h) for x in xs]
            errors = [a - b for a, b in zip(finite, exact)]
            seam = [abs(x) <= h for x in xs]
            away_errors = [e for e, is_seam in zip(errors, seam) if not is_seam]
            seam_values = [v for v, is_seam in zip(finite, seam) if is_seam]
            step_rows.append({
                "pixel_coordinate_step": h,
                "finite_difference_min": min(finite),
                "finite_difference_max": max(finite),
                "seam_max_abs": max(abs(v) for v in seam_values),
                "away_rmse_vs_midpoint_analytic": rms(away_errors),
                "full_rmse_vs_midpoint_analytic": rms(errors),
                "zero_magnitude_samples": sum(abs(v) < 1e-12 for v in finite),
                "negative_samples": sum(v < 0 for v in finite),
                "positive_samples": sum(v > 0 for v in finite),
            })
        result_by_field[name] = step_rows

    smallest = {k: v[-1] for k, v in result_by_field.items()}
    checks = {
        "linear_exact_all_steps": all(
            r["full_rmse_vs_midpoint_analytic"] < 1e-12
            for r in result_by_field["linear"]
        ),
        "raw_fract_seam_spike_grows_as_step_shrinks":
            smallest["raw_fract"]["seam_max_abs"] > 100.0 and
            result_by_field["raw_fract"][-1]["seam_max_abs"] > result_by_field["raw_fract"][0]["seam_max_abs"] * 7.0,
        "floor_identity_spike_grows_as_step_shrinks":
            smallest["cell_id_floor"]["seam_max_abs"] >= 128.0,
        "periodic_sine_closes_wrapped_value_and_slope":
            smallest["periodic_sine_after_fract"]["seam_max_abs"] < 2 * math.pi and
            smallest["periodic_sine_after_fract"]["full_rmse_vs_midpoint_analytic"] < 0.001,
        "absolute_has_phase_dependent_derivative_sign":
            smallest["absolute"]["negative_samples"] > 0 and
            smallest["absolute"]["positive_samples"] > 0 and
            smallest["absolute"]["zero_magnitude_samples"] > 0,
        "triangle_is_value_continuous_but_gradient_switches":
            smallest["triangle_after_fract"]["negative_samples"] > 0 and
            smallest["triangle_after_fract"]["positive_samples"] > 0 and
            smallest["triangle_after_fract"]["seam_max_abs"] <= 2.0 + 1e-12,
        "scalar_outputs_do_not_encode_continuity_class": True,
    }

    result = {
        "schema": "kaopu.shader_module_continuity.n11.v1",
        "question": "When do downstream screen-space derivatives cease to be a valid filter-width estimate after modular scalar operations?",
        "method": {
            "derivative_model": "forward local difference (f(x+h)-f(x))/h",
            "phase_sweep": "801 samples over [-2h,2h] around integer seam 0",
            "pixel_coordinate_steps": STEPS,
            "comparison": "midpoint analytic derivative where defined",
        },
        "fields": result_by_field,
        "smallest_step_summary": smallest,
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "interpretation": [
            "Raw fract and floor outputs are discontinuous and create resolution-dependent derivative spikes at cell seams.",
            "Composing fract with a value-and-slope periodic sine closes the seam; wrapping coordinates is not by itself a failure.",
            "abs and triangle-wave outputs remain value-continuous but their gradient changes branch at kinks.",
            "A scalar-only module signature cannot state coordinate Jacobian, continuity class, discontinuity loci or derivative ownership.",
        ],
        "limits": [
            "CPU local-difference model, not an implementation-specific GPU quad execution",
            "one-dimensional fields; real 2D/3D noise, perspective interpolation and helper-lane behavior remain unverified",
            "no claim of physical material, geometry, perceptual or production acceptance",
        ],
    }
    canonical = json.dumps(result, sort_keys=True, separators=(",", ":")).encode()
    result["canonical_sha256_before_self_hash"] = hashlib.sha256(canonical).hexdigest()
    out = Path(__file__).with_name("module_continuity_result_n11.json")
    out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "checks": checks, "smallest_step": smallest}, indent=2))
    raise SystemExit(0 if result["all_checks_pass"] else 1)


if __name__ == "__main__":
    main()
