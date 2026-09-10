#!/usr/bin/env python3
"""KAOPU R18 bounded checkpoint-surface and instrumentation-validity probe.

This probe is semantic/evidence-contract validation. It does not execute HRRR and
contains no atmospheric truth values. Facts embedded here are locked from the
R18 source ledger and are intentionally limited to publication/workflow/I/O
semantics.
"""

from __future__ import annotations

import hashlib
import json


def digest(obj) -> str:
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


checks: list[tuple[str, bool]] = []


def check(name: str, condition: bool) -> None:
    checks.append((name, bool(condition)))


# Official public product/archive categories observed in the bounded R18 search.
nco_hrrr_product_classes = {
    "wrfprsf",
    "wrfnatf",
    "wrfsfcf",
    "wrfsubhf",
    "bufrsnd",
    "class1.bufr",
}
rapidrefresh_archive_classes = {"native", "isobaric", "surface"}
nomads_nwges_dirs = {"hrrrdasges", "hrrrges_sfc"}

# Locked NOAA-EMC HRRR workflow origins.
locked_origins = {
    "hrrrges_sfc": "wrfout_d01",
    "hrrrdas_d01": "wrfout_d01",
    "hrrrdas_d02": "wrfout_d02",
    "hrrrdas_small_d02": "wrfout_small_d02",
}

# Upstream WRF runtime-I/O documentation facts.
runtime_io = {
    "can_add_existing_state": True,
    "requires_registry_recompile": False,
    "performance_hit_documented": True,
}

check(
    "public_product_inventory_has_no_restart_class",
    all("restart" not in x and "wrfrst" not in x for x in nco_hrrr_product_classes),
)
check(
    "public_archive_categories_have_no_restart_class",
    "restart" not in rapidrefresh_archive_classes,
)
check(
    "current_nomads_nwges_has_no_restart_named_surface",
    all("restart" not in x and "wrfrst" not in x for x in nomads_nwges_dirs),
)
check(
    "hrrrges_sfc_locked_origin_is_history_wrfout",
    locked_origins["hrrrges_sfc"].startswith("wrfout"),
)
check(
    "hrrrdasges_locked_origins_are_history_wrfout",
    all(v.startswith("wrfout") for k, v in locked_origins.items() if k.startswith("hrrrdas")),
)
check(
    "runtime_io_can_expose_state_without_registry_recompile",
    runtime_io["can_add_existing_state"] and not runtime_io["requires_registry_recompile"],
)
check(
    "runtime_io_performance_perturbation_is_not_zero_by_assumption",
    runtime_io["performance_hit_documented"],
)

# Negative evidence is scoped. Exhausting the bounded public surfaces below does
# not authorize the universal claim that no internal/offline restart exists.
bounded_search_coverage = {
    "nco_product_inventory": True,
    "rapidrefresh_archive_description": True,
    "nomads_nwges_live_index": True,
    "locked_workflow_origin_trace": True,
}
universal_absence_claim_allowed = False
check(
    "negative_evidence_is_scoped_not_universal",
    all(bounded_search_coverage.values()) and not universal_absence_claim_allowed,
)

# Minimal non-interference gate demonstration. A valid control/instrumented pair
# may add new diagnostics, but every pre-existing comparison field must remain
# identical under the chosen equality policy before instrumentation is treated
# as numerically non-interfering.
baseline = {
    "T": [280.0, 281.0],
    "QVAPOR": [0.004, 0.005],
    "QCLOUD": [1.0e-4, 2.0e-4],
}
instrumented_ok = {
    **baseline,
    "RE_CLOUD": [9.1e-6, 10.2e-6],
}
instrumented_bad = {
    **baseline,
    "T": [280.0, 281.000001],
    "RE_CLOUD": [9.1e-6, 10.2e-6],
}

baseline_hash = digest(baseline)
ok_existing_hash = digest({k: instrumented_ok[k] for k in baseline})
bad_existing_hash = digest({k: instrumented_bad[k] for k in baseline})

check(
    "instrumentation_gate_accepts_identical_preexisting_fields",
    baseline_hash == ok_existing_hash,
)
check(
    "instrumentation_gate_rejects_changed_preexisting_fields",
    baseline_hash != bad_existing_hash,
)

replay_status = "source_callpath_authenticated"
paired_noninterference_passed = False
source_model_checkpoint_matched = False
eligible_runtime_auth = paired_noninterference_passed and source_model_checkpoint_matched
check(
    "replay_status_does_not_advance_without_pair_and_checkpoint",
    replay_status == "source_callpath_authenticated" and not eligible_runtime_auth,
)

passed = sum(ok for _, ok in checks)
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"RESULT {passed}/{len(checks)} PASS")

if passed != len(checks):
    raise SystemExit(1)
