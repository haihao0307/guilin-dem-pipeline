#!/usr/bin/env python3
"""KAOPU R08 semantic probe for vertical-coordinate contracts.

This is not an Earth-atmosphere truth model. It tests type/adapter invariants.
The spherical radius is explicitly test-only.
"""

TEST_EARTH_RADIUS_M = 6_371_000.0


def geopotential_to_geometric(h_m: float, radius_m: float = TEST_EARTH_RADIUS_M) -> float:
    if h_m < 0 or h_m >= radius_m:
        raise ValueError("geopotential height outside probe domain")
    return radius_m * h_m / (radius_m - h_m)


def agl_to_geoid_height(agl_m: float, terrain_geoid_m: float) -> float:
    return terrain_geoid_m + agl_m


def model_level_to_height(
    level: int,
    *,
    surface_pressure_pa=None,
    a_coefficients=None,
    b_coefficients=None,
    thermodynamic_profile=None,
):
    if (
        surface_pressure_pa is None
        or a_coefficients is None
        or b_coefficients is None
        or thermodynamic_profile is None
    ):
        raise ValueError(
            "hybrid model level is not a fixed geometric height; "
            "source/context is required"
        )
    raise NotImplementedError("probe only checks missing-context rejection")


def main() -> None:
    tests = []

    sea_absolute = agl_to_geoid_height(1000.0, 0.0)
    plateau_absolute = agl_to_geoid_height(1000.0, 1500.0)
    tests.append(
        (
            "same AGL over different terrain -> different absolute placement",
            sea_absolute == 1000.0 and plateau_absolute == 2500.0,
        )
    )

    naive_plateau_agl = 1000.0 - 1500.0
    tests.append(
        (
            "naive fixed absolute cloud shell can fall below plateau terrain",
            naive_plateau_agl == -500.0,
        )
    )

    geometric_10km = geopotential_to_geometric(10_000.0)
    geometric_20km = geopotential_to_geometric(20_000.0)
    tests.append(
        (
            "geopotential height remains distinct from geometric height",
            geometric_10km > 10_000.0 and geometric_20km > 20_000.0,
        )
    )

    try:
        model_level_to_height(100)
        rejected = False
    except ValueError:
        rejected = True
    tests.append(("context-free model-level conversion rejected", rejected))

    for name, passed in tests:
        print(("PASS" if passed else "FAIL"), name)

    print(
        "10 km geopotential ->",
        round(geometric_10km, 3),
        "m geometric; delta",
        round(geometric_10km - 10_000.0, 3),
        "m",
    )
    print(
        "20 km geopotential ->",
        round(geometric_20km, 3),
        "m geometric; delta",
        round(geometric_20km - 20_000.0, 3),
        "m",
    )

    passed_count = sum(1 for _, passed in tests if passed)
    print(f"{passed_count}/{len(tests)} PASS")
    if passed_count != len(tests):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
