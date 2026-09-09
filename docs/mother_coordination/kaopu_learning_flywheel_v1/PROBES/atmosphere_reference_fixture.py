#!/usr/bin/env python3
"""Synthetic KAOPU atmosphere evaluator contract probe.

This is NOT an Earth atmosphere truth model. It intentionally uses a tiny,
unit-explicit exponential atmosphere so that two evaluator families can query
exactly the same AtmosphereState and their approximation error can be measured.

Evaluator A: spherical-geometry numerical reference.
Evaluator B: plane-parallel approximation.

The probe checks transmittance T and single-scattered radiance L1. Its purpose
is architectural: prove that physical state and evaluation policy can be kept
separate, and expose where a cheap evaluator stops being valid.
"""

import json
import math

PLANET_RADIUS_M = 6_371_000.0
SCALE_HEIGHT_M = 8_000.0
TOP_M = 100_000.0
BETA_EXT0_PER_M = 0.1 / SCALE_HEIGHT_M
SINGLE_SCATTERING_ALBEDO = 0.9
BETA_SCAT0_PER_M = BETA_EXT0_PER_M * SINGLE_SCATTERING_ALBEDO
ISOTROPIC_PHASE_SR_INV = 1.0 / (4.0 * math.pi)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def norm(a):
    return math.sqrt(dot(a, a))


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scale(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def ray_exit(r0, direction, radius):
    b = 2.0 * dot(r0, direction)
    c = dot(r0, r0) - radius * radius
    disc = b * b - 4.0 * c
    if disc < 0.0:
        return None
    root = math.sqrt(disc)
    positive = [
        t for t in ((-b - root) / 2.0, (-b + root) / 2.0) if t > 1e-9
    ]
    return max(positive) if positive else None


def density_from_radius(radius_m):
    altitude_m = radius_m - PLANET_RADIUS_M
    if altitude_m < 0.0 or altitude_m > TOP_M:
        return 0.0
    return math.exp(-altitude_m / SCALE_HEIGHT_M)


def tau_numeric(r0, direction, t_max_m, sample_count):
    step_m = t_max_m / sample_count
    density_sum = 0.0
    for i in range(sample_count):
        point = add(r0, scale(direction, (i + 0.5) * step_m))
        density_sum += density_from_radius(norm(point))
    return BETA_EXT0_PER_M * density_sum * step_m


def spherical_reference(observer_altitude_m, view_zenith_deg, sun_zenith_deg,
                        view_samples=500, sun_samples=180):
    r0 = (0.0, 0.0, PLANET_RADIUS_M + observer_altitude_m)
    zv = math.radians(view_zenith_deg)
    zs = math.radians(sun_zenith_deg)
    view = (math.sin(zv), 0.0, math.cos(zv))
    sun = (math.sin(zs), 0.0, math.cos(zs))
    t_max = ray_exit(r0, view, PLANET_RADIUS_M + TOP_M)
    tau_total = tau_numeric(r0, view, t_max, view_samples * 2)
    transmittance = math.exp(-tau_total)

    step_m = t_max / view_samples
    tau_view = 0.0
    radiance_single = 0.0
    for i in range(view_samples):
        point = add(r0, scale(view, (i + 0.5) * step_m))
        density = density_from_radius(norm(point))
        tau_here = tau_view + 0.5 * BETA_EXT0_PER_M * density * step_m
        sun_path_m = ray_exit(point, sun, PLANET_RADIUS_M + TOP_M)
        tau_sun = (
            tau_numeric(point, sun, sun_path_m, sun_samples)
            if sun_path_m is not None
            else float("inf")
        )
        radiance_single += (
            BETA_SCAT0_PER_M
            * density
            * ISOTROPIC_PHASE_SR_INV
            * math.exp(-tau_here - tau_sun)
            * step_m
        )
        tau_view += BETA_EXT0_PER_M * density * step_m

    return {"T": transmittance, "L1": radiance_single, "tau": tau_total}


def plane_parallel_candidate(observer_altitude_m, view_zenith_deg, sun_zenith_deg,
                             sample_count=5000):
    mu_view = math.cos(math.radians(view_zenith_deg))
    mu_sun = math.cos(math.radians(sun_zenith_deg))
    if mu_view <= 0.0 or mu_sun <= 0.0:
        return {"T": None, "L1": None, "tau": None}

    density0 = math.exp(-observer_altitude_m / SCALE_HEIGHT_M)
    path_max_m = (TOP_M - observer_altitude_m) / mu_view
    exp_top = math.exp(-TOP_M / SCALE_HEIGHT_M)
    tau_total = (
        BETA_EXT0_PER_M
        * density0
        * SCALE_HEIGHT_M
        / mu_view
        * (1.0 - math.exp(-(TOP_M - observer_altitude_m) / SCALE_HEIGHT_M))
    )
    transmittance = math.exp(-tau_total)

    step_m = path_max_m / sample_count
    radiance_single = 0.0
    for i in range(sample_count):
        path_m = (i + 0.5) * step_m
        altitude_m = observer_altitude_m + path_m * mu_view
        density = math.exp(-altitude_m / SCALE_HEIGHT_M)
        tau_view = (
            BETA_EXT0_PER_M
            * density0
            * SCALE_HEIGHT_M
            / mu_view
            * (1.0 - math.exp(-path_m * mu_view / SCALE_HEIGHT_M))
        )
        tau_sun = (
            BETA_EXT0_PER_M
            * SCALE_HEIGHT_M
            / mu_sun
            * (math.exp(-altitude_m / SCALE_HEIGHT_M) - exp_top)
        )
        radiance_single += (
            BETA_SCAT0_PER_M
            * density
            * ISOTROPIC_PHASE_SR_INV
            * math.exp(-tau_view - tau_sun)
            * step_m
        )

    return {"T": transmittance, "L1": radiance_single, "tau": tau_total}


def relative_error(candidate, reference):
    return abs(candidate - reference) / abs(reference)


def main():
    queries = [
        {"observer_m": 0.0, "view_zenith_deg": 0.0, "sun_zenith_deg": 45.0},
        {"observer_m": 0.0, "view_zenith_deg": 80.0, "sun_zenith_deg": 45.0},
        {"observer_m": 0.0, "view_zenith_deg": 89.0, "sun_zenith_deg": 45.0},
        {"observer_m": 80_000.0, "view_zenith_deg": 80.0, "sun_zenith_deg": 45.0},
    ]

    output = {
        "fixture": "synthetic-contract-only",
        "notEarthTruth": True,
        "state": {
            "planetRadius_m": PLANET_RADIUS_M,
            "top_m": TOP_M,
            "scaleHeight_m": SCALE_HEIGHT_M,
            "betaExt0_per_m": BETA_EXT0_PER_M,
            "singleScatteringAlbedo": SINGLE_SCATTERING_ALBEDO,
        },
        "queries": [],
    }

    for query in queries:
        reference = spherical_reference(
            query["observer_m"], query["view_zenith_deg"], query["sun_zenith_deg"]
        )
        candidate = plane_parallel_candidate(
            query["observer_m"], query["view_zenith_deg"], query["sun_zenith_deg"]
        )
        output["queries"].append(
            {
                **query,
                "sphericalReference": reference,
                "planeParallelCandidate": candidate,
                "relativeErrorT": relative_error(candidate["T"], reference["T"]),
                "relativeErrorL1": relative_error(candidate["L1"], reference["L1"]),
            }
        )

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
