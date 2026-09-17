#!/usr/bin/env python3
"""Compare shader derivative edge-width heuristics with exact pixel-box coverage."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


ANGLES_DEG = list(range(0, 91, 5))
SCALES = [0.25, 0.5, 1.0, 2.0, 4.0]
OFFSETS = [(-0.8 + i * 1.6 / 320.0) for i in range(321)]
METHODS = ["hard", "fixed_smooth", "euclidean_smooth", "fwidth_smooth", "fwidth_linear"]


def clip_half_plane(poly, nx, ny, c):
    """Clip polygon to nx*x + ny*y + c <= 0."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        fp = nx * p[0] + ny * p[1] + c
        fq = nx * q[0] + ny * q[1] + c
        pin, qin = fp <= 0.0, fq <= 0.0
        if pin:
            out.append(p)
        if pin != qin:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def area(poly):
    if len(poly) < 3:
        return 0.0
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] -
                   poly[(i + 1) % len(poly)][0] * poly[i][1]
                   for i in range(len(poly))) * 0.5)


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def prediction(method, value, dfdx, dfdy):
    if method == "hard":
        return 1.0 if value <= 0.0 else 0.0
    if method == "fixed_smooth":
        half_width = 0.5
        return 1.0 - smoothstep(-half_width, half_width, value)
    if method == "euclidean_smooth":
        # glsl-aastep: afwidth = length(vec2(dFdx, dFdy)) * 1/sqrt(2)
        half_width = math.hypot(dfdx, dfdy) / math.sqrt(2.0)
        return 1.0 - smoothstep(-half_width, half_width, value)
    half_width = 0.5 * (abs(dfdx) + abs(dfdy))
    if method == "fwidth_smooth":
        return 1.0 - smoothstep(-half_width, half_width, value)
    if method == "fwidth_linear":
        if half_width == 0.0:
            return 1.0 if value <= 0.0 else 0.0
        return max(0.0, min(1.0, 0.5 - value / (2.0 * half_width)))
    raise ValueError(method)


def metrics(errors):
    return {
        "mae": sum(abs(e) for e in errors) / len(errors),
        "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
        "max_abs": max(abs(e) for e in errors),
    }


def main():
    square = [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]
    all_errors = {m: [] for m in METHODS}
    by_angle = {m: {} for m in METHODS}
    by_scale = {m: {} for m in METHODS}

    for scale in SCALES:
        scale_errors = {m: [] for m in METHODS}
        for deg in ANGLES_DEG:
            theta = math.radians(deg)
            nx, ny = math.cos(theta), math.sin(theta)
            angle_errors = {m: [] for m in METHODS}
            for normalized_offset in OFFSETS:
                value = scale * normalized_offset
                exact = area(clip_half_plane(square, nx, ny, normalized_offset))
                for method in METHODS:
                    pred = prediction(method, value, scale * nx, scale * ny)
                    err = pred - exact
                    all_errors[method].append(err)
                    angle_errors[method].append(err)
                    scale_errors[method].append(err)
            for method in METHODS:
                by_angle[method].setdefault(str(deg), []).extend(angle_errors[method])
        for method in METHODS:
            by_scale[method][str(scale)] = metrics(scale_errors[method])

    summary = {m: metrics(all_errors[m]) for m in METHODS}
    by_angle_metrics = {m: {} for m in METHODS}
    for method in METHODS:
        by_angle_metrics[method] = {deg: metrics(errs) for deg, errs in by_angle[method].items()}
        rmses = {deg: item["rmse"] for deg, item in by_angle_metrics[method].items()}
        summary[method]["best_angle_deg"] = min(rmses, key=rmses.get)
        summary[method]["worst_angle_deg"] = max(rmses, key=rmses.get)
        summary[method]["angle_rmse_range"] = max(rmses.values()) - min(rmses.values())
        scale_rmses = [v["rmse"] for v in by_scale[method].values()]
        summary[method]["scale_rmse_range"] = max(scale_rmses) - min(scale_rmses)

    checks = {
        "hard_not_coverage": summary["hard"]["rmse"] > 0.1,
        "fixed_width_scale_dependent": summary["fixed_smooth"]["scale_rmse_range"] > 0.02,
        "derivative_methods_scale_invariant": all(
            summary[m]["scale_rmse_range"] < 1e-12
            for m in ["euclidean_smooth", "fwidth_smooth", "fwidth_linear"]
        ),
        "euclidean_lower_rmse_than_fwidth_smooth":
            summary["euclidean_smooth"]["rmse"] < summary["fwidth_smooth"]["rmse"],
        "smooth_fwidth_lower_rmse_than_linear_fwidth":
            summary["fwidth_smooth"]["rmse"] < summary["fwidth_linear"]["rmse"],
        "linear_fwidth_exact_for_axis_aligned_edge":
            by_angle_metrics["fwidth_linear"]["0"]["max_abs"] < 1e-12,
        "no_tested_estimator_exact": all(summary[m]["max_abs"] > 0.01 for m in METHODS),
    }

    result = {
        "schema": "kaopu.derivative_coverage_probe.n10.v1",
        "question": "How do fixed, Euclidean-derivative and fwidth edge widths compare with exact pixel-box coverage across rotation and scale?",
        "coordinate_contract": {
            "pixel": "unit square [-0.5,0.5]^2",
            "edge": "linear half-plane n dot p + normalized_offset <= 0",
            "exact_reference": "polygon clipped against half-plane; area is exact pixel-box coverage",
            "angles_deg": ANGLES_DEG,
            "scalar_gradient_scales": SCALES,
            "normalized_offset_count": len(OFFSETS),
        },
        "methods": {
            "hard": "step at pixel center",
            "fixed_smooth": "1-smoothstep(-0.5,0.5,value), fixed scalar-space width",
            "euclidean_smooth": "glsl-aastep width length(vec2(dFdx,dFdy))/sqrt(2)",
            "fwidth_smooth": "1-smoothstep(-0.5*fwidth,0.5*fwidth,value)",
            "fwidth_linear": "linear ramp over one fwidth",
        },
        "summary": summary,
        "by_angle": by_angle_metrics,
        "by_scale": by_scale,
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "limits": [
            "CPU analytic straight-edge model, not a GPU derivative execution",
            "single pixel box filter, no MSAA, perspective curvature, texture sampling or postprocessing",
            "coverage accuracy is not a perceptual or production acceptance result",
        ],
    }
    canonical = json.dumps(result, sort_keys=True, separators=(",", ":")).encode()
    result["canonical_sha256_before_self_hash"] = hashlib.sha256(canonical).hexdigest()
    out = Path(__file__).with_name("derivative_coverage_result_n10.json")
    out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "checks": checks, "summary": summary}, indent=2))
    raise SystemExit(0 if result["all_checks_pass"] else 1)


if __name__ == "__main__":
    main()
