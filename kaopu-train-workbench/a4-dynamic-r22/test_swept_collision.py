"""Failing regression: sampled whole-chain collision and crankpin attachment.

Run: python test_swept_collision.py
Writes SWEEP_COLLISION_QA.json and exits 1 while either defect exists.
No geometry is changed. This is an analytic-field existence test, not a mesh
test, a full all-pairs sweep, or a historical/manufacturing validation.
"""
from pathlib import Path
import hashlib
import json
import sys

sys.dont_write_bytecode = True
import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "reference"
sys.path.insert(0, str(SOURCE))
import driving_crank_assembly as drive
import wheelset_assembly as wheel


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def nearest_segment_point(point, a, b):
    v = b - a
    fraction = float(np.clip(np.dot(point - a, v) / np.dot(v, v), 0, 1))
    return a + fraction * v, fraction


def sweep_middle_rod_leading_axle():
    c = drive.CONFIG
    axle = np.array([wheel.CONFIG["radii"][2], wheel.CONFIG["axles_z"][2]])
    assert np.allclose(axle, [c["axis_y"], c["driver_axle_z"][0]])
    rod_radius = c["rod_half_width"]
    axle_radius = wheel.CONFIG["driver_journal_radius"]
    radius_sum = rod_radius + axle_radius
    worst = None
    candidate_count = 0
    confirmed_count = 0
    max_rod_closure_error = 0.0
    phases = np.linspace(0, 2 * np.pi, 3601)
    for theta in phases:
        b, s = drive.pose(float(theta), 1)
        max_rod_closure_error = max(max_rod_closure_error,
                                    abs(float(np.linalg.norm(s - b)) - c["rod_length"]))
        near, fraction = nearest_segment_point(axle, b, s)
        distance = float(np.linalg.norm(axle - near))
        margin = distance - radius_sum
        row = {
            "theta_rad": float(theta),
            "theta_deg": float(np.degrees(theta)),
            "centerline_distance_m": distance,
            "combined_radii_m": radius_sum,
            "surface_margin_m": margin,
            "rod_segment_fraction": fraction,
            "rod_centerline_point_yz_m": near.tolist(),
        }
        if margin < 0:
            candidate_count += 1
            # Midpoint of the overlap along the common normal, at x=0.
            # Independent named occupancy fields establish actual material
            # intersection, rather than relying only on a broad-phase bound.
            yz = near + (axle - near) / distance * (rod_radius + margin / 2)
            witness = np.array([[0.0, *yz]])
            rod_value = float(drive.fields(witness, float(theta))[
                "middle_main_rod_with_open_eyes"][0])
            axle_value = float(wheel.fields(witness, float(theta))[
                "axle2_straight_axle"][0])
            confirmed = rod_value < -1e-9 and axle_value < -1e-9
            confirmed_count += int(confirmed)
            row.update({
                "witness_xyz_m": witness[0].tolist(),
                "rod_occupancy_value": rod_value,
                "axle_occupancy_value": axle_value,
                "intersection_confirmed": confirmed,
            })
        if worst is None or margin < worst["surface_margin_m"]:
            worst = row
    return {
        "pass": confirmed_count == 0,
        "target_pair": ["drive/middle_main_rod_with_open_eyes",
                        "wheel/axle2_straight_axle"],
        "phase_samples": len(phases),
        "range_rad": [0.0, float(2 * np.pi)],
        "includes_duplicate_periodic_endpoint": True,
        "geometric_candidate_samples": candidate_count,
        "field_confirmed_intersection_samples": confirmed_count,
        "max_rod_length_closure_error_m": max_rod_closure_error,
        "worst_sample": worst,
        "interpretation": "Negative occupancy in both named solids is a concrete collision witness. A closed rod and one shared theta do not prove clearance.",
        "phase_cannot_fix": "Changing only the middle phase shifts the collision in time; a full 2pi cycle covers the same positions.",
    }


def outside_crankpin_attachment():
    # The pin start is a literal in the preserved drive.fields implementation.
    pin_start = .76
    spoke_end = wheel.CONFIG["contact_x"] + wheel.CONFIG["spoke_half_depth"]
    midpoint = (pin_start + spoke_end) / 2
    result = []
    for i, sign, name in [(0, -1, "left"), (2, 1, "right")]:
        theta = .4
        b, _ = drive.pose(theta, i)
        witness = np.array([[sign * midpoint, *b]])
        ds = drive.fields(witness, theta)
        ws = wheel.fields(witness, theta)
        names = [n for n in ws if n.startswith("axle3_" + name + "_")]
        pin_value = float(ds[name + "_main_crank_pin"][0])
        wheel_value = min(float(ws[n][0]) for n in names)
        result.append({
            "side": name,
            "theta_rad": theta,
            "witness_xyz_m": witness[0].tolist(),
            "pin_occupancy_value": pin_value,
            "wheel_min_occupancy_value": wheel_value,
            "air_gap_confirmed": pin_value > 0 and wheel_value > 0,
        })
    # Other wheel solids cannot bridge the axial gap at the pin radius:
    # the hub ends radially below the entire main crankpin, and the tyre starts
    # outside it. The flange also starts at the tyre inner radius.
    driver_radius = wheel.CONFIG["radii"][3]
    hub_radius = driver_radius * wheel.CONFIG["hub_radius_fraction"]
    pin_radial_min = drive.CONFIG["crank_radius"] - drive.CONFIG["outer_pin_radius"]
    pin_radial_max = drive.CONFIG["crank_radius"] + drive.CONFIG["outer_pin_radius"]
    tyre_inner = driver_radius - wheel.CONFIG["tire_depth"]
    separated = pin_start > spoke_end and hub_radius < pin_radial_min and tyre_inner > pin_radial_max
    return {
        "pass": not separated,
        "pin_inner_abs_x_m": pin_start,
        "spoke_outer_abs_x_m": spoke_end,
        "axial_gap_m": pin_start - spoke_end,
        "hub_radius_m": hub_radius,
        "pin_radial_interval_m": [pin_radial_min, pin_radial_max],
        "tyre_inner_radius_m": tyre_inner,
        "whole_cycle_separation_by_envelopes": separated,
        "witnesses": result,
        "interpretation": "The retained wheel fields have no separate crank boss bridging this gap. Synchronized animation is not a physical pin attachment.",
    }


