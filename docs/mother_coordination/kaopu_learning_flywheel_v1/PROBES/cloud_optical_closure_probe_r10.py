#!/usr/bin/env python3
"""KAOPU R10 semantic probe: cloud optical closure sufficiency.

This is engineering evidence only. It checks dependency/semantics invariants and
must not be interpreted as validation of real cloud microphysics.
"""

from math import exp, isclose


def tau_from_cwp(cwp_kg_m2: float, re_m: float, rho_particle_kg_m3: float, qext: float) -> float:
    if re_m <= 0 or rho_particle_kg_m3 <= 0:
        raise ValueError("effective radius and particle density must be positive")
    return 3.0 * qext * cwp_kg_m2 / (4.0 * rho_particle_kg_m3 * re_m)


def cwp_from_mixing_ratio(q_kg_kg: float, rho_air_kg_m3: float, dz_m: float, *, cloud_fraction: float = 1.0, semantics: str = "grid_mean") -> float:
    if semantics == "grid_mean":
        return q_kg_kg * rho_air_kg_m3 * dz_m
    if semantics == "in_cloud":
        return q_kg_kg * rho_air_kg_m3 * dz_m * cloud_fraction
    raise ValueError("mixing-ratio semantics must be grid_mean or in_cloud")


def independent_column_transmittance(cloud_fraction: float, tau_cloud: float) -> float:
    return (1.0 - cloud_fraction) + cloud_fraction * exp(-tau_cloud)


def smeared_transmittance(cloud_fraction: float, tau_cloud: float) -> float:
    return exp(-cloud_fraction * tau_cloud)


def require_particle_radius(re_m):
    if re_m is None:
        raise ValueError("particle effective radius is required for this closure route")
    return re_m


def main() -> None:
    passed = 0
    total = 6

    # 1. Same water path, different effective radius -> different optical depth.
    taus = [tau_from_cwp(0.1, re_um * 1e-6, 1000.0, 2.0) for re_um in (5.0, 10.0, 20.0)]
    assert all(isclose(a, b, rel_tol=1e-12) for a, b in zip(taus, (30.0, 15.0, 7.5)))
    passed += 1
    print("PASS 1: same CWP, re=5/10/20 um -> tau=30/15/7.5")

    # 2. Mixing ratio needs air density/layer geometry before it becomes path mass.
    tau_low_rho = tau_from_cwp(cwp_from_mixing_ratio(1e-4, 0.6, 1000.0), 10e-6, 1000.0, 2.0)
    tau_high_rho = tau_from_cwp(cwp_from_mixing_ratio(1e-4, 1.2, 1000.0), 10e-6, 1000.0, 2.0)
    assert isclose(tau_low_rho, 9.0) and isclose(tau_high_rho, 18.0)
    passed += 1
    print("PASS 2: same q and dz, rho_air 0.6/1.2 -> tau=9/18")

    # 3. Grid-mean vs in-cloud condensate semantics change water path by 1/f here.
    cwp_grid = cwp_from_mixing_ratio(1e-4, 1.0, 1000.0, cloud_fraction=0.2, semantics="grid_mean")
    cwp_incloud = cwp_from_mixing_ratio(1e-4, 1.0, 1000.0, cloud_fraction=0.2, semantics="in_cloud")
    assert isclose(cwp_grid, 0.1) and isclose(cwp_incloud, 0.02) and isclose(cwp_grid / cwp_incloud, 5.0)
    passed += 1
    print("PASS 3: condensate semantics at f=0.2 -> CWP 0.1 vs 0.02 kg/m2")

    # 4. Cloud fraction is not universally equivalent to scaling local extinction.
    t_ica = independent_column_transmittance(0.5, 10.0)
    t_smear = smeared_transmittance(0.5, 10.0)
    assert t_ica > 0.5 and t_smear < 0.01 and (t_ica / t_smear) > 70.0
    passed += 1
    print(f"PASS 4: independent-column T={t_ica:.9f}, naive smear T={t_smear:.9f}, ratio={t_ica/t_smear:.2f}")

    # 5. Path optical depth needs layer geometry/distribution before local beta_ext exists.
    betas = [15.0 / dz for dz in (500.0, 1000.0, 2000.0)]
    assert all(isclose(a, b) for a, b in zip(betas, (0.03, 0.015, 0.0075)))
    passed += 1
    print("PASS 5: tau=15 over dz=500/1000/2000 m -> beta=0.03/0.015/0.0075 m^-1")

    # 6. Missing particle size fails typed instead of silently inventing a renderer value.
    try:
        require_particle_radius(None)
    except ValueError:
        passed += 1
        print("PASS 6: missing effective radius is rejected")
    else:
        raise AssertionError("missing effective radius must not be fabricated")

    print(f"RESULT: {passed}/{total} PASS")


if __name__ == "__main__":
    main()
