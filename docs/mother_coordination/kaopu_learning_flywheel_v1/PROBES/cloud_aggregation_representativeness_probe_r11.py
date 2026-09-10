#!/usr/bin/env python3
"""KAOPU R11 semantic probe: aggregation/representativeness limits of time-averaged cloud diagnostics.

Engineering evidence only. It verifies mathematical/contract invariants implied by
using coarse, time-averaged path-optics diagnostics as input to a local realtime volume.
It does not validate MERRA-2 values or cloud microphysics.
"""

from dataclasses import dataclass
from math import exp, isclose
from statistics import mean


@dataclass(frozen=True)
class AggregationContract:
    time_support: str
    interval_hours: float
    horizontal_support: str
    native_levels: int
    direct_instantaneous_local_volume: bool
    disaggregation_method: str | None = None


def mean_transmittance(taus):
    return mean(exp(-t) for t in taus)


def transmittance_from_mean_tau(taus):
    return exp(-mean(taus))


def mean_local_extinction(taus, thicknesses_m):
    return mean(t / dz for t, dz in zip(taus, thicknesses_m))


def local_extinction_from_mean_path(taus, thicknesses_m):
    return mean(taus) / mean(thicknesses_m)


def lag1_product_mean_periodic(values):
    n = len(values)
    return sum(values[i] * values[(i + 1) % n] for i in range(n)) / n


def require_instantaneous_volume_ready(contract: AggregationContract):
    if contract.time_support != "instantaneous" or contract.horizontal_support != "local_volume":
        if not contract.disaggregation_method:
            raise ValueError(
                "aggregated source requires explicit DerivedSyntheticDisaggregation before "
                "instantaneous local-volume use"
            )
    return True


def main():
    passed = 0
    total = 6

    # 1. Radiative transfer is nonlinear in optical depth: E[e^-tau] != e^-E[tau].
    taus = [0.0, 10.0]
    t_avg = mean_transmittance(taus)
    t_from_avg_tau = transmittance_from_mean_tau(taus)
    assert isclose(mean(taus), 5.0)
    assert t_avg > 0.5 and t_from_avg_tau < 0.01 and t_avg / t_from_avg_tau > 70.0
    passed += 1
    print(
        f"PASS 1: mean tau=5 -> E[T]={t_avg:.9f}, "
        f"T(E[tau])={t_from_avg_tau:.9f}, ratio={t_avg/t_from_avg_tau:.2f}"
    )

    # 2. Mean path optical thickness + mean layer thickness do not define mean local extinction.
    taus = [1.0, 9.0]
    dz = [900.0, 100.0]
    beta_true_mean = mean_local_extinction(taus, dz)
    beta_ratio_means = local_extinction_from_mean_path(taus, dz)
    assert beta_true_mean / beta_ratio_means > 4.5
    passed += 1
    print(
        f"PASS 2: E[tau/dz]={beta_true_mean:.9f} m^-1 vs "
        f"E[tau]/E[dz]={beta_ratio_means:.9f} m^-1"
    )

    # 3. Separately averaged cloud fraction and in-cloud optical depth lose covariance.
    cloud_fraction = [0.1, 0.9]
    in_cloud_tau = [1.0, 9.0]
    mean_product = mean(c * t for c, t in zip(cloud_fraction, in_cloud_tau))
    product_means = mean(cloud_fraction) * mean(in_cloud_tau)
    assert isclose(mean_product, 4.1) and isclose(product_means, 2.5)
    passed += 1
    print(
        f"PASS 3: E[C*tau]={mean_product:.3f} vs E[C]E[tau]={product_means:.3f}; "
        "separate means do not recover joint optical state"
    )

    # 4. Same time-mean optical depth can represent very different temporal histories.
    intermittent = [0.0, 10.0]
    steady = [5.0, 5.0]
    assert isclose(mean(intermittent), mean(steady))
    t_intermit = mean_transmittance(intermittent)
    t_steady = mean_transmittance(steady)
    assert t_intermit / t_steady > 70.0
    passed += 1
    print(
        f"PASS 4: same mean tau=5, intermittent E[T]={t_intermit:.9f}, "
        f"steady E[T]={t_steady:.9f}"
    )

    # 5. Same cell mean and cloud coverage can hide different spatial correlation/geometry.
    alternating = [10.0, 0.0, 10.0, 0.0]
    clustered = [10.0, 10.0, 0.0, 0.0]
    assert isclose(mean(alternating), mean(clustered), rel_tol=0, abs_tol=1e-12)
    assert mean(v > 0 for v in alternating) == mean(v > 0 for v in clustered) == 0.5
    corr_a = lag1_product_mean_periodic(alternating)
    corr_b = lag1_product_mean_periodic(clustered)
    assert isclose(corr_a, 0.0) and isclose(corr_b, 25.0)
    passed += 1
    print(
        f"PASS 5: same mean tau/coverage, different lag-1 structure "
        f"({corr_a:.1f} vs {corr_b:.1f})"
    )

    # 6. Aggregated source metadata must block direct promotion to local instantaneous voxel truth.
    merra_like = AggregationContract(
        time_support="3h_time_average",
        interval_hours=3.0,
        horizontal_support="coarse_grid_cell",
        native_levels=72,
        direct_instantaneous_local_volume=False,
    )
    try:
        require_instantaneous_volume_ready(merra_like)
    except ValueError:
        passed += 1
        print("PASS 6: aggregated packet is rejected for direct instantaneous local-volume use")
    else:
        raise AssertionError("aggregated source must require explicit disaggregation lineage")

    print(f"RESULT: {passed}/{total} PASS")


if __name__ == "__main__":
    main()