def main():
    tracked = [SOURCE / "driving_crank_assembly.py", SOURCE / "wheelset_assembly.py",
               SOURCE / "cylinder_actuation_assembly.py", HERE / "scene.js"]
    before = {str(p.relative_to(HERE)): digest(p) for p in tracked}
    collision = sweep_middle_rod_leading_axle()
    attachment = outside_crankpin_attachment()
    after = {str(p.relative_to(HERE)): digest(p) for p in tracked}
    effective = np.array(drive.CONFIG["phases"]) - np.array(drive.CONFIG["inclinations"])
    report = {
        "schema_version": "a4-r22-sampled-chain-failure-1",
        "status": "FAIL_WHOLE_CHAIN_ACCEPTANCE",
        "pass": collision["pass"] and attachment["pass"],
        "source_geometry_modified": before != after,
        "source_sha256": after,
        "method": "Read-only retained R20 analytic pose/occupancy fields. R22 scene metadata retains the named target solids. No geometry adjustment, mesh, voxel or point cache.",
        "middle_rod_leading_axle": collision,
        "outside_crankpin_attachment": attachment,
        "phase_evidence": {
            "phase_rad_inferred": drive.CONFIG["phases"],
            "inclination_rad_inferred": drive.CONFIG["inclinations"],
            "rod_length_m_inferred": drive.CONFIG["rod_length"],
            "effective_phase_rad": effective.tolist(),
            "effective_phase_degrees": np.degrees(effective).tolist(),
            "historical_60009_phase_verified": False,
        },
        "official_topology_constraints": [
            {
                "source": "https://blog.railwaymuseum.org.uk/gresley-overhaul-3/",
                "scope": "NRM report by the 60007 locomotive engineer, April 2016",
                "finding": "The A4 centre cylinder is behind and above the two outside cylinders; this is a relational constraint, not a numerical installation angle.",
            },
            {
                "source": "https://www.sirnigelgresley.org.uk/eng-reports/eng-23-a.shtml",
                "scope": "60007 maintenance, 30 April 2023",
                "finding": "The report explicitly identifies the middle coupled/driver bearing arrangement and the middle crank axle webs, distinguishing that crank axle from the leading and trailing coupled locations.",
            },
            {
                "source": "https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-12.shtml",
                "scope": "60007 preservation overhaul, late 2018; not exact 60009 dimensions",
                "finding": "Cylinder/slidebar alignment is referenced to the driving axle centre; the middle slidebar is aligned parallel to the cylinder centreline.",
            },
            {
                "source": "https://sirnigelgresley.org.uk/eng-reports/mob-eng-23-b.shtml",
                "scope": "60007 maintenance report, 2023; dismantled position is not normal running contact",
                "finding": "After the middle rod was disconnected from the crosshead, its little end was lowered onto the leading axle to gain access. This supports auditing that exact neighbour pair, not allowing running interference.",
            },
            {
                "source": "https://www.sirnigelgresley.org.uk/overhaul-1522/overhaul-17.shtml",
                "scope": "60007 preservation overhaul, 2020",
                "finding": "Coupling-rod installation required rotating individual wheelsets until their crankpins aligned. Same-side driver phasing is a shared-chain constraint.",
            },
        ],
        "not_verified": [
            "No complete all-pairs solid collision or continuous swept-volume certificate.",
            "No exact 60009 crank phase, cylinder inclination, rod length or minimum running clearance found in the checked official pages.",
            "No manufacturing, stress, load, suspension, valve-event or steam-flow validation.",
            "No claim that every one of the 513 R22 fields matches the retained R20 Python modules.",
        ],
        "diagnostic_attribution": {
            "not_the_prior_D2_error": "The current failure is at the leading driver Z=2.2098 m, not at the D2 middle crank axle Z=0. The middle axle already has two journals, crank webs and an offset crankpin; its continuous central shaft is omitted.",
            "current_inference_risk": "The collision exposes an inconsistent combination of inferred middle-cylinder/rod installation, rod envelope and leading axle envelope. The checked official evidence supports the topology and alignment constraints, but cannot identify a single exact dimensional correction.",
            "unresolved_values": "Inner cylinder inclination, inside/outside rod lengths, cylinder longitudinal offset and detailed axle diameters/profiles must remain unverified until drawing or measured evidence is available.",
        },
        "guardrail": "Keep axle stations and original geometry intact. Do not carve a collision out of the axle or silently choose new installation dimensions to produce a pass.",
    }
    (HERE / "SWEEP_COLLISION_QA.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "pass": report["pass"],
                      "rod_axle_min_margin_m": collision["worst_sample"]["surface_margin_m"],
                      "confirmed_collision_samples": collision["field_confirmed_intersection_samples"],
                      "crankpin_axial_gap_m": attachment["axial_gap_m"],
                      "source_geometry_modified": report["source_geometry_modified"]}, indent=2))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
