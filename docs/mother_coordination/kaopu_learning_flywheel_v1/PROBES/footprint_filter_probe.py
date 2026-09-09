#!/usr/bin/env python3
"""KAOPU candidate probe: footprint-aware evaluation for typed plane waves.

This is a sampling-contract test, not a claim that sinusoidal sums are a universal
natural-world basis. It compares point samples against exact rectangular cell
averages, then verifies the analytic sinc footprint filter by numerical quadrature.
Standard library only.
"""

from __future__ import annotations

import json
import math
import random

SEED = 20260909
GRID = 32
SUBSAMPLES = 24
OCTAVES = 8
ROUGHNESS = 0.58


def sinc(x: float) -> float:
    if abs(x) < 1e-14:
        return 1.0
    return math.sin(math.pi * x) / (math.pi * x)


def build_waves():
    rng = random.Random(SEED)
    waves = []
    for octave in range(OCTAVES):
        frequency = float(2**octave)
        amplitude = ROUGHNESS**octave
        theta = rng.random() * 2.0 * math.pi
        phase = rng.random() * 2.0 * math.pi
        waves.append((frequency, amplitude, theta, phase))
    return waves


def point_value(x: float, y: float, waves) -> float:
    total = 0.0
    for frequency, amplitude, theta, phase in waves:
        u = math.cos(theta)
        v = math.sin(theta)
        total += amplitude * math.sin(2.0 * math.pi * frequency * (u * x + v * y) + phase)
    return total


def exact_box_average(cx: float, cy: float, dx: float, dy: float, waves) -> float:
    total = 0.0
    for frequency, amplitude, theta, phase in waves:
        u = math.cos(theta)
        v = math.sin(theta)
        footprint_weight = sinc(frequency * u * dx) * sinc(frequency * v * dy)
        center_phase = 2.0 * math.pi * frequency * (u * cx + v * cy) + phase
        total += amplitude * footprint_weight * math.sin(center_phase)
    return total


def numerical_box_average(cx: float, cy: float, dx: float, dy: float, waves) -> float:
    total = 0.0
    for sy in range(SUBSAMPLES):
        oy = ((sy + 0.5) / SUBSAMPLES - 0.5) * dy
        for sx in range(SUBSAMPLES):
            ox = ((sx + 0.5) / SUBSAMPLES - 0.5) * dx
            total += point_value(cx + ox, cy + oy, waves)
    return total / float(SUBSAMPLES * SUBSAMPLES)


def metrics(candidate, reference):
    errors = [a - b for a, b in zip(candidate, reference)]
    mse = sum(e * e for e in errors) / len(errors)
    mae = sum(abs(e) for e in errors) / len(errors)
    return {
        "rmse": math.sqrt(mse),
        "mae": mae,
        "maxAbs": max(abs(e) for e in errors),
    }


def main() -> int:
    waves = build_waves()
    dx = 1.0 / GRID
    dy = dx
    point_samples = []
    analytic_averages = []
    numeric_averages = []

    for row in range(GRID):
        cy = (row + 0.5) / GRID
        for col in range(GRID):
            cx = (col + 0.5) / GRID
            point_samples.append(point_value(cx, cy, waves))
            analytic_averages.append(exact_box_average(cx, cy, dx, dy, waves))
            numeric_averages.append(numerical_box_average(cx, cy, dx, dy, waves))

    point_error = metrics(point_samples, analytic_averages)
    quadrature_error = metrics(numeric_averages, analytic_averages)

    result = {
        "schema": "kaopu-footprint-filter-probe/r1",
        "status": "candidate-math-probe",
        "seed": SEED,
        "grid": [GRID, GRID],
        "cellWidth": dx,
        "subsamplesPerAxis": SUBSAMPLES,
        "octaves": OCTAVES,
        "frequenciesCyclesPerUnit": [w[0] for w in waves],
        "roughness": ROUGHNESS,
        "comparison": {
            "rawPointSampleVsExactCellAverage": point_error,
            "numericalCellAverageVsAnalyticSincAverage": quadrature_error,
        },
        "interpretation": {
            "analyticSincAverage": "exact rectangular-footprint average for this plane-wave basis",
            "rawPointSample": "does not represent unresolved high frequencies as a pixel/page-footprint average",
            "scope": "sampling-contract evidence only; not a universal natural-world basis claim",
        },
    }

    # The analytic footprint formula should agree closely with dense quadrature.
    # This tolerance is for this deterministic CPU probe only, not a production GPU budget.
    if quadrature_error["rmse"] > 2.0e-3:
        raise SystemExit("FAIL: analytic footprint average disagrees with numerical quadrature")

    # Require this fixture to actually expose a measurable point-sampling problem.
    if point_error["rmse"] <= 1.0e-3:
        raise SystemExit("FAIL: fixture did not expose meaningful point-sampling error")

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
