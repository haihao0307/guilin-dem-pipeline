#!/usr/bin/env python3
"""Six *synthetic* ideal-pool scenarios; no claim of real-terrain hydraulics."""
from dataclasses import replace
from fractions import Fraction
import hashlib
import json
from math import fsum
from pathlib import Path
import time

from hydraulic_sections import Opening
from hydraulic_step import Pool, step
from water_ledger import SnapshotKey, Transfer

SCENARIOS = ("normal", "no_water", "blocked", "excess_inflow", "prescribed_breach", "downstream_backwater")


def fixture(scenario):
    if scenario not in SCENARIOS:
        raise ValueError("unknown scenario")
    pools = [Pool("source", 1.2, 500., 2.4), Pool("header", 1.1, 20., 1.65),
             Pool("upper", 1., 100., 1.35), Pool("lower", .75, 120., 1.4),
             Pool("receiver", 0., 10000., 2.)]
    storage = dict(source=300., header=6., upper=10., lower=12., receiver=3000.)
    openings = [Opening("supply", "source", "header", 1.2, .07, .05, 1.),
                Opening("inlet", "header", "upper", 1.1, .07, .06, 1.),
                Opening("outlet", "upper", "lower", 1.04, .04, .05, 1.),
                Opening("drain", "lower", "receiver", .79, .05, .05, 1.),
                Opening("upper_spill", "upper", "lower", 1.2, .5, .5, 1.),
                Opening("lower_spill", "lower", "receiver", .95, .5, .5, 1.),
                Opening("header_spill", "header", "receiver", 1.55, .5, .5, 1.)]
    forcing_m3_s = 0.
    if scenario == "no_water":
        storage.update(source=0., header=0.)
    elif scenario == "blocked":
        openings[1] = replace(openings[1], blockage=1.)
    elif scenario == "excess_inflow":
        forcing_m3_s = .01  # Declared synthetic stress input, not local rainfall.
    elif scenario == "prescribed_breach":
        openings[2] = replace(openings[2], invert_m=1., width_m=.4, height_m=.2)
    elif scenario == "downstream_backwater":
        storage["receiver"] = 12000.  # Fixed initial perturbation, then finite dynamic pool.
    return pools, openings, storage, forcing_m3_s


def run(scenario, dt_s=Fraction(1,4), duration_s=1800):
    if type(dt_s) not in (int, Fraction) or dt_s <= 0 or duration_s % dt_s:
        raise ValueError("positive exact step must divide duration")
    pools, openings, volumes, forcing_rate = fixture(scenario)
    initial = fsum(volumes.values())
    totals = {o.id: dict(forward_m3=0., reverse_m3=0.) for o in openings}
    max_error, limited, external, max_overtop = 0., 0, 0., 0.
    series = []
    for tick in range(int(duration_s/dt_s)):
        t = tick*dt_s
        key = SnapshotKey("synthetic-farmland-r022", "local-SI-z-up;time-origin=experiment-start", f"r022@{t}", t)
        inputs = {}
        if forcing_rate:
            v = forcing_rate*float(dt_s)
            inputs = dict(source_budgets_m3={"stress_input": v},
                          forcing_edges=[("stress_input", "upper")],
                          forcing_transfers=[Transfer("forcing:stress", "stress_input", "upper", v)])
        result = step(pools=pools, openings=openings, storage_m3=volumes,
                      snapshot=key, expected_snapshot=key, end_time_s=t+dt_s, **inputs)
        volumes = result["storage_m3"]
        external += result["external_in_m3"]
        max_error = max(max_error, abs(result["mass_balance_error_m3"]))
        limited += sum(x["limited"] for x in result["links"])
        max_overtop = max(max_overtop, -min(result["freeboard_m"].values()))
        for link in result["links"]:
            direction = "forward_m3" if link["raw_signed_q_m3_s"] >= 0 else "reverse_m3"
            totals[link["id"]][direction] += link["transferred_m3"]
        if (t+dt_s) % 60 == 0:
            series.append(dict(time_s=float(t+dt_s), levels_m=result["water_levels_m"].copy()))
    return dict(scenario=scenario, duration_s=duration_s, dt_s=float(dt_s),
                final_storage_m3=volumes, final_levels_m=result["water_levels_m"],
                link_totals=totals, external_input_m3=external,
                total_residual_m3=fsum(volumes.values())-initial-external,
                max_step_residual_m3=max_error, limited_link_steps=limited,
                max_over_crest_m=max_overtop, samples=series)


def verify_scenarios(results):
    r = {x["scenario"]: x for x in results}
    assert all(abs(x["total_residual_m3"]) < 1e-7 for x in results)
    assert all(min(x["final_storage_m3"].values()) >= 0 for x in results)
    assert all(x["max_over_crest_m"] == 0 for x in results), "unmodeled bank overtopping invalidates the fixture"
    assert r["normal"]["link_totals"]["inlet"]["forward_m3"] > 0
    assert r["normal"]["link_totals"]["drain"]["forward_m3"] > 0
    assert r["no_water"]["link_totals"]["inlet"]["forward_m3"] == 0
    assert r["blocked"]["link_totals"]["inlet"]["forward_m3"] == 0
    assert r["no_water"]["final_levels_m"]["upper"] < r["normal"]["final_levels_m"]["upper"]
    assert r["blocked"]["final_levels_m"]["upper"] < r["normal"]["final_levels_m"]["upper"]
    assert r["excess_inflow"]["link_totals"]["upper_spill"]["forward_m3"] > 0
    assert r["prescribed_breach"]["final_levels_m"]["upper"] < r["normal"]["final_levels_m"]["upper"]
    assert r["downstream_backwater"]["link_totals"]["drain"]["reverse_m3"] > 0
    assert r["downstream_backwater"]["final_levels_m"]["lower"] > r["normal"]["final_levels_m"]["lower"]


def main():
    started = time.perf_counter()
    results = [run(s) for s in SCENARIOS]
    verify_scenarios(results)
    convergence = []
    for result in results:
        coarse = run(result["scenario"], dt_s=Fraction(1,2))
        error = max(abs(result["final_levels_m"][i]-coarse["final_levels_m"][i]) for i in result["final_levels_m"])
        assert error < 0.0002, (result["scenario"], error)
        convergence.append(dict(scenario=result["scenario"], quarter_vs_half_second_max_level_difference_m=error))
    root = Path(__file__).resolve().parent
    report = dict(probe="farmland-hydraulic-r022", status="pass", scenarios=results,
                  step_refinement=convergence, elapsed_seconds=time.perf_counter()-started,
                  sourceSha256={p:hashlib.sha256((root/p).read_bytes()).hexdigest()
                                for p in ("hydraulic_sections.py", "hydraulic_step.py", "water_ledger.py", "probe_hydraulic_r022.py")},
                  sixSyntheticScenarios="passed", realFieldHydraulicValidation="not_run",
                  channelUnsteadyRouting="unsupported", erosionBreachGrowth="unsupported",
                  localDividerCalibration="unknown", visualAcceptance=False, productionReady=False)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
